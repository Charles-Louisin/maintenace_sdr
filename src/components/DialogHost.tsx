import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import type { AlertButton } from 'react-native';
import { Button } from './ui';
import { colors, radius, space } from '../theme/tokens';

/**
 * Boîte de dialogue de l'application (confirmations : déconnexion, suppression, envoi…),
 * identique sur téléphone et sur le web — les fenêtres du navigateur peuvent être bloquées.
 */
interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let show: ((d: Omit<DialogRequest, 'id'>) => void) | null = null;
let nextId = 1;
/** Demandes faites avant que l'hôte soit prêt : affichées dès qu'il l'est (jamais de boîte système). */
let pending: Omit<DialogRequest, 'id'>[] = [];

export function showDialog(title: string, message?: string, buttons?: AlertButton[]) {
  const d = { title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] };
  if (show) show(d);
  else pending.push(d);
}

export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const reduced = useReducedMotion();
  useEffect(() => {
    show = (d) => setQueue((q) => [...q, { ...d, id: nextId++ }]);
    if (pending.length) {
      const waiting = pending;
      pending = [];
      Promise.resolve().then(() => waiting.forEach((d) => show?.(d)));
    }
    return () => {
      show = null;
    };
  }, []);
  const current = queue[0];
  const close = (b?: AlertButton) => {
    setQueue((q) => q.slice(1));
    // L'action est lancée après la fermeture, pour qu'une nouvelle boîte puisse s'ouvrir ensuite
    if (b?.onPress) setTimeout(() => b.onPress?.(), 0);
  };
  if (!current) return null;
  const cancel = current.buttons.find((b) => b.style === 'cancel');
  const actions = current.buttons.filter((b) => b.style !== 'cancel');

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close(cancel)} statusBarTranslucent>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(160)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(cancel)} accessibilityLabel="Fermer" />
        <Animated.View key={current.id} entering={reduced ? undefined : ZoomIn.duration(180)} style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {actions.map((b, i) => (
              <Button key={i} title={b.text ?? 'OK'} variant={b.style === 'destructive' ? 'danger' : 'primary'} onPress={() => close(b)} />
            ))}
            {cancel ? <Button title={cancel.text ?? 'Annuler'} variant="ghost" onPress={() => close(cancel)} /> : null}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 25, 20, 0.45)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.bg, borderRadius: radius.xl, borderCurve: 'continuous', padding: space.xl, gap: space.sm },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  message: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
});
