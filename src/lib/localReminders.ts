import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { queryClient } from './query';

/**
 * Rappels LOCAUX (même méthode que l'app Mes Poches, sans Firebase) :
 * le serveur calcule les échéances (appel J-5 à 9 h, suivi…), le téléphone les programme
 * lui-même avec expo-notifications. Elles sonnent à l'heure prévue, application fermée et hors connexion.
 * La liste est resynchronisée à l'ouverture, au retour au premier plan et après chaque modification.
 */

const PREFIX = 'batis-job-';
const DEVICE_KEY = 'batis.localDeviceId';
/** Android limite le nombre d'alarmes par application : on garde les plus proches. */
const MAX_SCHEDULED = 60;
const CHANNEL = 'missions';

interface UpcomingJob {
  _id: string;
  title: string;
  body: string;
  url: string;
  kind: string;
  dueAt: string;
}

/** Identifiant stable du téléphone, enregistré côté serveur comme appareil « local ». */
export async function localDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id).catch(() => undefined);
  }
  return `local:${id}`;
}

let running: Promise<void> | null = null;

export function syncLocalReminders(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  running ??= (async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') return;
      const jobs = await api<UpcomingJob[]>('/api/notifications?scope=upcoming');
      const now = Date.now() + 5000;
      const wanted = jobs
        .filter((j) => new Date(j.dueAt).getTime() > now)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, MAX_SCHEDULED);
      const byId = new Map(wanted.map((j) => [PREFIX + j._id, j]));

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const present = new Set<string>();
      for (const n of scheduled) {
        if (!n.identifier.startsWith(PREFIX)) continue;
        const job = byId.get(n.identifier);
        const data = n.content.data as { dueAt?: string; title?: string; body?: string } | undefined;
        // Annulée, déplacée ou texte modifié côté serveur : on retire (et on reprogramme ci-dessous)
        if (!job || data?.dueAt !== job.dueAt || n.content.title !== job.title || n.content.body !== job.body) {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        } else {
          present.add(n.identifier);
        }
      }

      for (const [identifier, job] of byId) {
        if (present.has(identifier)) continue;
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title: job.title,
            body: job.body,
            sound: 'default',
            data: { url: job.url, jobId: job._id, kind: job.kind, dueAt: job.dueAt },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(job.dueAt), channelId: CHANNEL },
        });
      }
    } catch {
      // Hors connexion : les rappels déjà programmés restent en place, nouvel essai plus tard
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Retire tous les rappels BATIS du téléphone (déconnexion). */
export async function clearLocalReminders() {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const n of scheduled) if (n.identifier.startsWith(PREFIX)) await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
}

/** Tient les rappels du téléphone à jour tant que la session est ouverte. */
export function useLocalReminders(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    syncLocalReminders();
    const app = AppState.addEventListener('change', (s) => s === 'active' && syncLocalReminders());
    const timer = setInterval(syncLocalReminders, 10 * 60 * 1000);
    // Après chaque modification (import validé, date changée, mission envoyée…), les échéances changent
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unsub = queryClient.getMutationCache().subscribe((e) => {
      if (e.type !== 'updated' || e.mutation.state.status !== 'success') return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(syncLocalReminders, 1500);
    });
    return () => {
      app.remove();
      clearInterval(timer);
      unsub();
      if (debounce) clearTimeout(debounce);
    };
  }, [enabled]);
}

/** Identifiants des échéances serveur actuellement programmées sur ce téléphone. */
export async function scheduledJobIds(): Promise<Set<string>> {
  if (Platform.OS === 'web') return new Set();
  const list = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  return new Set(list.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => n.identifier.slice(PREFIX.length)));
}
