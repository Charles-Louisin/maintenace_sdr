import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ApiError } from './api';

// Détection réelle de la connexion pour TanStack Query
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // données consultables hors connexion pendant 7 jours
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'online' },
  },
});

/** Cache persistant : les données déjà chargées restent consultables sans connexion. */
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'sdr.query-cache', throttleTime: 2000 });

export async function clearPersistedCache() {
  await AsyncStorage.removeItem('sdr.query-cache');
}
