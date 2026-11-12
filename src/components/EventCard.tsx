import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { WorkEvent } from '../lib/types';
import { CALL_STATUS, EVENT_STATUS, fmtDate, fmtPhone, isWhatsapp, fmtEventDate } from '../lib/format';
import { Badge, Small, WaMark, VenueThumb } from './ui';
import { colors, radius, space } from '../theme/tokens';
import { useVenueImages, useVenueLookup } from '../lib/images';

function CallLine({ label, call, eventActive }: { label: string; call?: WorkEvent['calls'][number]; eventActive: boolean }) {
  if (!call) return null;
  // Appel préalable annulé alors que l'intervention existe toujours = travaux déjà passés lors de l'import
  const unassigned = call.needsManualAssignment && !call.volunteerId;
  const st = unassigned
    ? { label: 'À attribuer', tone: 'danger' as const }
    : call.status === 'cancelled' && eventActive
      ? { label: 'Sans objet', tone: 'neutral' as const }
      : (CALL_STATUS[call.status] ?? { label: call.status, tone: 'neutral' as const });
  return (
    <View style={styles.call}>
      <Ionicons name={label === 'Avant' ? 'arrow-forward-circle-outline' : 'arrow-undo-circle-outline'} size={16} color={colors.textMuted} />
      <Small style={{ flex: 1 }} numberOfLines={1}>
        {label} · {call.volunteerId?.fullName ?? (unassigned ? 'aucun volontaire' : '—')}
      </Small>
      <Badge label={st.label} tone={st.tone} />
    </View>
  );
}

/**
 * Intervention dans une liste : bloc à plat (pas une carte dans une carte),
 * salle, assemblée, travaux, responsable et état des deux appels.
 */
export function EventCard({ e, showDate = true }: { e: WorkEvent; showDate?: boolean }) {
  const st = EVENT_STATUS[e.status];
  const resp = e.responsibleContactId;
  const active = e.status !== 'cancelled';
  const venueImage = useVenueImages();
  const venueOf = useVenueLookup();
  return (
    <Pressable
      onPress={() => router.push(`/events/${e._id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${e.venueId?.name}, ${e.congregationName}, ${fmtDate(e.date)}`}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceDeep }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <VenueThumb image={venueImage(e.venueId?._id)} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>
            {e.venueId?.name ?? 'Salle inconnue'} · {e.congregationName || 'Assemblée'}
          </Text>
          {showDate || venueOf(e.venueId?._id)?.weeklySchedule ? <Small>{fmtEventDate(e, Boolean(venueOf(e.venueId?._id)?.weeklySchedule))}</Small> : null}
        </View>
        <Badge label={st.label} tone={st.tone} />
      </View>
      <Text style={styles.tasks} numberOfLines={3}>
        {e.tasks.map((t) => t.label).join(' · ')}
      </Text>
      <View style={styles.resp}>
        <Ionicons name="person-circle-outline" size={16} color={resp?.phones?.length ? colors.primary : colors.danger} />
        <Small numberOfLines={1} style={[{ flex: 1 }, !resp?.phones?.length && { color: colors.danger }]}>
          {resp ? `${resp.fullName}${resp.phones[0] ? ` · ${fmtPhone(resp.phones[0])}` : ' · numéro manquant'}` : 'Responsable non renseigné'}
        </Small>
        {isWhatsapp(resp, resp?.phones?.[0]) ? <WaMark /> : null}
      </View>
      <View style={{ gap: 6 }}>
        <CallLine label="Avant" call={e.calls?.find((c) => c.type === 'pre')} eventActive={active} />
        <CallLine label="Après" call={e.calls?.find((c) => c.type === 'post')} eventActive={active} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.bg, borderRadius: radius.md, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
  tasks: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  resp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  call: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
