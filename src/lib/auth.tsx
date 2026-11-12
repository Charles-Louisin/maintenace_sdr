import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ensureSession, setSignedOutHandler, ApiError } from './api';
import { session } from './session';
import { queryClient, clearPersistedCache } from './query';
import {
  authenticate,
  biometricAvailable,
  biometricEnabled,
  biometricLabel,
  getBiometricKey,
  markAsked,
  saveBiometricKey,
  setBiometricEnabled,
  wasAsked,
} from './biometric';
import { Alert } from './dialog';
import { toast } from '../components/toast';

/**
 * États : loading (démarrage) → locked (empreinte requise) → signedIn ; ou signedOut.
 * « locked » : une session existe sur le téléphone mais doit être déverrouillée par l'empreinte.
 */
type Status = 'loading' | 'locked' | 'signedOut' | 'signedIn';
interface Owner {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  avatarUrl?: string | null;
}
interface AuthValue {
  status: Status;
  owner: Owner | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  unlock(): Promise<boolean>;
  /** Connexion par empreinte depuis l'écran de connexion (après déconnexion) : false si refusée */
  biometricSignIn(): Promise<boolean>;
  /** Active ou désactive l'empreinte pour ce téléphone (crée / révoque la clé côté serveur) */
  setBiometric(on: boolean): Promise<boolean>;
  refreshOwner(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

async function loadOwner(): Promise<Owner | null> {
  try {
    return await api<Owner>('/api/auth/me');
  } catch {
    return null; // hors connexion : les données en cache restent consultables
  }
}

/** Crée la clé de connexion de ce téléphone (empreinte activée). */
async function enrollBiometric() {
  const key = await api<{ keyId: string; secret: string }>('/api/auth/biometric/enroll', { method: 'POST', body: { device: 'mobile' } });
  await saveBiometricKey(key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [owner, setOwner] = useState<Owner | null>(null);
  const setBiometricRef = useRef<(on: boolean) => Promise<boolean>>(async () => false);

  const signOut = useCallback(async () => {
    const rt = await session.getRefresh();
    api('/api/auth/logout', { method: 'POST', body: { refreshToken: rt ?? undefined }, auth: false }).catch(() => undefined);
    await session.clear();
    queryClient.clear();
    await clearPersistedCache();
    setOwner(null);
    setStatus('signedOut');
  }, []);

  /** Reprise de session après déverrouillage (ou au démarrage sans empreinte). */
  const resume = useCallback(async () => {
    const ok = await ensureSession();
    if (!ok) {
      const rt = await session.getRefresh();
      setStatus(rt ? 'signedIn' : 'signedOut');
      return;
    }
    setOwner(await loadOwner());
    setStatus('signedIn');
    // Empreinte activée avant cette version : la clé de connexion est créée une fois
    if ((await biometricEnabled()) && !(await getBiometricKey())) enrollBiometric().catch(() => undefined);
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticate();
    if (ok) await resume();
    return ok;
  }, [resume]);

  const biometricSignIn = useCallback(async () => {
    const key = await getBiometricKey();
    if (!key) return false;
    if (!(await authenticate('Se connecter à BATIS'))) return false;
    try {
      const r = await api<{ accessToken: string; refreshToken: string; owner: Owner }>('/api/auth/biometric/login', {
        method: 'POST',
        body: { ...key, device: 'mobile' },
        auth: false,
      });
      session.setAccess(r.accessToken);
      await session.setRefresh(r.refreshToken);
      setOwner((await loadOwner()) ?? r.owner);
      setStatus('signedIn');
      return true;
    } catch (e) {
      // Clé révoquée (mot de passe changé…) : retour au mot de passe, l'empreinte se réactivera ensuite
      if (e instanceof ApiError && e.status === 401) {
        await saveBiometricKey(null);
        await setBiometricEnabled(false);
      }
      throw e;
    }
  }, []);

  const setBiometric = useCallback(async (on: boolean) => {
    if (on) {
      if (!(await authenticate('Confirmez pour activer'))) return false;
      await enrollBiometric();
      await setBiometricEnabled(true);
      return true;
    }
    const key = await getBiometricKey();
    if (key) await api(`/api/auth/biometric/${key.keyId}`, { method: 'DELETE' }).catch(() => undefined);
    await saveBiometricKey(null);
    await setBiometricEnabled(false);
    return true;
  }, []);

  useEffect(() => {
    setBiometricRef.current = setBiometric;
  }, [setBiometric]);

  const refreshOwner = useCallback(async () => {
    const o = await loadOwner();
    if (o) setOwner(o);
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => {
      setOwner(null);
      setStatus('signedOut');
    });
    // L’empreinte ne sert qu’après une déconnexion : au redémarrage, la session ouverte reprend directement
    Promise.resolve().then(resume);
  }, [resume]);

  const offerBiometric = useCallback(async () => {
    if ((await wasAsked()) || !(await biometricAvailable())) return;
    await markAsked();
    const kind = await biometricLabel();
    Alert.alert(
      `Activer la connexion par ${kind} ?`,
      'Vous déverrouillerez l’application sans ressaisir votre mot de passe. Modifiable dans Paramètres › Sécurité.',
      [
        { text: 'Plus tard', style: 'cancel' },
        {
          text: 'Activer',
          onPress: async () => {
            try {
              if (await setBiometricRef.current(true)) toast.success(`Connexion par ${kind} activée`);
            } catch {
              toast.error('Activation impossible pour le moment');
            }
          },
        },
      ],
    );
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const r = await api<{ accessToken: string; refreshToken: string; owner: Owner }>('/api/auth/login', {
        method: 'POST',
        body: { email, password, device: 'mobile' },
        auth: false,
      });
      session.setAccess(r.accessToken);
      await session.setRefresh(r.refreshToken);
      setOwner(r.owner);
      setStatus('signedIn');
      loadOwner().then((o) => o && setOwner(o));
      setTimeout(() => void offerBiometric(), 600);
    },
    [offerBiometric],
  );

  const value = useMemo(
    () => ({ status, owner, signIn, signOut, unlock, biometricSignIn, setBiometric, refreshOwner }),
    [status, owner, signIn, signOut, unlock, biometricSignIn, setBiometric, refreshOwner],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider manquant');
  return v;
}
