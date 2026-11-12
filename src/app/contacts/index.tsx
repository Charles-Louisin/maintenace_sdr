import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import type { Contact, Venue } from '../../lib/types';
import { fmtPhone } from '../../lib/format';
import { assignmentSummary } from '../../components/CongregationPicker';
import { FilterSheet } from '../../components/FilterSheet';
import { Badge, Button, Card, Chip, Empty, ErrorState, Field, Loading, Row, Screen, Section, Small, WaMark } from '../../components/ui';
import { space } from '../../theme/tokens';

type Sort = 'name' | 'venue' | 'congregation';
const ALL = 'Toutes les assemblées';

/** Salles et assemblées d'un responsable (assemblée null = toute la salle). */
function memberships(c: Contact, venues: Venue[]) {
  const out: { venue: Venue; congregationId: string | null }[] = [];
  for (const v of venues) {
    if (c.venueIds?.map(String).includes(v._id)) out.push({ venue: v, congregationId: null });
    else for (const g of v.congregations) if (c.congregationIds?.map(String).includes(g._id)) out.push({ venue: v, congregationId: g._id });
  }
  return out;
}

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [fVenues, setFVenues] = useState<string[]>([]);
  const [fCongs, setFCongs] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('name');
  const q = useQuery({ queryKey: ['contacts'], queryFn: () => get<Contact[]>('/api/contacts') });
  const vq = useQuery({ queryKey: ['venues'], queryFn: () => get<Venue[]>('/api/venues') });
  const venues = useMemo(() => vq.data ?? [], [vq.data]);

  // Filtres : nom, salle, assemblée (un responsable de toute la salle compte pour chacune de ses assemblées)
  const list = useMemo(() => {
    const k = search.trim().toLowerCase();
    return (q.data ?? []).filter((c) => {
      if (k && !c.fullName.toLowerCase().includes(k)) return false;
      const m = memberships(c, venues);
      if (fVenues.length && !m.some((x) => fVenues.includes(x.venue._id))) return false;
      // Un responsable de toute la salle compte pour chacune de ses assemblées
      if (
        fCongs.length &&
        !m.some((x) =>
          x.congregationId
            ? fCongs.includes(x.congregationId)
            : x.venue.congregations.some((g) => fCongs.includes(g._id)) || fCongs.includes(`all:${x.venue._id}`),
        )
      )
        return false;
      return true;
    });
  }, [q.data, venues, search, fVenues, fCongs]);
  const congOptions = useMemo(
    () =>
      venues
        .filter((v) => !fVenues.length || fVenues.includes(v._id))
        .flatMap((v) => [
          { value: `all:${v._id}`, label: 'Toute la salle', hint: v.name },
          ...v.congregations.map((g) => ({ value: g._id, label: g.name, hint: v.name })),
        ]),
    [venues, fVenues],
  );

  // Regroupement : par salle ou par assemblée
  const groups = useMemo(() => {
    if (sort === 'name') return [{ key: 'all', title: '', items: list }];
    const map = new Map<string, Contact[]>();
    for (const c of list) {
      const m = memberships(c, venues).filter((x) => !fVenues.length || fVenues.includes(x.venue._id));
      const keys =
        sort === 'venue'
          ? [...new Set(m.map((x) => x.venue.name))]
          : m.map((x) => `${x.venue.name} · ${x.congregationId ? (x.venue.congregations.find((g) => g._id === x.congregationId)?.name ?? '') : ALL}`);
      for (const key of keys.length ? keys : ['Sans salle']) map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === 'Sans salle' ? 1 : b === 'Sans salle' ? -1 : a.localeCompare(b, 'fr')))
      .map(([key, items]) => ({ key, title: key, items }));
  }, [list, venues, sort, fVenues]);

  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  const row = (c: Contact) => {
    const summary = assignmentSummary(venues, { venueIds: (c.venueIds ?? []).map(String), congregationIds: (c.congregationIds ?? []).map(String) });
    const phones = c.phones.length ? c.phones.map((p) => `${fmtPhone(p)}${c.whatsappPhones?.includes(p) ? ' (WhatsApp)' : ''}`).join(' · ') : 'Numéro manquant';
    return (
      <Row
        key={c._id}
        icon="person-outline"
        title={c.fullName}
        subtitle={summary ? `${summary}\n${phones}` : phones}
        right={!c.phones.length ? <Badge label="À compléter" tone="danger" /> : c.whatsappPhones?.length ? <WaMark size={18} /> : undefined}
        onPress={() => router.push(`/contacts/${c._id}`)}
      />
    );
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Button title="Ajouter un responsable" icon="person-add-outline" onPress={() => router.push('/contacts/new')} />
      <Field label="" value={search} onChangeText={setSearch} placeholder="Rechercher un frère" accessibilityLabel="Rechercher un frère" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <FilterSheet label="Salles" options={venues.map((v) => ({ value: v._id, label: v.name }))} selected={fVenues} onChange={setFVenues} />
        <FilterSheet label="Assemblées" options={congOptions} selected={fCongs} onChange={setFCongs} />
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Small>Trier :</Small>
        <Chip label="Par nom" active={sort === 'name'} onPress={() => setSort('name')} />
        <Chip label="Par salle" active={sort === 'venue'} onPress={() => setSort('venue')} />
        <Chip label="Par assemblée" active={sort === 'congregation'} onPress={() => setSort('congregation')} />
      </View>
      {list.length === 0 ? (
        <Empty icon="person-circle-outline" title={search || fVenues.length || fCongs.length ? 'Aucun responsable ne correspond' : 'Aucun responsable'} />
      ) : (
        groups.map((g) =>
          g.title ? (
            <Section key={g.key} title={`${g.title} (${g.items.length})`}>
              <Card style={{ paddingVertical: space.xs }}>{g.items.map(row)}</Card>
            </Section>
          ) : (
            <Card key={g.key} style={{ paddingVertical: space.xs }}>
              {g.items.map(row)}
            </Card>
          ),
        )
      )}
    </Screen>
  );
}
