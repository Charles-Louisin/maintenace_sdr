import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { colors, motion, radius, shadow, space, type as t, toneColors, type Tone } from '../theme/tokens';

export type IconName = keyof typeof Ionicons.glyphMap;

/* ───────────────────────── Mise en page ───────────────────────── */

export function Screen({
  children,
  refreshing,
  onRefresh,
  padded = true,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
}) {
  return (
    <View style={styles.flex}>
      {/* Le champ en cours de saisie reste toujours visible au-dessus du clavier (et du pied de page) */}
      <KeyboardAwareScrollView
        bottomOffset={footer ? 110 : 24}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[padded && styles.screenPad, { gap: space.xl }]}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
        }
      >
        {children}
      </KeyboardAwareScrollView>
      {footer ? (
        <KeyboardStickyView>
          <View style={styles.footer}>{footer}</View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

/** Groupe vertical : espacement intra-groupe plus serré que l'espacement entre sections. */
export function Stack({ children, gap = 'md', style }: { children: ReactNode; gap?: keyof typeof space; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap: space[gap] }, style]}>{children}</View>;
}

/* ───────────────────────── Typographie ───────────────────────── */

export function Display({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[t.display, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}
export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[t.title, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}
export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[t.h2, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}
export function H3({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[t.h3, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function Body({
  children,
  style,
  numberOfLines,
  selectable,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  return (
    <Text style={[t.body, style]} numberOfLines={numberOfLines} selectable={selectable}>
      {children}
    </Text>
  );
}
export function Small({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[t.small, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[t.label, style]}>{children}</Text>;
}

/* ───────────────────────── Surfaces ───────────────────────── */

/** Carte : surface chaude ; pression = léger assombrissement (une rangée ne « rebondit » pas). */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceAlt }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Carte sombre « héros » (prochaine intervention, synthèse) — une seule par écran.
 * Avec `image` (photo de la salle) : la photo remplit la carte sous un voile sombre, le texte reste lisible.
 */
export function HeroCard({
  children,
  onPress,
  style,
  image,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  image?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.hero, pressed && { backgroundColor: colors.primaryPressed }, style]}
    >
      {image ? (
        <>
          <Image source={{ uri: image }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, styles.heroVeil]} />
        </>
      ) : null}
      {children}
    </Pressable>
  );
}

/** Vignette de salle (comme une photo de profil) : la photo de la salle, sinon une icône. */
export function VenueThumb({ image, size = 44, radiusSize }: { image?: string | null; size?: number; radiusSize?: number }) {
  const r = radiusSize ?? Math.round(size * 0.28);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {image ? (
        <Image source={{ uri: image }} style={{ width: size, height: size }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Ionicons name="business" size={Math.round(size * 0.45)} color={colors.primary} />
      )}
    </View>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.sectionHead}>
        <Label>{title}</Label>
        {action}
      </View>
      {children}
    </View>
  );
}

/* ───────────────────────── Actions ───────────────────────── */

/**
 * Action d'un bouton : si elle renvoie une promesse, le bouton passe en chargement
 * et n'accepte plus aucun appui jusqu'à la fin (pas de double envoi).
 */
function usePressAction(onPress: (() => unknown) | undefined, blocked: boolean) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = () => {
    if (!onPress || blocked || running.current) return;
    const result = onPress();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      running.current = true;
      setBusy(true);
      (result as Promise<unknown>)
        .catch(() => undefined)
        .finally(() => {
          running.current = false;
          if (mounted.current) setBusy(false);
        });
    }
  };
  return { busy, run };
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp' | 'light';
const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  whatsapp: { bg: colors.whatsapp, fg: '#FFFFFF', border: colors.whatsapp },
  light: { bg: colors.onPrimary, fg: colors.primary, border: colors.onPrimary },
};

