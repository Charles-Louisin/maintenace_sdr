import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmtPhone, isWhatsapp } from '../lib/format';
import { toast } from './toast';
import { Button, IconButton, WaMark } from './ui';
import { colors, radius, space } from '../theme/tokens';

type ContactLike = { fullName: string; phones: string[]; whatsappPhones?: string[] };
type Mode = 'call' | 'whatsapp';

async function open(mode: Mode, phone: string) {
  const digits = phone.replace(/\D/g, '');
  try {
    await Linking.openURL(mode === 'call' ? `tel:+${digits}` : `https://wa.me/${digits}`);
  } catch {
    toast.error(mode === 'call' ? 'Appel impossible sur cet appareil' : 'WhatsApp introuvable');
  }
}

/**
 * Actions sur la fiche d'un frère : « Appeler » et, si un numéro est sur WhatsApp, « WhatsApp ».
 * Avec plusieurs numéros possibles, une petite liste permet de choisir lequel.
 */
export function ContactActions({ contact, compact = false }: { contact: ContactLike | null | undefined; compact?: boolean }) {
  const [choose, setChoose] = useState<Mode | null>(null);
  if (!contact?.phones?.length) return null;
  const callable = contact.phones;
  const wa = contact.phones.filter((p) => isWhatsapp(contact, p));
  const act = (mode: Mode) => {
    const list = mode === 'call' ? callable : wa;
    if (list.length === 1) return open(mode, list[0]);
    setChoose(mode);
  };
  const list = choose === 'call' ? callable : wa;

  return (
    <>
      {compact ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {wa.length ? (
            <IconButton icon="logo-whatsapp" label={`Écrire à ${contact.fullName} sur WhatsApp`} tone="success" onPress={() => act('whatsapp')} />
          ) : null}
          <IconButton icon="call" label={`Appeler ${contact.fullName}`} tone="primary" onPress={() => act('call')} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Appeler" icon="call-outline" variant="secondary" onPress={() => act('call')} style={{ flex: 1 }} />
          {wa.length ? <Button title="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => act('whatsapp')} style={{ flex: 1 }} /> : null}
        </View>
      )}

      <Modal visible={choose !== null} transparent animationType="fade" onRequestClose={() => setChoose(null)}>
        <Pressable style={styles.backdrop} onPress={() => setChoose(null)} accessibilityLabel="Fermer">
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.title}>{choose === 'call' ? 'Appeler quel numéro ?' : 'Écrire sur quel numéro ?'}</Text>
            {list.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  const mode = choose!;
                  setChoose(null);
                  open(mode, p);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceDeep }]}
              >
                <Ionicons name={choose === 'call' ? 'call-outline' : 'logo-whatsapp'} size={20} color={choose === 'call' ? colors.primary : colors.whatsapp} />
                <Text style={styles.number}>{fmtPhone(p)}</Text>
                {choose === 'call' && isWhatsapp(contact, p) ? <WaMark /> : null}
              </Pressable>
            ))}
            <Button title="Annuler" variant="ghost" onPress={() => setChoose(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 25, 20, 0.35)', justifyContent: 'flex-end', padding: space.lg },
  sheet: { backgroundColor: colors.bg, borderRadius: radius.lg, borderCurve: 'continuous', padding: space.lg, gap: space.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  number: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
});
