import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Brouillons locaux des réponses collées (consultables et conservés hors connexion).
 * Chaque brouillon a un identifiant unique transmis au serveur : un renvoi ne crée jamais de doublon.
 */
export interface ResponseDraft {
  clientDraftId: string;
  callAssignmentId?: string;
  type: 'pre' | 'post';
  text: string;
  label: string;
  updatedAt: string;
  syncedReportId?: string;
}

const KEY = 'sdr.response-drafts';

export function newDraftId() {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listDrafts(): Promise<ResponseDraft[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as ResponseDraft[];
  } catch {
    return [];
  }
}

export async function saveDraft(d: ResponseDraft) {
  const all = await listDrafts();
  const i = all.findIndex((x) => x.clientDraftId === d.clientDraftId);
  if (i >= 0) all[i] = d;
  else all.unshift(d);
  await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 50)));
}

export async function removeDraft(id: string) {
  const all = await listDrafts();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((x) => x.clientDraftId !== id)));
}

let syncing = false;
/**
 * Synchronise les brouillons liés à une mission quand la connexion revient.
 * Le serveur reconnaît l'identifiant du brouillon : aucun doublon, aucun écrasement.
 */
export async function syncDrafts(): Promise<number> {
  if (syncing) return 0;
  syncing = true;
  let n = 0;
  try {
    const { api } = await import('./api');
    for (const d of await listDrafts()) {
      if (d.syncedReportId || !d.callAssignmentId || d.text.trim().length < 2) continue;
      try {
        const r = await api<{ report: { _id: string } }>('/api/incoming-reports/parse', {
          method: 'POST',
          body: { callAssignmentId: d.callAssignmentId, text: d.text, clientDraftId: d.clientDraftId },
        });
        await removeDraft(d.clientDraftId);
        void r;
        n++;
      } catch {
        /* toujours hors connexion ou erreur : le brouillon reste sur le téléphone */
      }
    }
  } finally {
    syncing = false;
  }
  return n;
}
