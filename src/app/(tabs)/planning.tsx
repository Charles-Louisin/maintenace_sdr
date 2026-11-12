import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { get, errorMessage } from '../../lib/api';
import type { Venue, WorkEvent } from '../../lib/types';
import { addDays, dateToIso, fmtDate, isoToDate, MONTH_NAMES, plural, relativeDays, todayIso, WEEKDAYS_SHORT } from '../../lib/format';
import { useFold } from '../../lib/useFold';
import { EventCard } from '../../components/EventCard';
import { FilterSheet } from '../../components/FilterSheet';
import { Collapsible, Empty, ErrorState, FoldBar, IconButton, Loading, Segmented } from '../../components/ui';
import { colors, radius, shadow, space } from '../../theme/tokens';

type ViewMode = 'list' | 'month' | 'week' | 'day';

function mondayOf(iso: string) {
  const d = isoToDate(iso);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

function range(view: ViewMode, anchor: string): [string, string] {
  const d = isoToDate(anchor);
  if (view === 'month') return [dateToIso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), dateToIso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))];
  if (view === 'week') {
    const m = mondayOf(anchor);
    return [m, addDays(m, 6)];
  }
  if (view === 'day') return [anchor, anchor];
  // Liste : à venir uniquement (le passé reste consultable en vues Mois / Semaine / Jour)
  return [todayIso(), addDays(todayIso(), 180)];
}

