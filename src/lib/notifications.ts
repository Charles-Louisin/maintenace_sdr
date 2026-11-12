import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { api } from './api';
import { localDeviceId, syncLocalReminders } from './localReminders';

const IS_WEB = Platform.OS === 'web';

if (!IS_WEB) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * Demande l'autorisation et enregistre le téléphone côté serveur.
 * Les échéances sont calculées par le serveur et programmées sur le téléphone (rappels locaux, sans Firebase).
 */
export async function registerForPush(ask = true): Promise<PermissionState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('missions', {
      name: 'Missions et rappels',
      // AndroidImportance est bien réexporté par expo-notifications (vérifié dans ses typages) : faux positif du plugin import.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') {
    return status === 'denied' ? 'denied' : 'undetermined';
  }
  try {
    // Rappels locaux (sans Firebase) : le téléphone s’enregistre comme appareil « local »,
    // puis programme lui-même les notifications (voir localReminders.ts)
    await api('/api/notifications/devices', { method: 'POST', body: { token: await localDeviceId(), platform: Platform.OS, permission: status } });
  } catch {
    /* hors connexion : réessayé au prochain démarrage */
  }
  syncLocalReminders();
  return 'granted';
}

/** Ouverture d'une notification : navigation directe vers la bonne page. */
function useNotificationNavigationNative(enabled: boolean) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!enabled || !last) return;
    const data = last.notification.request.content.data as { url?: string; jobId?: string } | undefined;
    if (data?.jobId) api(`/api/notifications/${data.jobId}/opened`, { method: 'POST', body: {} }).catch(() => undefined);
    if (data?.url && typeof data.url === 'string' && data.url.startsWith('/')) router.push(data.url as never);
  }, [enabled, last]);
}

/** Sur le web, les notifications push n'existent pas : le hook est remplacé (choix fixé au chargement du module). */
export const useNotificationNavigation: (enabled: boolean) => void = IS_WEB ? () => undefined : useNotificationNavigationNative;

export function usePushPermission(enabled: boolean) {
  const [state, setState] = useState<PermissionState>('undetermined');
  useEffect(() => {
    if (!enabled) return;
    registerForPush(true).then(setState);
  }, [enabled]);
  return { state, retry: () => registerForPush(true).then(setState) };
}

export interface PermissionCheck {
  /** granted : on peut continuer ; unsupported : web / simulateur, pas de blocage. */
  state: PermissionState;
  /** false : le système ne montrera plus l'invite, il faut passer par les réglages. */
  canAskAgain: boolean;
}

/** Lecture de l'autorisation, avec demande facultative (invite système). */
export async function checkNotificationPermission(ask: boolean): Promise<PermissionCheck> {
  if (IS_WEB || !Device.isDevice) return { state: 'unsupported', canAskAgain: false };
  let p = await Notifications.getPermissionsAsync();
  if (p.status !== 'granted' && ask && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
  const state: PermissionState = p.status === 'granted' ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined';
  return { state, canAskAgain: p.canAskAgain };
}
