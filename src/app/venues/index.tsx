import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import type { Venue } from '../../lib/types';
import { Badge, Button, Card, Empty, ErrorState, H3, Loading, Screen, Small } from '../../components/ui';

export default function Venues() {
  const q = useQuery({ queryKey: ['venues'], queryFn: () => get<Venue[]>('/api/venues') });
  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Button title="Ajouter une salle" icon="add-circle-outline" onPress={() => router.push('/venues/new')} />
      {q.data!.length === 0 ? (
        <Empty icon="business-outline" title="Aucune salle" text="Les salles sont créées automatiquement lors de la validation des programmes." />
      ) : (
        q.data!.map((v) => (
          <Card key={v._id} onPress={() => router.push(`/venues/${v._id}`)}>
            <H3>{v.name}</H3>
            <Small>{v.city}{v.address ? ` · ${v.address}` : ''}</Small>
            <Small>Assemblées : {v.congregations.map((c) => c.name).join(', ') || '—'}</Small>
            <Badge label={`${v.eventCount ?? 0} intervention(s)`} tone="primary" />
          </Card>
        ))
      )}
    </Screen>
  );
}
