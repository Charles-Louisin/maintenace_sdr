import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { HELMET_VB, HelmetBack, HelmetFront, Screwdriver, STAGE, Wrench } from './art';
import { colors } from '../../theme/tokens';

/** Géométrie de la scène : le casque se pose sur les outils, dont le haut entre dans l’ouverture. */
const HELMET_W = 200;
const HELMET_TOP = 0;
const TOOLS_TOP = 20;
const MOUTH_Y = HELMET_TOP + (HELMET_VB.mouthY * HELMET_W) / HELMET_VB.w;
const DROP = 300;
const CLIP_PAD = 200;

/**
 * Ouverture de BATIS, jouée une fois au démarrage, comme une courte vidéo :
 *  1. la clé arrive, puis le tournevis qui la croise ;
 *  2. le casque tombe et se pose sur eux (petit rebond, les outils encaissent le choc) ;
 *  3. si l'application charge encore, seuls les outils tournent en 3D sous le casque immobile ;
 *  4. dès que tout est prêt, les outils finissent leur tour, un filet doré se trace au centre
 *     et l'écran s'ouvre en deux sur la page (connexion, ou la dernière page ouverte).
 * Tout passe par transform / opacity sur le fil d'interface. Mouvement réduit : fondu simple.
 */

const INTRO_MS = 1750; // fin de la séquence d'arrivée
const SPIN_TURN_MS = 1500;
const REVEAL_MS = 1150;
const EASE_REVEAL = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function IntroOverlay({ ready, reveal, onDone }: { ready: boolean; reveal: SharedValue<number>; onDone: () => void }) {
  const reduced = useReducedMotion();
  const { height: H } = useWindowDimensions();
  const wrench = useSharedValue(reduced ? 1 : 0);
  const driver = useSharedValue(reduced ? 1 : 0);
  const helmet = useSharedValue(reduced ? 1 : 0);
  const impact = useSharedValue(0);
  const title = useSharedValue(reduced ? 1 : 0);
  const spin = useSharedValue(0);
  const [played, setPlayed] = useState(reduced);
  const spinning = useRef(false);
  const revealing = useRef(false);

  // 1–2. Arrivée des outils puis du casque
  useEffect(() => {
    if (reduced) return;
    wrench.set(withDelay(120, withSpring(1, { duration: 750, dampingRatio: 0.78 })));
    driver.set(withDelay(420, withSpring(1, { duration: 750, dampingRatio: 0.78 })));
    helmet.set(withDelay(860, withSpring(1, { duration: 820, dampingRatio: 0.52 })));
    // Le casque touche les outils vers 860 + ~300 ms : ils encaissent le choc
    impact.set(withDelay(1150, withSequence(withTiming(1, { duration: 90, easing: EASE_OUT }), withSpring(0, { duration: 450, dampingRatio: 0.45 }))));
    title.set(withDelay(1250, withTiming(1, { duration: 500, easing: EASE_OUT })));
    const t = setTimeout(() => setPlayed(true), INTRO_MS);
    return () => clearTimeout(t);
  }, [reduced, wrench, driver, helmet, impact, title]);

  // 3–4. Rotation d'attente, puis révélation
  useEffect(() => {
    if (!played || revealing.current) return;
    const startReveal = () => {
      reveal.set(
        withTiming(1, { duration: reduced ? 320 : REVEAL_MS, easing: reduced ? Easing.linear : EASE_REVEAL }, (finished) => {
          if (finished) scheduleOnRN(onDone);
        }),
      );
    };
    if (!ready) {
      if (!reduced && !spinning.current) {
        spinning.current = true;
        spin.set(withRepeat(withSequence(withTiming(360, { duration: SPIN_TURN_MS, easing: Easing.inOut(Easing.cubic) }), withTiming(0, { duration: 0 })), -1));
      }
      return;
    }
    revealing.current = true;
    if (spinning.current) {
      // Les outils terminent leur tour proprement avant l'ouverture
      cancelAnimation(spin);
      const at = spin.get() % 360;
      const left = 360 - at;
      spin.set(
        withTiming(360, { duration: Math.max(260, (left / 360) * 900), easing: EASE_OUT }, (finished) => {
          if (finished) scheduleOnRN(startReveal);
        }),
      );
    } else {
      startReveal();
    }
  }, [played, ready, reduced, reveal, spin, onDone]);

  const wrenchStyle = useAnimatedStyle(() => {
    const p = wrench.get();
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: (1 - p) * -170 }, { translateY: (1 - p) * 120 }, { rotate: `${(1 - p) * -100}deg` }],
    };
  });
  const driverStyle = useAnimatedStyle(() => {
    const p = driver.get();
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: (1 - p) * 170 }, { translateY: (1 - p) * 120 }, { rotate: `${(1 - p) * 100}deg` }],
    };
  });
  // Tout l’ensemble encaisse le choc quand le casque se pose
  const assemblyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: impact.get() * 6 }] }));
  const helmetStyle = useAnimatedStyle(() => {
    const p = helmet.get();
    return {
      opacity: interpolate(p, [0, 0.15], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - p) * -DROP }],
    };
  });
  // Fenêtre qui suit l’ouverture du casque : au-dessus, les outils sont DANS le casque (cachés)
  const clipStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - helmet.get()) * -DROP }] }));
  const toolsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - helmet.get()) * DROP }, { perspective: 700 }, { rotateY: `${spin.get()}deg` }],
  }));
  const shadowStyle = useAnimatedStyle(() => {
    const tools = (Math.min(wrench.get(), 1) + Math.min(driver.get(), 1)) / 2;
    return {
      opacity: tools * 0.9,
      transform: [{ scaleX: 0.6 + tools * 0.3 + Math.min(helmet.get(), 1) * 0.1 + impact.get() * 0.08 }],
    };
  });
  const titleStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    return {
      opacity: title.get() * interpolate(r, [0, 0.2], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - title.get()) * 14 + interpolate(r, [0, 0.25], [0, 10], Extrapolation.CLAMP) }],
    };
  });
  // Le logo s'avance vers l'écran et s'efface pendant que l'écran s'ouvre
  const logoStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    if (reduced) return { opacity: 1 - r };
    return {
      opacity: interpolate(r, [0, 0.3, 0.6], [1, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(r, [0, 0.3, 1], [1, 1.1, 2.6]) }],
    };
  });
  const topStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    if (reduced) return { opacity: 1 - r };
    return { transform: [{ translateY: interpolate(r, [0.38, 1], [0, -H / 2 - 24], Extrapolation.CLAMP) }] };
  });
  const bottomStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    if (reduced) return { opacity: 1 - r };
    return { transform: [{ translateY: interpolate(r, [0.38, 1], [0, H / 2 + 24], Extrapolation.CLAMP) }] };
  });
  // Filet doré : se trace depuis le centre, puis se sépare avec les deux volets
  const seamStyle = useAnimatedStyle(() => {
    const r = reveal.get();
    return {
      opacity: reduced ? 0 : interpolate(r, [0.08, 0.16, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [{ scaleX: interpolate(r, [0.08, 0.4], [0, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto" accessibilityRole="progressbar" accessibilityLabel="Chargement de BATIS">
      <StatusBar style="dark" />
      <Animated.View style={[styles.panel, { top: 0, height: H / 2 + 1 }, topStyle]}>
        <Animated.View style={[styles.seam, { bottom: 0 }, seamStyle]} />
      </Animated.View>
      <Animated.View style={[styles.panel, { top: H / 2, height: H / 2 + 1 }, bottomStyle]}>
        <Animated.View style={[styles.seam, { top: 0 }, seamStyle]} />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <Animated.View style={[styles.stage, logoStyle]}>
          <Animated.View style={[styles.shadow, shadowStyle]} />
          <Animated.View style={[StyleSheet.absoluteFill, assemblyStyle]}>
            <Animated.View style={[styles.helmet, helmetStyle]}>
              <HelmetBack width={HELMET_W} />
            </Animated.View>
            <Animated.View style={[styles.clip, clipStyle]}>
              <Animated.View style={[styles.tools, toolsStyle]}>
                <Animated.View style={[StyleSheet.absoluteFill, wrenchStyle]}>
                  <Wrench />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, driverStyle]}>
                  <Screwdriver />
                </Animated.View>
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.helmet, helmetStyle]}>
              <HelmetFront width={HELMET_W} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <Text style={styles.title}>BATIS</Text>
          <Text style={styles.subtitle}>Maintenance des Salles du Royaume</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.bg, overflow: 'visible' },
  seam: { position: 'absolute', left: '8%', right: '8%', height: 2, borderRadius: 1, backgroundColor: colors.gold },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  stage: { width: STAGE, height: STAGE + 24 },
  clip: { position: 'absolute', top: MOUTH_Y, left: -CLIP_PAD, width: STAGE + CLIP_PAD * 2, height: STAGE + DROP, overflow: 'hidden' },
  tools: { position: 'absolute', top: TOOLS_TOP - MOUTH_Y, left: CLIP_PAD, width: STAGE, height: STAGE },
  helmet: { position: 'absolute', top: HELMET_TOP, left: (STAGE - HELMET_W) / 2 },
  shadow: {
    position: 'absolute',
    bottom: -4,
    left: STAGE / 2 - 80,
    width: 160,
    height: 16,
    borderRadius: 80,
    backgroundColor: 'rgba(80, 52, 10, 0.16)',
  },
  titleWrap: { alignItems: 'center', gap: 6, marginTop: 28 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: 4, color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, letterSpacing: 0.4 },
});
