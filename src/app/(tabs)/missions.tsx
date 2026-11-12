import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import type { CallAssignment, IncomingReport, WorkEvent } from '../../lib/types';
import { CALL_STATUS, dateToIso, fmtDate, fmtDateTime, plural, relativeDays, todayIso } from '../../lib/format';
import { FilterSheet } from '../../components/FilterSheet';
import { listDrafts, type ResponseDraft } from '../../lib/drafts';
import { useFold } from '../../lib/useFold';
import { Avatar, Badge, Button, Card, Chip, Collapsible, Empty, ErrorState, FoldBar, Loading, Screen, Small } from '../../components/ui';
import { colors, radius, space } from '../../theme/tokens';

type Tab = 'todo' | 'overdue' | 'awaiting_response' | 'upcoming' | 'done' | 'all' | 'responses';
type Sort = 'date' | 'venue' | 'volunteer';

const TABS: { value: Tab; label: string }[] = [
  { value: 'todo', label: 'À faire' },
  { value: 'overdue', label: 'En retard' },
  { value: 'awaiting_response', label: 'En attente' },
  { value: 'upcoming', label: 'À venir' },
  { value: 'done', label: 'Terminées' },
  { value: 'all', label: 'Toutes' },
  { value: 'responses', label: 'Réponses' },
];
const OPEN = ['planned', 'notified', 'message_sent', 'response_received'];

const norm = (q: string) =>
  q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Texte sur lequel porte la recherche : salle, assemblée, volontaire, responsable, tâches. */
