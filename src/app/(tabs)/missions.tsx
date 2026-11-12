import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import type { CallAssignment, IncomingReport, WorkEvent } from '../../lib/types';
import { CALL_STATUS, dateToIso, fmtDate, fmtDateTime, plural, relativeDays, todayIso } from '../../lib/format';
import { listDrafts, type ResponseDraft } from '../../lib/drafts';
import { useFold } from '../../lib/useFold';
import { Avatar, Badge, Button, Card, Collapsible, Empty, ErrorState, FoldBar, Loading, Screen, Segmented, Small } from '../../components/ui';
import { colors, radius, space } from '../../theme/tokens';

type Tab = 'todo' | 'awaiting_response' | 'responses' | 'upcoming';

function MissionItem({ a }: { a: CallAssignment }) {
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
        <View style={{ marginTop: 4 }}>
          <Badge label={st?.label ?? a.status} tone={st?.tone ?? 'neutral'} />
        </View>
      </View>
    </Pressable>
  );
}

export default function Missions() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'responses' ? 'responses' : 'todo');
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

  // Groupes par jour d'échéance de la mission
  const groups = useMemo(() => {
    const m = new Map<string, CallAssignment[]>();
    for (const a of missions.data ?? []) {
      const k = dateToIso(new Date(a.dueAt));
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    // Urgence d'abord : aujourd'hui et les prochains jours (croissant), puis les retards du plus récent au plus ancien
    const t = todayIso();
    const all = [...m.entries()].map(([date, items]) => ({ date, items }));
    const soon = all.filter((g) => g.date >= t).sort((a, b) => a.date.localeCompare(b.date));
    const late = all.filter((g) => g.date < t).sort((a, b) => b.date.localeCompare(a.date));
    return [...soon, ...late];
  }, [missions.data]);
  const keys = useMemo(() => groups.map((g) => g.date), [groups]);
  const today = todayIso();
  const defaults = useMemo(() => keys.slice(0, 2), [keys]);
  const fold = useFold(keys, defaults);

  const body = () => {
    if (tab === 'responses') {
      if (reports.isPending) return <Loading rows={2} />;
      const list = reports.data ?? [];
      if (!list.length && !drafts.length) {
        return <Empty icon="checkmark-done-outline" title="Aucune réponse en attente" text="Les réponses collées et non encore validées apparaîtront ici." />;
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
          title={tab === 'todo' ? 'Aucun appel à transmettre' : tab === 'awaiting_response' ? 'Aucun retour en attente' : 'Aucune mission à venir'}
          text={tab === 'todo' ? 'Les appels apparaissent ici à l’approche de leur échéance (7 jours).' : undefined}
        />
      );
    }
    return (
      <View style={{ gap: space.md }}>
        <FoldBar count={groups.length} allOpen={fold.allOpen} onToggleAll={fold.toggleAll} label={plural(missions.data?.length ?? 0, 'mission')} />
        {groups.map((g) => (
          <Collapsible
            key={g.date}
            title={fmtDate(g.date, { year: false })}
            subtitle={`${g.date < today ? 'En retard · ' : ''}${relativeDays(g.date)} · ${plural(g.items.length, 'mission')}`}
            tone={g.date < today ? 'warning' : g.date === today ? 'gold' : 'primary'}
            open={fold.isOpen(g.date)}
            onToggle={() => fold.toggle(g.date)}
          >
            {g.items.map((a) => (
              <MissionItem key={a._id} a={a} />
            ))}
          </Collapsible>
        ))}
      </View>
    );
  };

  return (
    <Screen refreshing={missions.isRefetching || reports.isRefetching} onRefresh={() => (tab === 'responses' ? reports.refetch() : missions.refetch())}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'todo', label: 'À faire' },
          { value: 'awaiting_response', label: 'En attente' },
          { value: 'responses', label: 'Réponses' },
          { value: 'upcoming', label: 'À venir' },
        ]}
      />
      <Button title="Enregistrer une réponse" icon="clipboard-outline" variant="secondary" onPress={() => router.push('/responses/new')} />
      {body()}
      {tab !== 'responses' && missions.dataUpdatedAt ? <Small style={{ textAlign: 'center' }}>Mis à jour {fmtDateTime(new Date(missions.dataUpdatedAt))}</Small> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, backgroundColor: colors.bg, borderRadius: radius.md, borderCurve: 'continuous', padding: space.md },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.1 },
});
