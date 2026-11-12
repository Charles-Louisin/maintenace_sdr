import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import { startUpload } from './uploads';
import type { Venue } from './types';

/**
 * Choisit une photo dans la galerie et l'envoie au serveur (salle, profil, fond de connexion).
 * Renvoie null si l'utilisateur annule. La photo est recadrée et compressée sur le téléphone.
 */
export async function pickAndUploadImage<T>(path: string, aspect: [number, number], label = 'Photo', successMessage?: string, key = path): Promise<T | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.75 });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const form = new FormData();
  // Web : objet File fourni par le sélecteur ; téléphone : { uri, name, type }
  if (a.file) form.append('file', a.file, a.fileName ?? 'photo.jpg');
  else form.append('file', { uri: a.uri, name: a.fileName ?? 'photo.jpg', type: a.mimeType ?? 'image/jpeg' } as unknown as Blob);
  return startUpload<T>({ key, label, path, form, successMessage });
}

/** Salle complète (photo, mode semaine…) à partir de son identifiant. */
export function useVenueLookup() {
  const q = useQuery({ queryKey: ['venues'], queryFn: () => get<Venue[]>('/api/venues'), staleTime: 5 * 60_000 });
  const map = new Map((q.data ?? []).map((v) => [v._id, v]));
  return (venueId: string | null | undefined) => (venueId ? (map.get(venueId) ?? null) : null);
}

/** Photo de chaque salle (identifiant → adresse), à partir de la liste des salles déjà en cache. */
export function useVenueImages() {
  const q = useQuery({ queryKey: ['venues'], queryFn: () => get<Venue[]>('/api/venues'), staleTime: 5 * 60_000 });
  const map = new Map((q.data ?? []).map((v) => [v._id, v.imageUrl ?? null]));
  return (venueId: string | null | undefined) => (venueId ? (map.get(venueId) ?? null) : null);
}
