import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useGlobalSearchParams, usePathname, type Href } from 'expo-router';

/**
 * Mémoire de la dernière page : quand l'application est rouverte après fermeture (ou après le
 * verrouillage), on revient sur l'écran où l'on était, avec les onglets en dessous pour « Retour ».
 */
const KEY = 'batis.lastRoute';
const NEVER = /^\/(login|forgot-password)/;

function fullPath(pathname: string, params: Record<string, string | string[] | undefined>) {
  const segs = pathname.split('/').map((s) => decodeURIComponent(s));
  const query = Object.entries(params)
    .filter(([, v]) => typeof v === 'string' && v && !segs.includes(v))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
  return query ? `${pathname}?${query}` : pathname;
}

export function clearLastRoute() {
  AsyncStorage.removeItem(KEY).catch(() => undefined);
}

export function RouteMemory({ active, onRestored }: { active: boolean; onRestored: () => void }) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const restored = useRef(false);
  const current = fullPath(pathname, params);

  // Restauration, une fois par ouverture de session
  useEffect(() => {
    if (!active) {
      restored.current = false;
      return;
    }
    if (restored.current) return;
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        // Seulement si l’app s’ouvre sur l’accueil : un lien ou une notification gardent la priorité
        if (alive && pathname === '/' && saved && saved !== '/' && !NEVER.test(saved)) router.navigate(saved as Href);
      } catch {
        // stockage indisponible : on reste sur l'accueil
      }
      if (!alive) return;
      restored.current = true;
      onRestored();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à l'ouverture de la session
  }, [active]);

  // Enregistrement à chaque changement de page
  useEffect(() => {
    if (!active || !restored.current || NEVER.test(pathname)) return;
    AsyncStorage.setItem(KEY, current).catch(() => undefined);
  }, [active, current, pathname]);

  return null;
}
