import { useState } from 'react';
import { Linking } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post, errorMessage } from '../../lib/api';
import type { Contact, WorkEvent } from '../../lib/types';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { Button, Card, Field, Loading, Row, Screen, Section, Small } from '../../components/ui';
import { space } from '../../theme/tokens';

type Detail = Contact & { events: WorkEvent[] };

export default function ContactEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const q = useQuery({ queryKey: ['contact', id], queryFn: () => get<Detail>(`/api/contacts/${id}`), enabled: !isNew });
  if (!isNew && q.isPending) return <Loading />;
  return <ContactForm key={q.data?._id ?? 'new'} id={id} c={q.data} />;
}

function ContactForm({ id, c }: { id: string; c?: Detail }) {
  const isNew = id === 'new';
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(c?.fullName ?? '');
  const [phones, setPhones] = useState(c?.phones.join(' / ') ?? '');
  const [role, setRole] = useState(c?.role ?? 'Coordinateur de nettoyage');
  const [notes, setNotes] = useState(c?.notes ?? '');

  const save = useMutation({
    mutationFn: () => {
      const body = { fullName, phones: phones.split(/[\/,;]/).map((s) => s.trim()).filter(Boolean), role, notes };
      return isNew ? post('/api/contacts', body) : patch(`/api/contacts/${id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact', id] });
      qc.invalidateQueries({ queryKey: ['missions'] });
      router.back();
    },
    onError: (e) => Alert.alert('Enregistrement impossible', errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/api/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      router.back();
    },
    onError: (e) => Alert.alert('Suppression impossible', errorMessage(e)),
  });

  return (
    <Screen footer={<Button title="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} disabled={fullName.trim().length < 2} />}>
      <Field label="Nom et prénom" value={fullName} onChangeText={setFullName} />
      <Field label="Téléphone(s)" value={phones} onChangeText={setPhones} keyboardType="phone-pad" hint="Plusieurs numéros séparés par « / ». Les messages de mission reprendront ce numéro." />
      <Field label="Fonction" value={role} onChangeText={setRole} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      {c?.phones[0] ? <Button title="Appeler" icon="call-outline" variant="secondary" onPress={() => Linking.openURL(`tel:+${c.phones[0]}`)} /> : null}
      {c ? (
        <>
          <Section title={`Interventions (${c.events.length})`}>
            <Card style={{ paddingVertical: space.xs }}>
              {c.events.length === 0 ? <Small>Aucune intervention.</Small> : null}
              {c.events.map((e) => (
                <Row key={e._id} icon="calendar-outline" title={`${e.congregationName}`} subtitle={fmtDate(e.date)} onPress={() => router.push(`/events/${e._id}`)} />
              ))}
            </Card>
          </Section>
          {c.callLog?.length ? (
            <Section title="Historique des appels">
              <Card>
                {[...c.callLog].reverse().map((l, i) => (
                  <Small key={i}>
                    {fmtDateTime(l.at)} — {l.summary}
                  </Small>
                ))}
              </Card>
            </Section>
          ) : null}
          <Button title="Supprimer" variant="danger" onPress={() => remove.mutate()} loading={remove.isPending} />
        </>
      ) : null}
    </Screen>
  );
}
