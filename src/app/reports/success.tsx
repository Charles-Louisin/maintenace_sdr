import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { shareReport } from '../../lib/share-report';
import { errorMessage } from '../../lib/api';
import { plural } from '../../lib/format';
import { toast } from '../../components/toast';
import { Banner, Button } from '../../components/ui';
import { colors, motion, space } from '../../theme/tokens';

/**
 * Succès de génération du rapport : moment rare, l'animation de « délice » est permise ici
 * (pastille qui se pose, puis le texte) — une seule fois, désactivée en mouvement réduit.
 */
export default function ReportSuccess() {
  const { id, file, rows, notes } = useLocalSearchParams<{ id: string; file: string; rows?: string; notes?: string }>();
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const noteList = (notes ?? '').split('\n').filter(Boolean);

  const open = async () => {
    setBusy(true);
    try {
      await shareReport(id, file);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pop = reduced
    ? undefined
    : {
        animationName: { from: { opacity: 0, transform: [{ scale: 0.9 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } },
        animationDuration: 420,
        animationTimingFunction: motion.cssEaseOut,
        animationFillMode: 'both' as const,
      };
  const rise = reduced
    ? undefined
    : {
        animationName: { from: { opacity: 0, transform: [{ translateY: 10 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
        animationDuration: 420,
        animationDelay: 160,
        animationTimingFunction: motion.cssEaseOut,
        animationFillMode: 'both' as const,
      };

  return (
    <View style={styles.wrap}>
      <StatusBar style="dark" />
      <View style={{ alignItems: 'center', gap: space.xl }}>
        <Animated.View style={[styles.badge, pop]}>
          <Ionicons name="checkmark" size={52} color={colors.onPrimary} />
        </Animated.View>
        <Animated.View style={[{ alignItems: 'center', gap: space.sm }, rise]}>
          <Text style={styles.title}>Rapport généré avec succès</Text>
          <Text style={styles.file}>{file}</Text>
          <Text style={styles.meta}>{plural(Number(rows ?? 0), 'rubrique écrite', 'rubriques écrites')} dans votre modèle Word</Text>
        </Animated.View>
      </View>
      {noteList.length ? (
        <Banner tone="info" icon="information-circle-outline" title="À noter">
          {noteList.join('\n')}
        </Banner>
      ) : null}
      <View style={{ gap: space.md, alignSelf: 'stretch' }}>
        <Button title="Ouvrir / partager le fichier" icon="download-outline" onPress={open} loading={busy} />
        <Button title="Retour aux rapports" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'space-evenly', padding: space.xl },
  badge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 16px 40px rgba(45, 115, 80, 0.32)',
  },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, color: colors.text, textAlign: 'center' },
  file: { fontSize: 15, fontWeight: '600', color: colors.primary, textAlign: 'center' },
  meta: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
