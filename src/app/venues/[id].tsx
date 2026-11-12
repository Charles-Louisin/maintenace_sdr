import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post, errorMessage } from '../../lib/api';
import type { Congregation, Venue, WorkEvent } from '../../lib/types';
import { EVENT_STATUS, fmtDate } from '../../lib/format';
import { Badge, Body, Button, Card, Field, Loading, Row, Screen, Section, Small } from '../../components/ui';
import { space } from '../../theme/tokens';

type Detail = Venue & { events: WorkEvent[] };

export default function VenueEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const q = useQuery({ queryKey: ['venue', id], queryFn: () => get<Detail>(`/api/venues/${id}`), enabled: !isNew });
  if (!isNew && q.isPending) return <Loading />;
  return <VenueForm key={q.data?._id ?? 'new'} id={id} v={q.data} />;
}

function VenueForm({ id, v }: { id: string; v?: Detail }) {
  const isNew = id === 'new';
  const qc = useQueryClient();
  const [name, setName] = useState(v?.name ?? '');
  const [city, setCity] = useState(v?.city ?? 'Douala');
  const [address, setAddress] = useState(v?.address ?? '');
  const [notes, setNotes] = useState(v?.notes ?? '');
  const [congs, setCongs] = useState<Partial<Congregation>[]>(v?.congregations ?? []);
  const [newCong, setNewCong] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        city,
        address,
        notes,
        congregations: congs.map((c) => ({
          ...(c._id ? { _id: c._id } : {}),
          name: c.name!,
          aliases: c.aliases ?? [],
          isGroup: Boolean(c.isGroup),
          coordinatorId: c.coordinatorId && typeof c.coordinatorId === 'object' ? c.coordinatorId._id : (c.coordinatorId ?? null),
        })),
      };
      return isNew ? post('/api/venues', body) : patch(`/api/venues/${id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] });
      qc.invalidateQueries({ queryKey: ['venue', id] });
      router.back();
    },
    onError: (e) => Alert.alert('Enregistrement impossible', errorMessage(e)),
  });

  return (
    <Screen footer={<Button title="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} disabled={name.trim().length < 2} />}>
      <Field label="Nom officiel" value={name} onChangeText={setName} />
      <Field label="Ville" value={city} onChangeText={setCity} />
      <Field label="Adresse (facultatif)" value={address} onChangeText={setAddress} />
      <Field label="Observations" value={notes} onChangeText={setNotes} multiline />
      <Section title="Assemblées locales">
        {congs.map((c, i) => (
          <Card key={c._id ?? `n${i}`} style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Body>{c.name}</Body>
              {c.aliases?.length ? <Small>Aussi : {c.aliases.join(', ')}</Small> : null}
            </View>
            {c.isGroup ? <Badge label="Groupe" tone="info" /> : null}
            {!c._id ? <Button title="Retirer" compact variant="danger" onPress={() => setCongs(congs.filter((_, k) => k !== i))} /> : null}
          </Card>
        ))}
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Ajouter une assemblée" value={newCong} onChangeText={setNewCong} />
          </View>
          <Button
            title="Ajouter"
            compact
            variant="secondary"
            onPress={() => {
              if (!newCong.trim()) return;
              setCongs([...congs, { name: newCong.trim(), aliases: [], isGroup: /toutes/i.test(newCong) }]);
              setNewCong('');
            }}
          />
        </View>
      </Section>
      {v ? (
        <Section title={`Historique des interventions (${v.events.length})`}>
          <Card style={{ paddingVertical: space.xs }}>
            {v.events.map((e) => (
              <Row key={e._id} icon="calendar-outline" title={`${e.congregationName} — ${fmtDate(e.date)}`} subtitle={e.tasks.map((t) => t.label).join(', ')} right={<Badge label={EVENT_STATUS[e.status].label} tone={EVENT_STATUS[e.status].tone} />} onPress={() => router.push(`/events/${e._id}`)} />
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
