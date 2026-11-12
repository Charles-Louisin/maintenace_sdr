import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { colors, motion, radius, space } from '../theme/tokens';

/** Logo officiel BATIS (casque et outils), dans une tuile arrondie. */
const LOGO = require('../../assets/logo.png');

export function Emblem({ size = 64, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <Image
      source={LOGO}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        borderCurve: 'continuous',
        borderWidth: onDark ? 1.5 : 0,
        borderColor: 'rgba(255,255,255,0.35)',
      }}
      accessibilityLabel="Logo BATIS"
    />
  );
}

/**
 * Chargeur de démarrage (moment rare : la « dose de délice » est permise ici).
 * Emblème qui se pose (opacité + échelle 0,94 → 1, une seule fois) et filet doré indéterminé.
 * Mouvement réduit : affichage statique.
 */
export function BrandLoader({ label = 'Préparation de votre espace…' }: { label?: string }) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Animated.View
        style={
          reduced
            ? undefined
            : {
                animationName: { from: { opacity: 0, transform: [{ scale: 0.94 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
                animationDuration: 520,
                animationTimingFunction: motion.cssEaseOut,
                animationFillMode: 'both',
              }
        }
      >
        <Emblem size={84} />
      </Animated.View>
      <Animated.View
        style={[
          { alignItems: 'center', gap: 6 },
          reduced
            ? undefined
            : {
                animationName: { from: { opacity: 0, transform: [{ translateY: 8 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
                animationDuration: 520,
                animationDelay: 140,
                animationTimingFunction: motion.cssEaseOut,
                animationFillMode: 'both',
              },
        ]}
      >
        <Text style={styles.title}>BATIS</Text>
        <Text style={styles.subtitle}>Maintenance des Salles du Royaume</Text>
      </Animated.View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            reduced
              ? { left: '30%' }
              : {
                  animationName: { from: { transform: [{ translateX: -80 }] }, to: { transform: [{ translateX: 160 }] } },
                  animationDuration: 1100,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                },
          ]}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, letterSpacing: 0.3 },
  track: { width: 160, height: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceDeep, overflow: 'hidden', marginTop: space.md },
  bar: { position: 'absolute', top: 0, bottom: 0, width: 80, borderRadius: radius.pill, backgroundColor: colors.gold },
  label: { fontSize: 12, color: colors.textFaint, letterSpacing: 0.2 },
});
