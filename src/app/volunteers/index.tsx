import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import type { Volunteer } from '../../lib/types';
import { fmtDateTime, fmtPhone } from '../../lib/format';
import { Badge, Body, Button, Card, Empty, ErrorState, H3, Loading, Screen, Small } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

export default function Volunteers() {
  const q = useQuery({ queryKey: ['volunteers'], queryFn: () => get<Volunteer[]>('/api/volunteers') });
  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const list = q.data!;
  const max = Math.max(1, ...list.map((v) => v.stats?.windowMissions ?? 0));
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Button title="Ajouter un volontaire" icon="person-add-outline" onPress={() => router.push('/volunteers/new')} />
      {list.length === 0 ? (
        <Empty icon="people-outline" title="Aucun volontaire" text="Ajoutez les frères qui effectuent les appels." />
      ) : (
        list.map((v) => {
          const s = v.stats;
          return (
            <Card key={v._id} onPress={() => router.push(`/volunteers/${v._id}`)} style={!v.active ? { opacity: 0.6 } : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <H3 style={{ flex: 1 }}>{v.fullName}</H3>
                <Badge label={v.active ? 'Actif' : 'Inactif'} tone={v.active ? 'success' : 'neutral'} />
              </View>
              <Small>{fmtPhone(v.whatsapp)}</Small>
              <Body style={{ fontSize: 13 }}>
                Ce mois : {s?.monthMissions ?? 0} · {s?.windowMonths ?? 3} derniers mois : {s?.windowMissions ?? 0} · Total : {s?.totalMissions ?? 0}
              </Body>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt }}>
                <View style={{ width: `${((s?.windowMissions ?? 0) / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              </View>
              <Small>Dernière mission : {s?.lastMissionAt ? fmtDateTime(s.lastMissionAt) : 'aucune'}</Small>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
