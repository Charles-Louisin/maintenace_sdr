import Constants from 'expo-constants';
import { session } from './session';

/** Adresse de l'API : EXPO_PUBLIC_API_URL ou app.json > extra.apiUrl. Aucune clé secrète côté mobile. */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'http://localhost:5000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public payload?: Record<string, unknown>,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let onSignedOut: (() => void) | null = null;
export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const rt = await session.getRefresh();
      if (!rt) return false;
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        if (res.status === 401) await session.clear();
        return false;
      }
      const j = (await res.json()) as { accessToken: string; refreshToken: string };
      session.setAccess(j.accessToken);
      await session.setRefresh(j.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function ensureSession(): Promise<boolean> {
  if (session.getAccess()) return true;
  return refreshTokens();
}

type Options = { method?: string; body?: unknown; form?: FormData; auth?: boolean };

export async function api<T = unknown>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const access = session.getAccess();
  if (opts.auth !== false && access) headers.Authorization = `Bearer ${access}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Connexion impossible. Vérifiez votre accès à Internet.');
  }
  if (res.status === 401 && opts.auth !== false && !retried) {
    if (await refreshTokens()) return api<T>(path, opts, true);
    onSignedOut?.();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* réponse non JSON */
  }
  if (!res.ok) {
    const j = (json ?? {}) as { error?: { code?: string; message?: string; details?: unknown } } & Record<string, unknown>;
    throw new ApiError(res.status, j.error?.code ?? 'ERROR', j.error?.message ?? 'Une erreur est survenue', j.error?.details, j);
  }
  return json as T;
}

export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: body ?? {} });
export const patch = <T>(p: string, body: unknown) => api<T>(p, { method: 'PATCH', body });
export const put = <T>(p: string, body: unknown) => api<T>(p, { method: 'PUT', body });
export const del = <T>(p: string) => api<T>(p, { method: 'DELETE' });

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const d = Array.isArray(e.details) ? (e.details as { message?: string; path?: string }[]) : [];
    return d.length ? `${e.message} : ${d.map((x) => x.message).join(', ')}` : e.message;
  }
  return 'Une erreur inattendue est survenue';
}
