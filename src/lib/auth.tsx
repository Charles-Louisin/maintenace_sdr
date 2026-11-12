import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api, ensureSession, setSignedOutHandler } from './api';
import { session } from './session';
import { queryClient, clearPersistedCache } from './query';
import { authenticate, biometricAvailable, biometricEnabled, markAsked, setBiometricEnabled, wasAsked, biometricLabel } from './biometric';
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
}
interface AuthValue {
  status: Status;
  owner: Owner | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  unlock(): Promise<boolean>;
}

const Ctx = createContext<AuthValue | null>(null);
/** Verrouillage automatique après ce délai en arrière-plan. */
const RELOCK_AFTER_MS = 2 * 60 * 1000;

async function loadOwner(): Promise<Owner | null> {
  try {
    return await api<Owner>('/api/auth/me');
  } catch {
    return null; // hors connexion : les données en cache restent consultables
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [owner, setOwner] = useState<Owner | null>(null);
  const backgroundAt = useRef<number | null>(null);

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
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticate();
    if (ok) await resume();
    return ok;
  }, [resume]);

  useEffect(() => {
    setSignedOutHandler(() => {
      setOwner(null);
      setStatus('signedOut');
    });
    (async () => {
      const rt = await session.getRefresh();
      if (rt && (await biometricEnabled())) {
        setStatus('locked');
        return;
      }
      await resume();
    })();
  }, [resume]);

  // Re-verrouillage après un séjour prolongé en arrière-plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'background') backgroundAt.current = Date.now();
      if (s === 'active' && backgroundAt.current && Date.now() - backgroundAt.current > RELOCK_AFTER_MS) {
        backgroundAt.current = null;
        if (status === 'signedIn' && (await biometricEnabled())) {
          session.setAccess(null);
          setStatus('locked');
        }
      }
    });
    return () => sub.remove();
  }, [status]);

  const offerBiometric = useCallback(async () => {
    if ((await wasAsked()) || !(await biometricAvailable())) return;
    await markAsked();
    const kind = await biometricLabel();
    Alert.alert(`Activer la connexion par ${kind} ?`, 'Vous déverrouillerez l’application sans ressaisir votre mot de passe. Modifiable dans Paramètres › Sécurité.', [
      { text: 'Plus tard', style: 'cancel' },
      {
        text: 'Activer',
        onPress: async () => {
          if (await authenticate('Confirmez pour activer')) {
            await setBiometricEnabled(true);
            toast.success(`Connexion par ${kind} activée`);
          }
        },
      },
    ]);
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
      setTimeout(() => void offerBiometric(), 600);
    },
    [offerBiometric],
  );

  const value = useMemo(() => ({ status, owner, signIn, signOut, unlock }), [status, owner, signIn, signOut, unlock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider manquant');
  return v;
}
