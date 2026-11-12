import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import type { Contact } from '../../lib/types';
import { fmtPhone } from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorState, Field, Loading, Row, Screen } from '../../components/ui';
import { space } from '../../theme/tokens';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['contacts'], queryFn: () => get<Contact[]>('/api/contacts') });
  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const k = search.trim().toLowerCase();
  const list = q.data!.filter((c) => !k || c.fullName.toLowerCase().includes(k));
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Button title="Ajouter un responsable" icon="person-add-outline" onPress={() => router.push('/contacts/new')} />
      <Field label="Rechercher" value={search} onChangeText={setSearch} placeholder="Nom du frère" />
      {list.length === 0 ? (
        <Empty icon="person-circle-outline" title="Aucun responsable" text="Les responsables sont ajoutés lors de la validation des documents." />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {list.map((c) => (
            <Row
              key={c._id}
              icon="person-outline"
              title={c.fullName}
              subtitle={c.phones.length ? c.phones.map(fmtPhone).join(' · ') : 'Numéro manquant'}
              right={!c.phones.length ? <Badge label="À compléter" tone="danger" /> : undefined}
              onPress={() => router.push(`/contacts/${c._id}`)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
