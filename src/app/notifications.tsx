import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { Badge, Card, Empty, ErrorState, H3, Loading, Screen, Segmented, Small } from '../components/ui';

interface Job {
  _id: string;
  title: string;
  body: string;
  url: string;
  dueAt: string;
  status: string;
  deliveryStatus: string;
  lastError: string;
  openedAt: string | null;
}

const DELIVERY: Record<string, { label: string; tone: 'neutral' | 'success' | 'info' | 'warning' | 'danger' }> = {
  unknown: { label: 'Programmée', tone: 'neutral' },
  accepted_by_expo: { label: 'Envoyée (non confirmée)', tone: 'info' },
  delivered_to_provider: { label: 'Transmise au téléphone', tone: 'success' },
  error: { label: 'Échec', tone: 'danger' },
  no_device: { label: 'Aucun appareil', tone: 'warning' },
};

export default function Notifications() {
  const [scope, setScope] = useState<'feed' | 'upcoming'>('feed');
  const q = useQuery({ queryKey: ['notifications', scope], queryFn: () => get<Job[]>(`/api/notifications?scope=${scope}`) });
  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Segmented value={scope} onChange={setScope} options={[{ value: 'feed', label: 'Reçues' }, { value: 'upcoming', label: 'Programmées' }]} />
      {!q.data!.length ? <Empty icon="notifications-outline" title="Aucune notification" /> : null}
      {q.data!.map((j) => {
        const d = DELIVERY[j.deliveryStatus] ?? DELIVERY.unknown;
        return (
          <Card key={j._id} onPress={() => router.push(j.url as never)}>
            <H3>{j.title}</H3>
            <Small>{j.body}</Small>
            <Small>{fmtDateTime(j.dueAt)}</Small>
            <Badge label={scope === 'upcoming' ? 'Programmée' : d.label} tone={scope === 'upcoming' ? 'neutral' : d.tone} />
          </Card>
        );
      })}
    </Screen>
  );
}
