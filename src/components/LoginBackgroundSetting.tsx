import { Image, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, api, del, errorMessage } from '../lib/api';
import { pickAndUploadImage } from '../lib/images';
import { toast } from './toast';
import { Button, Section } from './ui';
import { colors, radius, space } from '../theme/tokens';
import { UploadButton } from './UploadButton';

const DEFAULT_BG = require('../../assets/login-background.jpg');
const BG_CACHE = 'batis.loginBackground';

/** Image de fond de l'écran de connexion : aperçu avec le voile, changer ou revenir à l'image d'origine. */
export function LoginBackgroundSetting() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['branding'], queryFn: () => api<{ loginBackground: string | null }>('/api/public/branding', { auth: false }) });
  const url = q.data?.loginBackground ? `${API_URL}${q.data.loginBackground}` : null;

  const apply = async (next: string | null) => {
    qc.setQueryData(['branding'], { loginBackground: next });
    // L'écran de connexion lit cette adresse en premier : la nouvelle image s'affiche tout de suite
    if (next) await AsyncStorage.setItem(BG_CACHE, `${API_URL}${next}`).catch(() => undefined);
    else await AsyncStorage.removeItem(BG_CACHE).catch(() => undefined);
  };
  const choose = async () => {
    try {
      const r = await pickAndUploadImage<{ loginBackground: string }>(
        '/api/uploads/images/login-background',
        [9, 16],
        'Image de connexion',
        'Image de connexion enregistrée',
        'login-background',
      );
      if (!r) return;
      await apply(r.loginBackground);
    } catch {
      // erreur déjà signalée par un toast
    }
  };
  const reset = async () => {
    try {
      await del('/api/uploads/images/login-background');
      await apply(null);
      toast.success('Image d’origine rétablie');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Section title="Écran de connexion">
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <View style={{ width: 96, height: 170, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primaryDeep }}>
          <Image source={url ? { uri: url } : DEFAULT_BG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 2 }}>BATIS</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: space.sm }}>
          <UploadButton uploadKey="login-background" title={url ? 'Changer l’image' : 'Choisir une image'} icon="image-outline" onPress={() => void choose()} />
          {url ? <Button title="Image d’origine" variant="ghost" onPress={reset} /> : null}
        </View>
      </View>
    </Section>
  );
}
