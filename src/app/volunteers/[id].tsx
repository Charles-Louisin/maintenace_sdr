import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { del, get, patch, post, errorMessage } from '../../lib/api';
import type { Volunteer, CallAssignment, WorkEvent } from '../../lib/types';
import { CALL_STATUS, WEEKDAYS, fmtDate, fmtDateTime } from '../../lib/format';
import { Badge, Body, Button, Card, Chip, Field, H3, Loading, Row, Screen, Section, Small } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

const schema = z.object({
  fullName: z.string().min(2, 'Nom requis'),
  whatsapp: z.string().min(8, 'Numéro WhatsApp requis'),
  notes: z.string().optional(),
  skills: z.string().optional(),
});

type Detail = Volunteer & { missions: (CallAssignment & { workEventId: WorkEvent })[] };

export default function VolunteerEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const q = useQuery({ queryKey: ['volunteer', id], queryFn: () => get<Detail>(`/api/volunteers/${id}`), enabled: !isNew });
  if (!isNew && q.isPending) return <Loading />;
  return <VolunteerForm key={q.data?._id ?? 'new'} id={id} v={q.data} />;
}

function VolunteerForm({ id, v }: { id: string; v?: Detail }) {
  const isNew = id === 'new';
  const qc = useQueryClient();
  const [active, setActive] = useState(v?.active ?? true);
  const [days, setDays] = useState<number[]>(v?.weeklyAvailability.map((w) => w.weekday) ?? []);
  const [unav, setUnav] = useState<{ from: string; to: string; reason?: string }[]>(v?.unavailabilities ?? []);
  const [uFrom, setUFrom] = useState('');
  const [uTo, setUTo] = useState('');
  const [uReason, setUReason] = useState('');
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: v?.fullName ?? '', whatsapp: v?.whatsapp ?? '', notes: v?.notes ?? '', skills: v?.skills.join(', ') ?? '' },
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ['volunteers'] });
    qc.invalidateQueries({ queryKey: ['volunteer', id] });
  };
  const save = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => {
      const body = {
        fullName: v.fullName,
        whatsapp: v.whatsapp,
        notes: v.notes ?? '',
        skills: (v.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        active,
        weeklyAvailability: days.map((weekday) => ({ weekday })),
        unavailabilities: unav,
      };
      return isNew ? post('/api/volunteers', body) : patch(`/api/volunteers/${id}`, body);
    },
    onSuccess: (r) => {
      done();
      const reassigned = (r as { reassigned?: number })?.reassigned;
      toast.success(reassigned ? `Enregistré · ${reassigned} mission(s) réattribuée(s)` : 'Volontaire enregistré');
      router.back();
    },
    onError: (e) => Alert.alert('Enregistrement impossible', errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del<{ historyKept: boolean }>(`/api/volunteers/${id}`),
    onSuccess: (r) => {
      done();
      toast.success(r.historyKept ? 'Volontaire supprimé · historique conservé' : 'Volontaire supprimé');
      router.back();
    },
    onError: (e) => Alert.alert('Suppression impossible', errorMessage(e)),
  });

  return (
    <Screen footer={<Button title="Enregistrer" onPress={handleSubmit((x) => save.mutate(x))} loading={save.isPending} />}>
      <Controller control={control} name="fullName" render={({ field }) => <Field label="Nom et prénom" value={field.value} onChangeText={field.onChange} error={formState.errors.fullName?.message} />} />
      <Controller control={control} name="whatsapp" render={({ field }) => <Field label="Numéro WhatsApp" value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" hint="Ex. 6XX XX XX XX ou +237…" error={formState.errors.whatsapp?.message} />} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <H3>Actif</H3>
          <Small>Un volontaire inactif ne reçoit plus de missions.</Small>
        </View>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary }} />
      </Card>
      <Section title="Jours disponibles (aucun = tous les jours)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {WEEKDAYS.map((d, i) => (
            <Chip key={d} label={d} active={days.includes(i + 1)} onPress={() => setDays(days.includes(i + 1) ? days.filter((x) => x !== i + 1) : [...days, i + 1])} />
          ))}
        </View>
      </Section>
      <Section title="Indisponibilités particulières">
        {unav.map((u, i) => (
          <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: space.md }}>
            <Body style={{ flex: 1 }}>
              Du {fmtDate(u.from, { weekday: false })} au {fmtDate(u.to, { weekday: false })}
              {u.reason ? ` — ${u.reason}` : ''}
            </Body>
            <Button title="Retirer" variant="danger" compact onPress={() => setUnav(unav.filter((_, k) => k !== i))} />
          </Card>
        ))}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Du (AAAA-MM-JJ)" value={uFrom} onChangeText={setUFrom} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Au" value={uTo} onChangeText={setUTo} autoCapitalize="none" />
          </View>
        </View>
        <Field label="Motif (facultatif)" value={uReason} onChangeText={setUReason} />
        <Button
          title="Ajouter l’indisponibilité"
          variant="secondary"
          compact
          onPress={() => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(uFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(uTo) || uTo < uFrom) return Alert.alert('Dates invalides', 'Format AAAA-MM-JJ, la fin après le début.');
            setUnav([...unav, { from: uFrom, to: uTo, reason: uReason }]);
            setUFrom('');
            setUTo('');
            setUReason('');
          }}
        />
      </Section>
      <Controller control={control} name="skills" render={({ field }) => <Field label="Compétences (séparées par des virgules)" value={field.value} onChangeText={field.onChange} placeholder="Électricité, plomberie…" />} />
      <Controller control={control} name="notes" render={({ field }) => <Field label="Notes" value={field.value} onChangeText={field.onChange} multiline />} />

      {v ? (
        <Section title={`Historique des missions (${v.missions.length})`}>
          <Card style={{ paddingVertical: space.xs }}>
            {v.missions.length === 0 ? <Small>Aucune mission.</Small> : null}
            {v.missions.slice(0, 50).map((m) => {
              const st = CALL_STATUS[m.status];
              const e = m.workEventId;
              return (
                <Row
                  key={m._id}
                  icon={m.type === 'pre' ? 'arrow-forward-circle-outline' : 'arrow-undo-circle-outline'}
                  title={`${(e?.venueId as unknown as { name?: string })?.name ?? ''} · ${e?.congregationName ?? ''}`}
                  subtitle={`${m.type === 'pre' ? 'Avant' : 'Après'} · ${fmtDateTime(m.dueAt)}`}
                  right={<Badge label={st?.label ?? m.status} tone={st?.tone ?? 'neutral'} />}
                  onPress={() => router.push(`/missions/${m._id}`)}
                />
              );
            })}
          </Card>
        </Section>
      ) : null}
      {!isNew ? (
        <Button
          title="Supprimer le volontaire"
          variant="danger"
          onPress={() =>
            Alert.alert('Supprimer ce volontaire ?', 'S’il a déjà effectué des missions, il sera désactivé et son historique conservé. Ses missions futures seront réattribuées.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: () => remove.mutate() },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}
