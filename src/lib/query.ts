import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { MutationCache, QueryClient, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ApiError, errorMessage } from './api';
import { toast } from '../components/toast';

declare module '@tanstack/react-query' {
  interface Register {
    /** meta.success : toast affiché automatiquement quand l’action réussit */
    mutationMeta: { success?: string };
  }
}

// Détection réelle de la connexion pour TanStack Query
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))));

/**
 * Retour systématique des actions : toast de réussite (meta.success) et toast d’erreur
 * si l’écran ne gère pas lui-même l’échec. Aucune action ne se termine en silence.
 */
const mutationCache = new MutationCache({
  onSuccess: (_data, _vars, _ctx, mutation) => {
    if (mutation.meta?.success) toast.success(mutation.meta.success);
  },
  onError: (err, _vars, _ctx, mutation) => {
    if (!mutation.options.onError) toast.error(errorMessage(err));
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // données consultables hors connexion pendant 7 jours
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      networkMode: 'offlineFirst',
    },
    // Hors connexion : échec immédiat avec message, jamais un bouton qui tourne sans fin
    mutations: { networkMode: 'always' },
  },
});

/** Cache persistant : les données déjà chargées restent consultables sans connexion. */
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'sdr.query-cache', throttleTime: 2000 });

export async function clearPersistedCache() {
  await AsyncStorage.removeItem('sdr.query-cache');
}
