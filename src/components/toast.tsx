import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, motion, radius, space } from '../theme/tokens';

/**
 * Toasts : confirmations non bloquantes (enregistré, validé, copié…).
 * Les confirmations d'actions irréversibles restent des boîtes de dialogue.
 * Pile de 3 au maximum, au-dessus de la barre d'onglets ; glisser n'est pas nécessaire : un appui ferme.
 */
type Tone = 'success' | 'error' | 'info';
interface Item {
  id: number;
  message: string;
  tone: Tone;
}

let push: ((i: Omit<Item, 'id'>) => void) | null = null;
let nextId = 1;

function show(message: string, tone: Tone) {
  push?.({ message, tone });
  if (Platform.OS !== 'web' && tone !== 'info') {
    Haptics.notificationAsync(tone === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }
}

export const toast = {
  success: (m: string) => show(m, 'success'),
  error: (m: string) => show(m, 'error'),
  info: (m: string) => show(m, 'info'),
};

const ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' };
const TINT: Record<Tone, string> = { success: '#8FD3A9', error: '#F2A79C', info: '#B9CDE2' };

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  useEffect(() => {
    push = (i) => {
      const id = nextId++;
      setItems((cur) => [...cur.slice(-2), { ...i, id }]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), i.tone === 'error' ? 5000 : 3200);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', paddingBottom: insets.bottom + 76, paddingHorizontal: space.lg }]}>
      {items.map((i) => (
        <Animated.View
          key={i.id}
          entering={reduced ? undefined : FadeInUp.duration(motion.base).easing(motion.easeOut)}
          exiting={reduced ? undefined : FadeOutDown.duration(motion.fast)}
          layout={reduced ? undefined : LinearTransition.duration(motion.base)}
          style={{ marginTop: space.sm }}
        >
          <Pressable
            onPress={() => setItems((cur) => cur.filter((x) => x.id !== i.id))}
            accessibilityRole="alert"
            accessibilityLabel={i.message}
            style={styles.toast}
          >
            <Ionicons name={ICON[i.tone]} size={20} color={TINT[i.tone]} />
            <Text style={styles.text}>{i.message}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    boxShadow: '0 12px 28px rgba(19, 42, 31, 0.28)',
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  text: { color: colors.onPrimary, fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 19 },
});
