import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, motion, radius, space } from '../theme/tokens';

/**
 * Toasts : confirmations non bloquantes (enregistré, validé, copié…).
 * Les confirmations d'actions irréversibles restent des boîtes de dialogue.
 * Pile de 3 au maximum, en haut de l'écran. Fermeture : glisser sur le côté (ou appuyer).
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

  const close = (id: number) => setItems((cur) => cur.filter((x) => x.id !== id));
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start', paddingTop: insets.top + space.sm, paddingHorizontal: space.lg }]}
    >
      {[...items].reverse().map((i) => (
        <Animated.View
          key={i.id}
          entering={reduced ? undefined : FadeInDown.duration(motion.base).easing(motion.easeOut)}
          exiting={reduced ? undefined : FadeOutUp.duration(motion.fast)}
          layout={reduced ? undefined : LinearTransition.duration(motion.base)}
          style={{ marginBottom: space.sm }}
        >
          <SwipeToast item={i} onClose={() => close(i.id)} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Un toast qui suit le doigt horizontalement ; lâché assez loin (ou d'un geste rapide), il sort de l'écran. */
function SwipeToast({ item, onClose }: { item: Item; onClose: () => void }) {
  const x = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX);
    },
    onDeactivate: (e) => {
      'worklet';
      const dx = e.translationX;
      if (Math.abs(dx) > 90 || Math.abs(e.velocityX) > 650) {
        const dir = Math.sign(dx || e.velocityX) || 1;
        x.set(
          withTiming(dir * 480, { duration: 180 }, (finished) => {
            if (finished) scheduleOnRN(onClose);
          }),
        );
      } else {
        x.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: e.velocityX }));
      }
    },
  });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: 1 - Math.min(Math.abs(x.get()) / 320, 0.7),
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>
        <Pressable
          onPress={onClose}
          accessibilityRole="alert"
          accessibilityLabel={item.message}
          accessibilityHint="Glisser sur le côté ou appuyer pour fermer"
          style={styles.toast}
        >
          <Ionicons name={ICON[item.tone]} size={20} color={TINT[item.tone]} />
          <Text style={styles.text}>{item.message}</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
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
