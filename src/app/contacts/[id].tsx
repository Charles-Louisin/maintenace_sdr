import { useState } from 'react';
import { View } from 'react-native';
import { ContactActions } from '../../components/ContactActions';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post, errorMessage } from '../../lib/api';
import type { Contact, Venue, WorkEvent } from '../../lib/types';
import { CongregationPicker, assignmentSummary, type Assignment } from '../../components/CongregationPicker';
import { fmtDate, fmtDateTime, fmtPhone } from '../../lib/format';
import { Button, Card, Chip, Field, IconButton, Loading, Row, Screen, Section, Small, WaToggle } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

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
  const [numbers, setNumbers] = useState<{ value: string; wa: boolean }[]>(
    c?.phones.length ? c.phones.map((p) => ({ value: fmtPhone(p), wa: Boolean(c.whatsappPhones?.includes(p)) })) : [{ value: '', wa: false }],
  );
  const setNumber = (i: number, patchN: Partial<{ value: string; wa: boolean }>) => setNumbers(numbers.map((n, k) => (k === i ? { ...n, ...patchN } : n)));
  const filled = numbers.filter((n) => n.value.trim());
  const venues = useQuery({ queryKey: ['venues'], queryFn: () => get<Venue[]>('/api/venues') });
  const [assign, setAssign] = useState<Assignment>({ venueIds: (c?.venueIds ?? []).map(String), congregationIds: (c?.congregationIds ?? []).map(String) });
  const [role, setRole] = useState(c?.role ?? 'Coordinateur de nettoyage');
  const [notes, setNotes] = useState(c?.notes ?? '');

  const save = useMutation({
    meta: { success: 'Fiche enregistrée' },
    mutationFn: () => {
      const body = {
        fullName,
        phones: filled.map((n) => n.value.trim()),
        whatsappPhones: filled.filter((n) => n.wa).map((n) => n.value.trim()),
        venueIds: assign.venueIds,
        congregationIds: assign.congregationIds,
        role,
        notes,
      };
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
    meta: { success: 'Responsable supprimé' },
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
      <Section title="Numéros">
        {numbers.map((n, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                label=""
                value={n.value}
                onChangeText={(value) => setNumber(i, { value })}
                keyboardType="phone-pad"
                placeholder={`Numéro ${i + 1}`}
                accessibilityLabel={`Numéro ${i + 1}`}
              />
            </View>
            <WaToggle on={n.wa} onToggle={() => setNumber(i, { wa: !n.wa })} />
            {numbers.length > 1 ? (
              <IconButton icon="close" label={`Retirer le numéro ${i + 1}`} size={36} onPress={() => setNumbers(numbers.filter((_, k) => k !== i))} />
            ) : null}
          </View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {numbers.length < 3 ? <Chip label="+ Ajouter un numéro" onPress={() => setNumbers([...numbers, { value: '', wa: false }])} /> : null}
          {numbers.length > 1 ? (
            <>
              <Chip label="Tous sur WhatsApp" active={numbers.every((x) => x.wa)} onPress={() => setNumbers(numbers.map((x) => ({ ...x, wa: true })))} />
              <Chip label="Aucun sur WhatsApp" active={numbers.every((x) => !x.wa)} onPress={() => setNumbers(numbers.map((x) => ({ ...x, wa: false })))} />
            </>
          ) : null}
        </View>
      </Section>
      <Section title="Assemblées">
        {assignmentSummary(venues.data ?? [], assign) ? (
          <Small style={{ color: colors.text }}>Responsable de : {assignmentSummary(venues.data ?? [], assign)}</Small>
        ) : null}
        <CongregationPicker venues={venues.data ?? []} value={assign} onChange={setAssign} />
      </Section>
      <Field label="Fonction" value={role} onChangeText={setRole} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <ContactActions contact={c} />
      {c ? (
        <>
          <Section title={`Interventions (${c.events.length})`}>
            <Card style={{ paddingVertical: space.xs }}>
              {c.events.length === 0 ? <Small>Aucune intervention.</Small> : null}
              {c.events.map((e) => (
                <Row
                  key={e._id}
                  icon="calendar-outline"
                  title={`${e.congregationName}`}
                  subtitle={fmtDate(e.date)}
                  onPress={() => router.push(`/events/${e._id}`)}
                />
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
