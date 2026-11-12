import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { colors, radius, space } from '../theme/tokens';

export interface FilterOption {
  value: string;
  label: string;
  /** Précision sous le libellé (ex. salle d'une assemblée) */
  hint?: string;
  /** Nombre d'éléments concernés */
  count?: number;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Bouton de filtre + panneau qui monte du bas.
 * - hauteur selon le contenu, plafonnée (≈ 2/3 de l'écran) : au-delà, la liste défile à l'intérieur ;
 * - se ferme en le glissant vers le bas (geste rapide ou au-delà d'un tiers), ou en touchant le fond ;
 * - entrée et sortie animées sur le fil d'interface ; choix multiple appliqué à « Afficher ».
 */
export function FilterSheet({
  label,
  title,
  options,
  selected,
  onChange,
}: {
  label: string;
  title?: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState('');
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const active = selected.length > 0;
  const maxH = Math.round(height * 0.66);

  // 0 = ouvert ; sheetH = caché sous l'écran
  const y = useSharedValue(height);
  const sheetH = useSharedValue(maxH);

  const shown = useMemo(() => {
    const q = norm(query.trim());
    return q ? options.filter((o) => norm(`${o.label} ${o.hint ?? ''}`).includes(q)) : options;
  }, [options, query]);

  const openSheet = () => {
    setDraft(selected);
    setQuery('');
    y.set(height);
    setVisible(true);
  };
  const animateIn = (h: number) => {
    sheetH.set(h);
    if (reduced) y.set(0);
    else y.set(withTiming(0, { duration: 320, easing: EASE_SHEET }));
  };
  const close = () => {
    if (reduced) return setVisible(false);
    y.set(
      withTiming(sheetH.get() + 40, { duration: 220, easing: EASE_OUT }, (finished) => {
        if (finished) scheduleOnRN(setVisible, false);
      }),
    );
  };
  const toggle = (v: string) => setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
  const apply = () => {
    onChange(draft);
    close();
  };

  // Glisser vers le bas (sur la poignée et l'en-tête) pour fermer
  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onUpdate: (e) => {
      'worklet';
      // Vers le haut : légère résistance ; vers le bas : suit le doigt
      y.set(e.translationY > 0 ? e.translationY : e.translationY * 0.15);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > sheetH.get() * 0.3 || e.velocityY > 800) {
        y.set(
          withTiming(sheetH.get() + 40, { duration: 200, easing: EASE_OUT }, (finished) => {
            if (finished) scheduleOnRN(setVisible, false);
          }),
        );
      } else {
        y.set(withSpring(0, { duration: 350, dampingRatio: 0.85, velocity: e.velocityY }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, Math.max(1, sheetH.get())], [1, 0], 'clamp'),
  }));

  const buttonLabel = active
    ? selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? label)
      : `${label} · ${selected.length}`
    : label;

  return (
    <>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`Filtrer : ${label}`}
        style={({ pressed }) => [styles.trigger, active && styles.triggerOn, pressed && { opacity: 0.75 }]}
      >
        <Text numberOfLines={1} style={[styles.triggerText, active && { color: colors.onPrimary }]}>
          {buttonLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={active ? colors.onPrimary : colors.textMuted} />
      </Pressable>

      <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        {/* Les gestes dans une fenêtre modale ont besoin de leur propre racine (Android) */}
        <GestureHandlerRootView style={styles.root}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer le panneau" />
          </Animated.View>
          <Animated.View
            onLayout={(e) => animateIn(e.nativeEvent.layout.height)}
            style={[styles.sheet, { maxHeight: maxH, paddingBottom: insets.bottom + space.md }, sheetStyle]}
          >
            <GestureDetector gesture={pan}>
              <View style={{ gap: space.md, paddingTop: space.sm }}>
                <View style={styles.grabber} />
                <View style={styles.head}>
                  <Text style={styles.title}>{title ?? label}</Text>
                  {draft.length ? (
                    <Pressable onPress={() => setDraft([])} hitSlop={10} accessibilityRole="button">
                      <Text style={styles.clear}>Tout effacer</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </GestureDetector>
            {options.length > 8 ? (
              <View style={styles.search}>
                <Ionicons name="search" size={16} color={colors.textFaint} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher"
                  placeholderTextColor={colors.textFaint}
                  style={styles.searchInput}
                  accessibilityLabel={`Rechercher dans ${label}`}
                />
              </View>
            ) : null}
            {/* Liste à la taille de son contenu ; elle défile seulement si le panneau atteint sa hauteur maximale */}
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingVertical: space.xs }} keyboardShouldPersistTaps="handled">
              {shown.map((o) => {
                const on = draft.includes(o.value);
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => toggle(o.value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
                  >
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.textFaint} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{o.label}</Text>
                      {o.hint ? <Text style={styles.rowHint}>{o.hint}</Text> : null}
                    </View>
                    {o.count !== undefined ? <Text style={styles.count}>{o.count}</Text> : null}
                  </Pressable>
                );
              })}
              {!shown.length ? <Text style={[styles.rowHint, { textAlign: 'center', padding: space.lg }]}>Aucun résultat</Text> : null}
            </ScrollView>
            <Button title={draft.length ? `Afficher (${draft.length} choisi${draft.length > 1 ? 's' : ''})` : 'Tout afficher'} onPress={apply} />
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    maxWidth: 220,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  triggerOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  triggerText: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(15, 25, 20, 0.4)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: 'continuous',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.surfaceDeep },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  clear: { fontSize: 14, fontWeight: '600', color: colors.primary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.sm, borderRadius: radius.md },
  rowLabel: { fontSize: 15, fontWeight: '500', color: colors.text },
  rowHint: { fontSize: 12, color: colors.textMuted },
  count: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
});