/** Bouton : retour au toucher immédiat (échelle 0,97 en 120 ms, sur le fil UI). */
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
  style,
}: {
  title: string;
  onPress?: () => unknown;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const action = usePressAction(onPress, Boolean(disabled || loading));
  const isLoading = Boolean(loading || action.busy);
  const off = Boolean(disabled || isLoading);
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  return (
    <Pressable
      onPress={off ? undefined : action.run}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: off, busy: isLoading }}
      style={[compact ? undefined : styles.btnFull, style]}
    >
      <Animated.View
        style={[
          styles.btn,
          compact && styles.btnCompact,
          { backgroundColor: v.bg, borderColor: v.border, opacity: off ? 0.5 : 1 },
          {
            transform: [{ scale: pressed && !off && !reduced ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: motion.fast,
            transitionTimingFunction: 'ease-out',
          },
        ]}
      >
        {isLoading ? <Spinner color={v.fg} /> : icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={v.fg} /> : null}
        <Text style={{ color: v.fg, fontSize: compact ? 14 : 15, fontWeight: '600', letterSpacing: 0.1 }}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Bouton rond à icône (44 pt minimum) — libellé d'accessibilité obligatoire. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'neutral',
  size = 44,
  loading,
}: {
  icon: IconName;
  label: string;
  onPress?: () => unknown;
  tone?: Tone | 'onDark';
  size?: number;
  loading?: boolean;
}) {
  const action = usePressAction(onPress, Boolean(loading));
  const isLoading = Boolean(loading || action.busy);
  const c = tone === 'onDark' ? { bg: 'rgba(248,244,236,0.12)', fg: colors.onPrimary } : toneColors[tone];
  return (
    <Pressable
      onPress={isLoading ? undefined : action.run}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: isLoading, disabled: isLoading }}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.bg,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {isLoading ? <Spinner color={c.fg} size={Math.round(size * 0.4)} /> : <Ionicons name={icon} size={Math.round(size * 0.45)} color={c.fg} />}
    </Pressable>
  );
}

/** Petit indicateur d'activité rotatif (CSS animation Reanimated, sur le fil UI). */
export function Spinner({ color = colors.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        borderTopColor: 'transparent',
        animationName: { from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } },
        animationDuration: 700,
        animationIterationCount: 'infinite',
        animationTimingFunction: 'linear',
      }}
    />
  );
}

/* ───────────────────────── Statuts ───────────────────────── */

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Banner({
  tone = 'warning',
  icon = 'alert-circle',
  title,
  children,
  action,
}: {
  tone?: Tone;
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const c = toneColors[tone];
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={20} color={c.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.fg, fontWeight: '700', fontSize: 14 }}>{title}</Text>
        {typeof children === 'string' ? <Text style={{ color: c.fg, fontSize: 13, lineHeight: 19, opacity: 0.9 }}>{children}</Text> : children}
        {action}
      </View>
    </View>
  );
}

/* ───────────────────────── Formulaires ───────────────────────── */

/**
 * Champ de saisie. En multiligne, il commence sur UNE ligne et s’agrandit pendant l’écriture (le moins de place possible).
 * Sans libellé (label=""), seul le texte indicatif est affiché.
 */
