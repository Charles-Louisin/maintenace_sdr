import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { checkNotificationPermission, type PermissionCheck } from '../lib/notifications';
import { Button } from './ui';
import { colors, motion, radius, space } from '../theme/tokens';

/**
 * Les rappels d'appels (J-5 à 9 h, suivi le lendemain) n'ont de sens que si le téléphone peut les afficher.
 * À l'ouverture, l'autorisation est demandée ; l'application ne continue qu'une fois acceptée.
 * Si l'invite système a été refusée définitivement, on renvoie vers les réglages et on revérifie au retour.
 */
export function useNotificationGate() {
  const [perm, setPerm] = useState<PermissionCheck | null>(null);
  const [asking, setAsking] = useState(false);

  const check = useCallback(async (ask: boolean) => {
    setAsking(ask);
    setPerm(await checkNotificationPermission(ask));
    setAsking(false);
  }, []);

  // Première ouverture : l'invite système s'affiche directement.
  useEffect(() => {
    let alive = true;
    checkNotificationPermission(true).then((p) => alive && setPerm(p));
    return () => {
      alive = false;
    };
  }, []);

  // Retour depuis les réglages du téléphone : nouvelle vérification, sans invite.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check(false);
    });
    return () => sub.remove();
  }, [check]);

  /** null : vérification en cours (le chargeur de démarrage reste affiché). */
  const passed = perm ? perm.state === 'granted' || perm.state === 'unsupported' : null;
  return { perm, passed, asking, check };
}

/** Écran bloquant tant que les notifications ne sont pas autorisées. */
export function NotificationGate({ perm, asking, check }: { perm: PermissionCheck; asking: boolean; check: (ask: boolean) => void }) {
  return (
    <Animated.View style={styles.wrap} entering={FadeIn.duration(motion.base)}>
      <StatusBar style="dark" />
      <View style={styles.badge}>
        <Ionicons name="notifications-outline" size={34} color={colors.primary} />
      </View>
      <View style={{ gap: space.sm, alignItems: 'center' }}>
        <Text style={styles.title}>Autoriser les notifications</Text>
        <Text style={styles.text}>
          L’application vous rappelle chaque appel à transmettre : 5 jours avant les travaux à 9 h, puis le suivi le lendemain. Sans notifications, ces rappels
          ne peuvent pas vous parvenir.
        </Text>
      </View>
      <View style={{ gap: space.md, alignSelf: 'stretch' }}>
        {perm.canAskAgain ? (
          <Button title="Autoriser" icon="checkmark" onPress={() => check(true)} loading={asking} />
        ) : (
          <>
            <Text style={[styles.text, { fontSize: 13 }]}>
              Les notifications ont été refusées. Activez-les dans les réglages du téléphone, puis revenez ici.
            </Text>
            <Button title="Ouvrir les réglages" icon="settings-outline" onPress={() => Linking.openSettings()} />
            <Button title="J’ai activé, vérifier" variant="ghost" onPress={() => check(false)} />
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    padding: space.xl,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.text,
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
