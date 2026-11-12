import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, errorMessage } from '../../lib/api';
import type { ImportBatch, Proposal } from '../../lib/types';
import { Banner, Body, Button, Card, Chip, Field, Loading, Screen, Section, Small } from '../../components/ui';
import { space } from '../../theme/tokens';

/** Correction d'une intervention extraite (reste en BROUILLON). */
export default function EditProposal() {
  const { batch, ex, pid } = useLocalSearchParams<{ batch: string; ex: string; pid: string }>();
  const q =useQuery({ queryKey: ['batch', batch], queryFn: () => get<ImportBatch>(`/api/documents/batches/${batch}`) });
  const p = q.data?.extraction?.proposals.find((x) => x._id === pid);
  if (!p) return <Loading />;
  return <ProposalForm key={p._id} p={p} batch={batch} ex={ex} />;
}

function ProposalForm({ p, batch, ex }: { p: Proposal; batch: string; ex: string }) {
  const pid = p._id;
  const qc = useQueryClient();
  const [form, setForm] = useState({
    date: p.date ?? '',
    venueName: p.venueName,
    congregationName: p.congregationName,
    startTime: p.startTime ?? '',
    name: p.responsible.name,
    phone: p.responsible.phone ?? '',
  });
  const [tasks, setTasks] = useState<Proposal['tasks']>(p.tasks);
  const [newTask, setNewTask] = useState('');
  const [contactChoice, setContactChoice] = useState<string | 'new' | null>(p.responsible.contactId);

  const save = useMutation({
    mutationFn: () =>
      patch(`/api/extractions/${ex}/proposals/${pid}`, {
        date: form.date || null,
        venueName: form.venueName,
        congregationName: form.congregationName,
        startTime: form.startTime || null,
        tasks: tasks.map(({ _id, label, category, description, catalogRef, catalogEntryId, catalogProposalId }) => ({
          ...(_id.startsWith('new-') ? {} : { _id }),
          label,
          category,
          description,
          catalogRef,
          catalogEntryId,
          catalogProposalId,
        })),
        responsible: {
          name: form.name,
          phone: form.phone || null,
          ...(contactChoice === 'new' ? { confirmNew: true } : contactChoice ? { contactId: contactChoice } : {}),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batch', batch] });
      router.back();
    },
    onError: (e) => Alert.alert('Correction refusée', errorMessage(e)),
  });

  const set =(k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <Screen footer={<Button title="Enregistrer la correction" onPress={() => save.mutate()} loading={save.isPending} />}>
      <Field label="Date des travaux (AAAA-MM-JJ)" value={form.date} onChangeText={set('date')} autoCapitalize="none" placeholder="2026-12-06" />
      <Field label="Salle du Royaume" value={form.venueName} onChangeText={set('venueName')} />
      <Field label="Assemblée" value={form.congregationName} onChangeText={set('congregationName')} />
      <Field label="Heure de début (facultatif)" value={form.startTime} onChangeText={set('startTime')} placeholder="08:00" />

      <Section title="Frère responsable">
        <Field label="Nom" value={form.name} onChangeText={set('name')} />
        <Field label="Téléphone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="6XX XX XX XX" hint="Format camerounais ou international." />
        {p.responsible.candidates.length ? (
          <Card>
            <Small>Contacts proches dans le registre : choisissez la bonne personne ou confirmez un nouveau contact.</Small>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {p.responsible.candidates.map((c) => (
                <Chip key={c.contactId} label={`${c.fullName} (${Math.round(c.score * 100)} %)`} active={contactChoice === c.contactId} onPress={() => setContactChoice(c.contactId)} />
              ))}
              <Chip label="Nouvelle personne" active={contactChoice === 'new'} onPress={() => setContactChoice('new')} />
            </View>
          </Card>
        ) : null}
        {p.responsible.matchStatus === 'ambiguous' && !contactChoice ? <Banner tone="warning" title="Choix nécessaire">Les noms se ressemblent : aucune association automatique n’est faite.</Banner> : null}
      </Section>

      <Section title="Tâches">
        {tasks.map((t, i) => (
          <Card key={t._id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
            <View style={{ flex: 1 }}>
              <Body>{t.label}</Body>
              {t.description ? <Small numberOfLines={2}>{t.description}</Small> : null}
            </View>
            <Button title="Retirer" variant="danger" compact onPress={() => setTasks(tasks.filter((_, k) => k !== i))} />
          </Card>
        ))}
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Ajouter une tâche" value={newTask} onChangeText={setNewTask} />
          </View>
          <Button
            title="Ajouter"
            compact
            variant="secondary"
            onPress={() => {
              if (!newTask.trim()) return;
              setTasks([...tasks, { _id: `new-${Date.now()}`, label: newTask.trim(), category: '', description: '', catalogRef: '', catalogEntryId: null, catalogProposalId: null }]);
              setNewTask('');
            }}
          />
        </View>
      </Section>
    </Screen>
  );
}