function haystack(a: CallAssignment) {
  const e = a.workEventId as WorkEvent;
  return norm(
    [
      e?.venueId?.name,
      e?.congregationName,
      a.volunteerId?.fullName,
      (e?.responsibleContactId as { fullName?: string } | null)?.fullName,
      ...(e?.tasks ?? []).map((t) => t.label),
      a.type === 'pre' ? 'appel préalable avant' : 'appel de suivi après',
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function MissionItem({ a, now }: { a: CallAssignment; now: number }) {
  const e = a.workEventId as WorkEvent;
  const st = CALL_STATUS[a.status];
  return (
    <Pressable
      onPress={() => router.push(`/missions/${a._id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceDeep }]}
    >
      <Avatar name={a.volunteerId?.fullName ?? '?'} size={42} tone={a.volunteerId ? 'primary' : 'danger'} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title} numberOfLines={1}>
          {e?.venueId?.name} · {e?.congregationName}
        </Text>
        <Small numberOfLines={1}>
          {a.type === 'pre' ? 'Appel préalable' : 'Appel de suivi'} · {a.volunteerId?.fullName ?? 'à attribuer'}
        </Small>
        <Small numberOfLines={1}>Travaux : {e ? fmtDate(e.date, { year: false }) : '—'}</Small>
        <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {a.status === 'completed' ? (
            <Badge
              label={a.completionOutcome === 'not_done' ? 'Terminée · non faite' : 'Terminée · faite'}
              tone={a.completionOutcome === 'not_done' ? 'warning' : 'success'}
            />
          ) : (
            <Badge label={st?.label ?? a.status} tone={st?.tone ?? 'neutral'} />
          )}
          {OPEN.includes(a.status) && new Date(a.dueAt).getTime() < now ? (
            <Badge label={`En retard · ${relativeDays(dateToIso(new Date(a.dueAt)))}`} tone="danger" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function Missions() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === params.tab) ? (params.tab as Tab) : 'todo');
  const [sort, setSort] = useState<Sort>('date');
  // Filtres à choix multiple (panneaux du bas) ; vide = pas de filtre
  const [fDates, setFDates] = useState<string[]>([]);
  const [fVolunteers, setFVolunteers] = useState<string[]>([]);
  const [fVenues, setFVenues] = useState<string[]>([]);
  const [fTasks, setFTasks] = useState<string[]>([]);
  const [fTypes, setFTypes] = useState<string[]>([]);
  const [fOutcomes, setFOutcomes] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  /** Heure de référence pour « en retard » (figée à l’affichage de l’écran) */
  const [now] = useState(() => Date.now());
  const [drafts, setDrafts] = useState<ResponseDraft[]>([]);
  const scope = tab === 'responses' ? null : tab;
  const missions = useQuery({
    queryKey: ['missions', scope],
    queryFn: () => get<CallAssignment[]>(`/api/call-assignments?scope=${scope}`),
    enabled: Boolean(scope),
  });
  const reports = useQuery({
    queryKey: ['incoming-reports', 'draft'],
    queryFn: () => get<IncomingReport[]>('/api/incoming-reports?status=draft'),
    enabled: tab === 'responses',
  });
  useFocusEffect(
    useCallback(() => {
      listDrafts().then((d) => setDrafts(d.filter((x) => !x.syncedReportId)));
    }, []),
  );

  // Filtres locaux : type d'appel, issue (terminées), recherche
  const filtered = useMemo(() => {
    const q = norm(query);
    return (missions.data ?? []).filter(
      (a) =>
        (!fTypes.length || fTypes.includes(a.type)) &&
        (tab !== 'done' || !fOutcomes.length || fOutcomes.includes(a.completionOutcome ?? 'done')) &&
        (!fDates.length || fDates.includes(dateToIso(new Date(a.dueAt)))) &&
        (!fVolunteers.length || fVolunteers.includes(a.volunteerId?._id ?? 'none')) &&
        (!fVenues.length || fVenues.includes((a.workEventId as WorkEvent)?.venueId?._id ?? '')) &&
        (!fTasks.length || ((a.workEventId as WorkEvent)?.tasks ?? []).some((t) => fTasks.includes(t.label))) &&
        (!q || haystack(a).includes(q)),
    );
  }, [missions.data, fTypes, fOutcomes, fDates, fVolunteers, fVenues, fTasks, tab, query]);

  // Options proposées dans chaque panneau, tirées des missions de l'onglet (avec leur nombre)
  const options = useMemo(() => {
    const count = (key: (a: CallAssignment) => string[], label: (k: string, a: CallAssignment) => string) => {
      const m = new Map<string, { label: string; count: number }>();
      for (const a of missions.data ?? []) for (const k of key(a)) m.set(k, { label: m.get(k)?.label ?? label(k, a), count: (m.get(k)?.count ?? 0) + 1 });
      return [...m.entries()].map(([value, v]) => ({ value, label: v.label, count: v.count }));
    };
    const ev = (a: CallAssignment) => a.workEventId as WorkEvent;
    return {
      dates: count(
        (a) => [dateToIso(new Date(a.dueAt))],
        (k) => fmtDate(k, { year: false }),
      ).sort((x, y) => x.value.localeCompare(y.value)),
      volunteers: count(
        (a) => [a.volunteerId?._id ?? 'none'],
        (_k, a) => a.volunteerId?.fullName ?? 'À attribuer',
      ).sort((x, y) => x.label.localeCompare(y.label, 'fr')),
      venues: count(
        (a) => [ev(a)?.venueId?._id ?? ''],
        (_k, a) => ev(a)?.venueId?.name ?? 'Salle inconnue',
      ).sort((x, y) => x.label.localeCompare(y.label, 'fr')),
      tasks: count(
        (a) => [...new Set((ev(a)?.tasks ?? []).map((t) => t.label))],
        (k) => k,
      ).sort((x, y) => x.label.localeCompare(y.label, 'fr')),
    };
  }, [missions.data]);
  const anyFilter = Boolean(query || fDates.length || fVolunteers.length || fVenues.length || fTasks.length || fTypes.length || fOutcomes.length);

  // Groupes : par jour d'échéance (défaut), par salle ou par volontaire
  const groups = useMemo(() => {
    if (sort !== 'date') {
      const byKey = new Map<string, CallAssignment[]>();
      for (const a of filtered) {
        const e = a.workEventId as WorkEvent;
        const k = sort === 'venue' ? (e?.venueId?.name ?? 'Salle inconnue') : (a.volunteerId?.fullName ?? 'À attribuer');
        byKey.set(k, [...(byKey.get(k) ?? []), a]);
      }
      return [...byKey.entries()]
        .sort(([x], [y]) => x.localeCompare(y, 'fr'))
        .map(([date, items]) => ({ date, items: [...items].sort((p, q) => p.dueAt.localeCompare(q.dueAt)) }));
    }
    const m = new Map<string, CallAssignment[]>();
    for (const a of filtered) {
      const k = dateToIso(new Date(a.dueAt));
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    // Urgence d'abord : aujourd'hui et les prochains jours (croissant), puis les retards du plus récent au plus ancien
    const t = todayIso();
    const all = [...m.entries()].map(([date, items]) => ({ date, items }));
    const soon = all.filter((g) => g.date >= t).sort((a, b) => a.date.localeCompare(b.date));
    const late = all.filter((g) => g.date < t).sort((a, b) => b.date.localeCompare(a.date));
    return tab === 'done' || tab === 'all' ? all.sort((a, b) => b.date.localeCompare(a.date)) : [...soon, ...late];
  }, [filtered, sort, tab]);
  const keys = useMemo(() => groups.map((g) => g.date), [groups]);
  const today = todayIso();
  const defaults = useMemo(() => keys.slice(0, 2), [keys]);
  const fold = useFold(keys, defaults);

  const body = () => {
    if (tab === 'responses') {
      if (reports.isPending) return <Loading rows={2} />;
      const list = reports.data ?? [];
      if (!list.length && !drafts.length) {
        return <Empty icon="checkmark-done-outline" title="Aucune réponse en attente" />;
      }
      return (
        <View style={{ gap: space.md }}>
          {drafts.map((d) => (
            <Card key={d.clientDraftId} onPress={() => router.push(`/responses/new?draft=${d.clientDraftId}`)}>
              <Badge label="Brouillon sur le téléphone · à synchroniser" tone="warning" icon="cloud-upload-outline" />
              <Text style={styles.title}>{d.label || 'Réponse sans mission'}</Text>
              <Small numberOfLines={2}>{d.text}</Small>
            </Card>
          ))}
          {list.map((r) => {
            const ev = typeof r.workEventId === 'object' ? r.workEventId : null;
            return (
              <Card key={r._id} onPress={() => router.push(`/responses/${r._id}`)}>
                <Badge label={r.type === 'pre' ? 'Retour avant travaux' : 'Compte rendu après travaux'} tone="info" />
                <Text style={styles.title}>{ev ? `${ev.venueId?.name} · ${ev.congregationName}` : 'Intervention'}</Text>
                <Small numberOfLines={2}>{r.originalText}</Small>
              </Card>
            );
          })}
        </View>
      );
    }
    if (missions.isPending) return <Loading rows={3} />;
    if (missions.isError && !missions.data) return <ErrorState message={errorMessage(missions.error)} onRetry={() => missions.refetch()} />;
    if (!groups.length) {
      return (
        <Empty
          icon="call-outline"
          title={
            anyFilter
              ? 'Aucune mission ne correspond'
              : tab === 'todo'
                ? 'Aucun appel à transmettre'
                : tab === 'overdue'
                  ? 'Aucune mission en retard'
                  : tab === 'awaiting_response'
                    ? 'Aucun retour en attente'
                    : tab === 'done'
                      ? 'Aucune mission terminée'
                      : 'Aucune mission'
          }
          text={
            anyFilter
              ? 'Modifiez la recherche ou les filtres.'
              : tab === 'todo'
                ? 'Les appels apparaissent ici à l’approche de leur échéance (7 jours).'
                : undefined
          }
        />
      );
    }
    return (
      <View style={{ gap: space.md }}>
        <FoldBar count={groups.length} allOpen={fold.allOpen} onToggleAll={fold.toggleAll} label={plural(filtered.length, 'mission')} />
        {groups.map((g) => (
          <Collapsible
            key={g.date}
            title={sort === 'date' ? fmtDate(g.date, { year: false }) : g.date}
            subtitle={
              sort === 'date'
                ? `${g.date < today && tab !== 'done' ? 'En retard · ' : ''}${relativeDays(g.date)} · ${plural(g.items.length, 'mission')}`
                : plural(g.items.length, 'mission')
            }
            tone={sort !== 'date' ? 'primary' : g.date < today && tab !== 'done' ? 'warning' : g.date === today ? 'gold' : 'primary'}
            open={fold.isOpen(g.date)}
            onToggle={() => fold.toggle(g.date)}
          >
            {g.items.map((a) => (
              <MissionItem key={a._id} a={a} now={now} />
            ))}
          </Collapsible>
        ))}
      </View>
    );
  };

  return (
    <Screen refreshing={missions.isRefetching || reports.isRefetching} onRefresh={() => (tab === 'responses' ? reports.refetch() : missions.refetch())}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {TABS.map((t) => (
          <Chip key={t.value} label={t.label} active={tab === t.value} onPress={() => setTab(t.value)} />
        ))}
      </ScrollView>
      {tab !== 'responses' ? (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={17} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Salle, assemblée, volontaire, responsable…"
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              accessibilityLabel="Rechercher une mission"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
                <Ionicons name="close-circle" size={18} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <FilterSheet label="Dates" title="Dates des missions" options={options.dates} selected={fDates} onChange={setFDates} />
            <FilterSheet label="Volontaires" options={options.volunteers} selected={fVolunteers} onChange={setFVolunteers} />
            <FilterSheet label="Salles" options={options.venues} selected={fVenues} onChange={setFVenues} />
            <FilterSheet label="Tâches" title="Travaux" options={options.tasks} selected={fTasks} onChange={setFTasks} />
            <FilterSheet
              label="Type d’appel"
              options={[
                { value: 'pre', label: 'Appels préalables' },
                { value: 'post', label: 'Appels de suivi' },
              ]}
              selected={fTypes}
              onChange={setFTypes}
            />
            {tab === 'done' ? (
              <FilterSheet
                label="Issue"
                options={[
                  { value: 'done', label: 'Faites' },
                  { value: 'not_done', label: 'Non faites' },
                ]}
                selected={fOutcomes}
                onChange={setFOutcomes}
              />
            ) : null}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, alignItems: 'center' }}>
            <Small>Regrouper :</Small>
            <Chip label="Par date" active={sort === 'date'} onPress={() => setSort('date')} />
            <Chip label="Par salle" active={sort === 'venue'} onPress={() => setSort('venue')} />
            <Chip label="Par volontaire" active={sort === 'volunteer'} onPress={() => setSort('volunteer')} />
          </ScrollView>
        </>
      ) : null}
      <Button title="Enregistrer une réponse" icon="clipboard-outline" variant="secondary" onPress={() => router.push('/responses/new')} />
      {body()}
      {tab !== 'responses' && missions.dataUpdatedAt ? (
        <Small style={{ textAlign: 'center' }}>Mis à jour {fmtDateTime(new Date(missions.dataUpdatedAt))}</Small>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: space.md,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: 48,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
});