export default function Planning() {
  const [view, setView] = useState<ViewMode>('list');
  const [anchor, setAnchor] = useState(todayIso());
  const [selected, setSelected] = useState<string | null>(null);
  // Filtres à choix multiple (panneaux du bas)
  const [fVenues, setFVenues] = useState<string[]>([]);
  const [fCongs, setFCongs] = useState<string[]>([]);
  const [fCats, setFCats] = useState<string[]>([]);
  const [fDates, setFDates] = useState<string[]>([]);
  const [responsible, setResponsible] = useState('');
  const [from, to] = range(view, anchor);

  const venues = useQuery({ queryKey: ['venues'], queryFn: () => get<Venue[]>('/api/venues') });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => get<string[]>('/api/work-events/categories') });
  const params = new URLSearchParams({ from, to });
  if (responsible.trim().length >= 2) params.set('responsible', responsible.trim());
  const q = useQuery({ queryKey: ['work-events', params.toString()], queryFn: () => get<WorkEvent[]>(`/api/work-events?${params}`) });

  const filteredEvents = useMemo(
    () =>
      (q.data ?? []).filter(
        (e) =>
          (!fVenues.length || fVenues.includes(e.venueId?._id)) &&
          (!fCongs.length || fCongs.includes(e.congregationId ?? `all:${e.venueId?._id}`)) &&
          (!fCats.length || e.tasks.some((t) => fCats.includes(t.category))) &&
          (!fDates.length || fDates.includes(e.date)),
      ),
    [q.data, fVenues, fCongs, fCats, fDates],
  );
  const filterOptions = useMemo(() => {
    const evs = q.data ?? [];
    const countBy = (keyOf: (e: WorkEvent) => string[]) => {
      const m = new Map<string, number>();
      for (const e of evs) for (const k of new Set(keyOf(e))) m.set(k, (m.get(k) ?? 0) + 1);
      return m;
    };
    const vCount = countBy((e) => [e.venueId?._id]);
    const cCount = countBy((e) => [e.congregationId ?? `all:${e.venueId?._id}`]);
    const kCount = countBy((e) => e.tasks.map((t) => t.category).filter(Boolean));
    const dCount = countBy((e) => [e.date]);
    const vs = venues.data ?? [];
    return {
      venues: vs.map((v) => ({ value: v._id, label: v.name, count: vCount.get(v._id) ?? 0 })),
      congs: vs
        .filter((v) => !fVenues.length || fVenues.includes(v._id))
        .flatMap((v) => [
          { value: `all:${v._id}`, label: 'Toutes les assemblées', hint: v.name, count: cCount.get(`all:${v._id}`) ?? 0 },
          ...v.congregations.map((c) => ({ value: c._id, label: c.name, hint: v.name, count: cCount.get(c._id) ?? 0 })),
        ]),
      cats: (categories.data ?? []).map((c) => ({ value: c, label: c, count: kCount.get(c) ?? 0 })),
      dates: [...dCount.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => ({ value: d, label: fmtDate(d), count: n })),
    };
  }, [q.data, venues.data, categories.data, fVenues]);

  const groups = useMemo(() => {
    const m = new Map<string, WorkEvent[]>();
    for (const e of filteredEvents) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, events]) => ({ date, events }));
  }, [filteredEvents]);
  const visible = view === 'month' && selected ? groups.filter((g) => g.date === selected) : groups;
  const keys = useMemo(() => visible.map((g) => g.date), [visible]);
  // Ouverts par défaut : les deux prochaines dates (vue d'ensemble repliée pour le reste)
  const today = todayIso();
  const defaults = useMemo(() => {
    if (view !== 'list') return keys;
    return keys.filter((k) => k >= today).slice(0, 2);
  }, [keys, view, today]);
  const fold = useFold(keys, defaults);

  const shift = (dir: 1 | -1) => {
    const d = isoToDate(anchor);
    if (view === 'month') setAnchor(dateToIso(new Date(d.getFullYear(), d.getMonth() + dir, 1, 12)));
    else setAnchor(addDays(anchor, view === 'week' ? 7 * dir : dir));
    setSelected(null);
  };
  const title =
    view === 'month'
      ? `${MONTH_NAMES[isoToDate(anchor).getMonth()]} ${isoToDate(anchor).getFullYear()}`
      : view === 'week'
        ? `Semaine du ${fmtDate(from, { weekday: false, year: false })}`
        : fmtDate(anchor);

  const byDay = useMemo(() => new Map(groups.map((g) => [g.date, g.events.length])), [groups]);

  const calendar = () => {
    const first = isoToDate(from);
    const lead = (first.getDay() + 6) % 7;
    const days = isoToDate(to).getDate();
    const cells: (string | null)[] = [
      ...Array(lead).fill(null),
      ...Array.from({ length: days }, (_, i) => dateToIso(new Date(first.getFullYear(), first.getMonth(), i + 1, 12))),
    ];
    while (cells.length % 7) cells.push(null);
    return (
      <View style={styles.calendar}>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS_SHORT.map((w, i) => (
            <Text key={i} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {cells.slice(r * 7, r * 7 + 7).map((iso, i) => {
              const n = iso ? (byDay.get(iso) ?? 0) : 0;
              const sel = iso !== null && iso === selected;
              const isToday = iso === today;
              return (
                <Pressable
                  key={i}
                  disabled={!iso}
                  onPress={() => setSelected(sel ? null : iso)}
                  accessibilityLabel={iso ? `${fmtDate(iso)}, ${n} intervention(s)` : undefined}
                  style={styles.dayCell}
                >
                  {iso ? (
                    <View
                      style={[styles.dayInner, sel && { backgroundColor: colors.primary }, isToday && !sel && { borderWidth: 1.5, borderColor: colors.gold }]}
                    >
                      <Text style={{ fontSize: 15, fontWeight: isToday || sel ? '700' : '500', color: sel ? colors.onPrimary : colors.text }}>
                        {isoToDate(iso).getDate()}
                      </Text>
                      <View style={[styles.dot, { backgroundColor: n ? (sel ? colors.onPrimary : colors.primary) : 'transparent' }]} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.sm }}>
      <Segmented<ViewMode>
        value={view}
        onChange={(v) => {
          setView(v);
          setSelected(null);
        }}
        options={[
          { value: 'list', label: 'Liste' },
          { value: 'month', label: 'Mois' },
          { value: 'week', label: 'Semaine' },
          { value: 'day', label: 'Jour' },
        ]}
      />
      {view !== 'list' ? (
        <View style={styles.periodBar}>
          <IconButton icon="chevron-back" label="Période précédente" onPress={() => shift(-1)} size={40} />
          <Pressable onPress={() => setAnchor(today)} accessibilityRole="button" accessibilityLabel="Revenir à aujourd'hui">
            <Text style={styles.period}>{title}</Text>
          </Pressable>
          <IconButton icon="chevron-forward" label="Période suivante" onPress={() => shift(1)} size={40} />
        </View>
      ) : null}
      {view === 'month' ? calendar() : null}
      <View style={styles.search}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={responsible}
          onChangeText={setResponsible}
          placeholder="Rechercher un responsable"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <FilterSheet label="Salles" options={filterOptions.venues} selected={fVenues} onChange={setFVenues} />
        <FilterSheet label="Assemblées" options={filterOptions.congs} selected={fCongs} onChange={setFCongs} />
        <FilterSheet label="Travaux" options={filterOptions.cats} selected={fCats} onChange={setFCats} />
        <FilterSheet label="Dates" options={filterOptions.dates} selected={fDates} onChange={setFDates} />
      </ScrollView>
      {visible.length ? (
        <FoldBar
          count={visible.length}
          allOpen={fold.allOpen}
          onToggleAll={fold.toggleAll}
          label={`${plural(
            visible.reduce((n, g) => n + g.events.length, 0),
            'intervention',
          )} · ${plural(visible.length, 'date')}`}
        />
      ) : null}
    </View>
  );

  if (q.isPending && !q.data) return <Loading rows={4} />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  return (
    <FlatList
      data={visible}
      keyExtractor={(g) => g.date}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
      ListEmptyComponent={<Empty icon="calendar-clear-outline" title="Aucune intervention" />}
      renderItem={({ item: g }) => {
        const past = g.date < today;
        return (
          <Collapsible
            virtualized
            title={fmtDate(g.date, { year: false })}
            subtitle={`${relativeDays(g.date)} · ${plural(g.events.length, 'intervention')} · ${[...new Set(g.events.map((e) => e.venueId?.name))].join(', ')}`}
            tone={past ? 'neutral' : g.date === today ? 'gold' : 'primary'}
            open={fold.isOpen(g.date)}
            onToggle={() => fold.toggle(g.date)}
          >
            {g.events.map((e) => (
              <EventCard key={e._id} e={e} showDate={false} />
            ))}
          </Collapsible>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xxl * 2 },
  calendar: { backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', padding: space.md, ...shadow.card },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textFaint, paddingVertical: 6 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  periodBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  period: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
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