export function Field({
  label,
  error,
  hint,
  style,
  multiline,
  onFocus,
  onBlur,
  onContentSizeChange,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  const [contentH, setContentH] = useState(0);
  return (
    <View style={{ gap: space.sm }}>
      {label ? <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        multiline={multiline}
        onContentSizeChange={(e) => {
          if (multiline && Platform.OS === 'web') setContentH(e.nativeEvent.contentSize.height);
          onContentSizeChange?.(e);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          // Natif : le champ multiligne grandit seul ; web : hauteur suivie (scrollHeight inclut déjà les marges internes)
          multiline &&
            (Platform.OS === 'web'
              ? { textAlignVertical: 'top', height: Math.min(Math.max(52, contentH + 3), 220) }
              : { textAlignVertical: 'top', maxHeight: 220 }),
          focused && { borderColor: colors.primary, backgroundColor: colors.surface },
          error && { borderColor: colors.danger },
          style,
        ]}
        {...props}
      />
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

/* ───────────────────────── Listes ───────────────────────── */

export function Row({
  title,
  subtitle,
  icon,
  right,
  onPress,
  danger,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {icon ? (
        <View style={[styles.iconTile, danger && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, color: danger ? colors.danger : colors.text, fontWeight: '600' }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Small numberOfLines={2}>{subtitle}</Small> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />;
}

/** Segmenté avec indicateur glissant (élément absolu sans enfant : seule exception autorisée à une largeur animée). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const [w, setW] = useState(0);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segW = w ? (w - 8) / options.length : 0;
  return (
    <View style={styles.segmented} accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {segW ? (
        <Animated.View
          style={[
            styles.segmentPill,
            {
              width: segW,
              transform: [{ translateX: idx * segW }],
              transitionProperty: 'transform',
              transitionDuration: motion.base,
              transitionTimingFunction: motion.cssEaseOut,
            },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.segment}>
            <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? colors.onPrimary : colors.textMuted }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      style={({ pressed }) => [styles.chip, active && { backgroundColor: colors.primary }, pressed && !active && { backgroundColor: colors.surfaceDeep }]}
    >
      <Text style={{ fontSize: 13, color: active ? colors.onPrimary : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Carte repliable : en-tête toujours visible (titre, compteur, chevron), contenu replié/déplié.
 * Ouverture : fondu court + reflux de la liste (LinearTransition) ; aucune hauteur animée.
 */
export function Collapsible({
  title,
  subtitle,
  meta,
  open,
  onToggle,
  children,
  tone = 'neutral',
  virtualized = false,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  tone?: Tone;
  /** Ligne d'une FlatList : pas d'animation de mise en page (jamais sur une ligne virtualisée). */
  virtualized?: boolean;
}) {
  const reduced = useReducedMotion() || virtualized;
  const accent = toneColors[tone];
  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.duration(motion.base).easing(motion.easeOut)} style={styles.collapse}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}, ${open ? 'replier' : 'déplier'}`}
        style={({ pressed }) => [styles.collapseHead, pressed && { backgroundColor: colors.surfaceAlt }]}
      >
        <View style={[styles.collapseDot, { backgroundColor: accent.fg }]} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[t.h3]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Small numberOfLines={1}>{subtitle}</Small> : null}
        </View>
        {meta}
        <Animated.View
          style={{
            transform: [{ rotate: open ? '180deg' : '0deg' }],
            transitionProperty: 'transform',
            transitionDuration: motion.base,
            transitionTimingFunction: motion.cssEaseOut,
          }}
        >
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(motion.base)}
          exiting={reduced ? undefined : FadeOut.duration(motion.fast)}
          style={styles.collapseBody}
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Barre « Tout replier / Tout déplier » pour garder une vue d'ensemble. */
export function FoldBar({ count, allOpen, onToggleAll, label }: { count: number; allOpen: boolean; onToggleAll: () => void; label: string }) {
  return (
    <View style={styles.foldBar}>
      <Small style={{ color: colors.textMuted }}>{label}</Small>
      {count > 0 ? (
        <Pressable onPress={onToggleAll} accessibilityRole="button" hitSlop={10} style={({ pressed }) => [styles.foldBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name={allOpen ? 'contract-outline' : 'expand-outline'} size={15} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>{allOpen ? 'Tout replier' : 'Tout déplier'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ───────────────────────── Chargement & états vides ───────────────────────── */

/** Bloc squelette : pulsation douce d'opacité (pas de spinner plein écran). */
export function Skeleton({
  width = '100%',
  height = 14,
  radius: r = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.surfaceDeep },
        reduced
          ? { opacity: 0.7 }
          : {
              animationName: { from: { opacity: 0.45 }, to: { opacity: 0.9 } },
              animationDuration: 900,
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationTimingFunction: 'ease-in-out',
            },
        style,
      ]}
    />
  );
}

/** Squelette d'une liste de cartes (même gabarit que le contenu réel : pas de saut à l'affichage). */
export function Loading({ label = 'Chargement…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <View style={[styles.screenPad, { gap: space.lg }]} accessibilityLabel={label} accessibilityRole="progressbar">
      <Skeleton width="45%" height={22} />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.card, { gap: space.md }]}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="85%" />
          <Skeleton width="40%" />
        </View>
      ))}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.warningSoft }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.warning} />
      </View>
      <Body style={{ textAlign: 'center', color: colors.textMuted, maxWidth: 300 }}>{message}</Body>
      {onRetry ? <Button title="Réessayer" variant="secondary" compact onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ icon = 'leaf-outline', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={[styles.center, { paddingVertical: space.xxl }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <H3 style={{ textAlign: 'center' }}>{title}</H3>
      {text ? <Small style={{ textAlign: 'center', maxWidth: 280 }}>{text}</Small> : null}
      {action}
    </View>
  );
}

/* ───────────────────────── Données ───────────────────────── */

/** Tuile de chiffre clé : icône en pastille, grand nombre, libellé sur une ligne. */
export function Stat({
  value,
  label,
  tone = 'neutral',
  icon,
  onPress,
}: {
  value: number | string;
  label: string;
  tone?: Tone;
  icon: IconName;
  onPress?: () => void;
}) {
  const c = toneColors[tone];
  return (
    <Card style={styles.stat} onPress={onPress} accessibilityLabel={`${value} ${label}`}>
      <View style={[styles.iconTile, { backgroundColor: c.bg }]}>
        <Ionicons name={icon} size={17} color={c.fg} />
      </View>
      <Text style={t.number} numberOfLines={1} adjustsFontSizeToFit>
        {String(value).replace(' ', ' ')}
      </Text>
      <Small numberOfLines={1}>{label}</Small>
    </Card>
  );
}

/** Rangée de chiffres clés défilant de gauche à droite : les tuiles gardent leur largeur, le texte ne se coupe jamais. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={STAT_W + space.md}
      style={styles.statRow}
      contentContainerStyle={styles.statRowContent}
    >
      {children}
    </ScrollView>
  );
}

export function KeyValue({ label, value, missing, suffix }: { label: string; value?: string | null; missing?: boolean; suffix?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: 6, alignItems: 'center' }}>
      <Small style={{ width: 110 }}>{label}</Small>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Body style={[{ flexShrink: 1, fontWeight: '500' }, (missing || !value) && { color: colors.danger }]} selectable>
          {value || 'Information manquante'}
        </Body>
        {value ? suffix : null}
      </View>
    </View>
  );
}

/** Interrupteur « ce numéro est sur WhatsApp » : logo vert quand oui, gris barré quand non. */
export function WaToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel="Numéro WhatsApp"
      accessibilityState={{ checked: on }}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: on ? colors.whatsapp : colors.border,
        backgroundColor: on ? 'rgba(31,143,78,0.10)' : colors.surface,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name="logo-whatsapp" size={18} color={on ? colors.whatsapp : colors.textFaint} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? colors.whatsapp : colors.textFaint, textDecorationLine: on ? 'none' : 'line-through' }}>
        WA
      </Text>
    </Pressable>
  );
}

/** Petit logo WhatsApp : le numéro du frère est joignable sur WhatsApp. */
export function WaMark({ size = 14 }: { size?: number }) {
  return <Ionicons name="logo-whatsapp" size={size} color={colors.whatsapp} accessibilityLabel="Numéro WhatsApp" />;
}

/** Pastille d'initiales (aucune photo n'est stockée pour les frères). */
export function Avatar({ name, size = 44, tone = 'primary', image }: { name: string; size?: number; tone?: Tone; image?: string | null }) {
  if (image) {
    return (
      <Image
        source={{ uri: image }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceDeep }}
        resizeMode="cover"
        accessibilityLabel={name}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const c = toneColors[tone];
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
    >
      <Text style={{ color: c.fg, fontWeight: '700', fontSize: Math.round(size * 0.36) }}>{initials || '?'}</Text>
    </View>
  );
}

const STAT_W = 164;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screenPad: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space.lg,
    gap: space.sm,
    ...shadow.card,
  },
  heroVeil: { backgroundColor: 'rgba(12, 24, 18, 0.62)' },
  hero: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: space.xl,
    gap: space.sm,
    overflow: 'hidden',
    ...shadow.raised,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  btnFull: { alignSelf: 'stretch' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 22,
    minHeight: 52,
  },
  btnCompact: { paddingVertical: 9, paddingHorizontal: 16, minHeight: 40 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  banner: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'flex-start' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    minHeight: 52,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.sm, borderRadius: radius.sm },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  segmentPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.pill, backgroundColor: colors.primary },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  collapse: { backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', ...shadow.card },
  collapseHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, minHeight: 60 },
  collapseDot: { width: 8, height: 8, borderRadius: 4 },
  collapseBody: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm },
  foldBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stat: { width: STAT_W, gap: space.sm, padding: space.lg },
  statRow: { marginHorizontal: -space.lg, flexGrow: 0 },
  statRowContent: { paddingHorizontal: space.lg, paddingVertical: 4, gap: space.md },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: space.sm,
  },
});
