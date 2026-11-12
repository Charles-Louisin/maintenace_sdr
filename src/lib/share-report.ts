import { Linking, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { get } from './api';

/** Télécharge le rapport (lien signé) puis ouvre la feuille de partage ; sur le web, téléchargement direct. */
export async function shareReport(id: string, fileName: string) {
  const { url } = await get<{ url: string }>(`/api/reports/monthly/${id}/download-url`);
  if (Platform.OS === 'web') {
    await Linking.openURL(url);
    return;
  }
  const target = new File(Paths.cache, fileName);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target, { idempotent: true });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dialogTitle: fileName,
      UTI: 'org.openxmlformats.wordprocessingml.document',
    });
  }
}
