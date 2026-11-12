import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Jetons d'authentification : le jeton de renouvellement est stocké dans le trousseau sécurisé
 * (Keychain / Keystore) ; le jeton d'accès reste en mémoire uniquement.
 */
const REFRESH_KEY = 'sdr.refreshToken';
let accessToken: string | null = null;

/**
 * Web : sessionStorage (survit au rechargement de l'onglet, effacé à sa fermeture ; jamais localStorage).
 * Téléphone : trousseau sécurisé (Keychain / Keystore).
 */
const web = {
  get: (k: string) => {
    try {
      return window.sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      window.sessionStorage.setItem(k, v);
    } catch {
      /* stockage indisponible : session limitée à la page */
    }
  },
  del: (k: string) => {
    try {
      window.sessionStorage.removeItem(k);
    } catch {
      /* ignoré */
    }
  },
};
const store = {
  async get(k: string) {
    if (Platform.OS === 'web') return web.get(k);
    return SecureStore.getItemAsync(k);
  },
  async set(k: string, v: string) {
    if (Platform.OS === 'web') return web.set(k, v);
    await SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async del(k: string) {
    if (Platform.OS === 'web') return web.del(k);
    await SecureStore.deleteItemAsync(k);
  },
};

export const session = {
  getAccess: () => accessToken,
  setAccess: (t: string | null) => {
    accessToken = t;
  },
  getRefresh: () => store.get(REFRESH_KEY),
  setRefresh: (t: string) => store.set(REFRESH_KEY, t),
  async clear() {
    accessToken = null;
    await store.del(REFRESH_KEY);
  },
};
