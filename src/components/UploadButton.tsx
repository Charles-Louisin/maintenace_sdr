import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cancelUpload, useUpload } from '../lib/uploads';
import { Button, type IconName } from './ui';
import { colors, radius, space } from '../theme/tokens';

/**
 * Bouton qui lance un envoi : pendant l'envoi, il devient une barre de progression avec un bouton ✕
 * pour arrêter. L'envoi continue si l'on quitte la page ; en revenant, la progression s'affiche de nouveau.
 */
export function UploadButton({
  uploadKey,
  title,
  icon,
  onPress,
  variant = 'secondary',
  style,
}: {
  uploadKey: string;
  title: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const up = useUpload(uploadKey);
  if (!up) return <Button title={title} icon={icon} variant={variant} onPress={onPress} style={style} />;
  const pct = Math.round(up.progress * 100);
  return (
    <View
      style={[styles.box, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Envoi : ${pct} %`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.fill, { width: `${Math.max(4, pct)}%` }]} />
      <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
      <Text style={styles.text} numberOfLines={1}>
        Envoi… {pct} %
      </Text>
      <Pressable onPress={() => cancelUpload(up.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Arrêter l’envoi" style={styles.stop}>
        <Ionicons name="close" size={18} color={colors.danger} />
        <Text style={styles.stopText}>Arrêter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingLeft: 18,
    paddingRight: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(201, 162, 39, 0.22)' },
  text: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.primary, fontVariant: ['tabular-nums'] },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  stopText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
