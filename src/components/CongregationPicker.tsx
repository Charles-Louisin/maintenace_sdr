import { ScrollView, Text, View } from 'react-native';
import type { Venue } from '../lib/types';
import { Chip, Small, VenueThumb } from './ui';
import { colors, space } from '../theme/tokens';

export interface Assignment {
  /** Salles dont il est responsable de toutes les assemblées */
  venueIds: string[];
  /** Assemblées précises */
  congregationIds: string[];
}

/** Résumé lisible : « Toutes les assemblées de Beedi · Bonamoussongo ». */
export function assignmentSummary(venues: Venue[], a: Assignment): string {
  const parts: string[] = [];
  for (const v of venues) {
    if (a.venueIds.includes(v._id)) parts.push(`Toutes les assemblées de ${v.name}`);
    else for (const c of v.congregations) if (a.congregationIds.includes(c._id)) parts.push(c.name);
  }
  return parts.join(' · ');
}

/**
 * Rattachement d'un responsable : par salle, « Toutes les assemblées » ou une ou plusieurs assemblées.
 * Choisir toutes les assemblées une par une revient à choisir la salle entière.
 */
export function CongregationPicker({ venues, value, onChange }: { venues: Venue[]; value: Assignment; onChange: (a: Assignment) => void }) {
  const toggleWhole = (v: Venue) => {
    const whole = value.venueIds.includes(v._id);
    const own = new Set(v.congregations.map((c) => c._id));
    onChange({
      venueIds: whole ? value.venueIds.filter((x) => x !== v._id) : [...value.venueIds, v._id],
      congregationIds: value.congregationIds.filter((x) => !own.has(x)),
    });
  };
  const toggleCong = (v: Venue, cid: string) => {
    const own = v.congregations.map((c) => c._id);
    // Si la salle entière était choisie, on passe à cette seule assemblée
    let selected = value.venueIds.includes(v._id) ? [] : value.congregationIds.filter((x) => own.includes(x));
    selected = selected.includes(cid) ? selected.filter((x) => x !== cid) : [...selected, cid];
    const all = own.length > 1 && own.every((x) => selected.includes(x));
    onChange({
      venueIds: all ? [...value.venueIds.filter((x) => x !== v._id), v._id] : value.venueIds.filter((x) => x !== v._id),
      congregationIds: [...value.congregationIds.filter((x) => !own.includes(x)), ...(all ? [] : selected)],
    });
  };

  if (!venues.length) return <Small>Aucune salle enregistrée.</Small>;
  return (
    <View style={{ gap: space.lg }}>
      {venues.map((v) => {
        const whole = value.venueIds.includes(v._id);
        return (
          <View key={v._id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <VenueThumb image={v.imageUrl} size={28} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{v.name}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip label="Toutes les assemblées" active={whole} onPress={() => toggleWhole(v)} />
              {v.congregations.map((c) => (
                <Chip key={c._id} label={c.name} active={whole || value.congregationIds.includes(c._id)} onPress={() => toggleCong(v, c._id)} />
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}
