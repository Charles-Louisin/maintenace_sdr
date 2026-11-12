import { useSyncExternalStore } from 'react';
import { API_URL, ApiError, api, ensureSession } from './api';
import { session } from './session';
import { toast } from '../components/toast';

/**
 * Envois de fichiers (documents, modèle de rapport, photos) gérés en dehors des écrans :
 * la progression s'affiche sur le bouton qui a lancé l'envoi, avec un bouton d'arrêt ;
 * l'envoi continue si l'on quitte la page ou l'application (tant que le téléphone ne ferme pas l'app).
 * Un toast annonce la fin, l'échec ou l'arrêt.
 */
export interface UploadItem {
  id: number;
  /** Identifie le bouton qui a lancé l'envoi (la progression s'affiche dessus) */
  key: string;
  /** Identifiant transmis au serveur pour pouvoir annuler */
  uploadId: string;
  label: string;
  progress: number; // 0 → 1
  status: 'uploading' | 'done' | 'error' | 'cancelled';
}

let items: UploadItem[] = [];
const listeners = new Set<() => void>();
const xhrs = new Map<number, XMLHttpRequest>();
let nextId = 1;

function emit() {
  for (const l of listeners) l();
}
function update(id: number, patch: Partial<UploadItem>) {
  items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  emit();
}
function remove(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

export function useUploads(): UploadItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
}

/** Envoi en cours lancé par ce bouton (ou undefined). */
export function useUpload(key: string): UploadItem | undefined {
  return useUploads().find((u) => u.key === key && u.status === 'uploading');
}

/** Arrêt : coupe l'envoi et demande au serveur de ne rien garder (même si le fichier était déjà arrivé). */
export function cancelUpload(id: number) {
  const item = items.find((i) => i.id === id);
  if (!item || item.status !== 'uploading') return;
  update(id, { status: 'cancelled' });
  xhrs.get(id)?.abort();
  api(`/api/uploads/cancel/${item.uploadId}`, { method: 'POST', body: {} }).catch(() => undefined);
}

function send<T>(id: number, path: string, form: FormData, retried = false): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const item = items.find((i) => i.id === id);
    const xhr = new XMLHttpRequest();
    xhrs.set(id, xhr);
    xhr.open('POST', `${API_URL}${path}`);
    const token = session.getAccess();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (item) xhr.setRequestHeader('X-Upload-Id', item.uploadId);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) update(id, { progress: Math.min(0.99, e.loaded / e.total) });
    };
    xhr.onload = async () => {
      xhrs.delete(id);
      let json: unknown = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* réponse non JSON */
      }
      // Arrêté entre-temps : la réponse n'est pas prise en compte (le serveur annule de son côté)
      if (items.find((i) => i.id === id)?.status === 'cancelled') return reject(new ApiError(0, 'CANCELLED', 'Envoi arrêté'));
      // Jeton expiré pendant un long envoi : renouvelé puis nouvel essai, une seule fois
      if (xhr.status === 401 && !retried) {
        session.setAccess(null);
        if (await ensureSession()) return send<T>(id, path, form, true).then(resolve, reject);
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(json as T);
      const j = (json ?? {}) as { error?: { code?: string; message?: string; details?: unknown } } & Record<string, unknown>;
      reject(new ApiError(xhr.status, j.error?.code ?? 'ERROR', j.error?.message ?? 'Envoi refusé', j.error?.details, j));
    };
    xhr.onerror = () => {
      xhrs.delete(id);
      reject(new ApiError(0, 'NETWORK', 'Connexion perdue pendant l’envoi'));
    };
    xhr.onabort = () => {
      xhrs.delete(id);
      reject(new ApiError(0, 'CANCELLED', 'Envoi arrêté'));
    };
    xhr.send(form);
  });
}

/**
 * Lance un envoi suivi. Renvoie le résultat du serveur, ou null si l'envoi a été arrêté.
 * `accept` permet de considérer certaines réponses d'erreur comme un résultat (ex. doublons).
 */
export async function startUpload<T>(opts: {
  key: string;
  label: string;
  path: string;
  form: FormData;
  successMessage?: string;
  accept?: (e: ApiError) => T | null;
}): Promise<T | null> {
  const id = nextId++;
  const uploadId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  items = [...items, { id, key: opts.key, uploadId, label: opts.label, progress: 0, status: 'uploading' }];
  emit();
  try {
    await ensureSession();
    const r = await send<T>(id, opts.path, opts.form);
    update(id, { progress: 1, status: 'done' });
    toast.success(opts.successMessage ?? `${opts.label} : terminé`);
    return r;
  } catch (e) {
    const err = e as ApiError;
    if (err.code === 'CANCELLED' || err.code === 'UPLOAD_CANCELLED') {
      update(id, { status: 'cancelled' });
      toast.info(`${opts.label} : arrêté, rien n’a été enregistré`);
      return null;
    }
    const accepted = opts.accept?.(err) ?? null;
    if (accepted) {
      update(id, { progress: 1, status: 'done' });
      return accepted;
    }
    update(id, { status: 'error' });
    toast.error(`${opts.label} : ${err.message}`);
    throw err;
  } finally {
    remove(id);
  }
}
