import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post, errorMessage } from '../../lib/api';
import { pickAndUploadImage } from '../../lib/images';
import { toast } from '../../components/toast';
import type { Congregation, Venue, WorkEvent } from '../../lib/types';
import { EVENT_STATUS, fmtDate } from '../../lib/format';
import { Badge, Button, Card, Field, HeroCard, IconButton, Loading, Row, Screen, Section, Small, Body } from '../../components/ui';
import { colors, space } from '../../theme/tokens';
import { UploadButton } from '../../components/UploadButton';

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
  const [weekly, setWeekly] = useState(Boolean(v?.weeklySchedule));
  const [congs, setCongs] = useState<Partial<Congregation>[]>(v?.congregations ?? []);
  const [newCong, setNewCong] = useState('');
  const [photo, setPhoto] = useState<string | null>(v?.imageUrl ?? null);
  const refreshVenues = () => {
    qc.invalidateQueries({ queryKey: ['venues'] });
    qc.invalidateQueries({ queryKey: ['venue', id] });
  };
  const choosePhoto = async () => {
    try {
      const r = await pickAndUploadImage<{ imageUrl: string }>(
        `/api/uploads/images/venues/${id}`,
        [16, 9],
        'Photo de la salle',
        'Photo de la salle enregistrée',
      );
      if (!r) return;
      setPhoto(r.imageUrl);
      refreshVenues();
    } catch {
      // erreur déjà signalée par un toast
    }
  };
  const removePhoto = async () => {
    try {
      await del(`/api/uploads/images/venues/${id}`);
      setPhoto(null);
      refreshVenues();
      toast.success('Photo retirée');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const save = useMutation({
    meta: { success: 'Salle enregistrée' },
    mutationFn: () => {
      const body = {
        name,
        city,
        address,
        notes,
        weeklySchedule: weekly,
        congregations: congs.map((c) => ({
          ...(c._id ? { _id: c._id } : {}),
          name: c.name!,
          aliases: c.aliases ?? [],
          coordinatorId: c.coordinatorId && typeof c.coordinatorId === 'object' ? c.coordinatorId._id : (c.coordinatorId ?? null),
        })),
      };
      return isNew ? post('/api/venues', body) : patch(`/api/venues/${id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] });
      qc.invalidateQueries({ queryKey: ['venue', id] });
      // Les noms apparaissent partout : planning, missions, accueil
      for (const k of ['work-events', 'work-event', 'missions', 'mission', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
      router.back();
    },
    onError: (e) => Alert.alert('Enregistrement impossible', errorMessage(e)),
  });

  return (
    <Screen
      footer={
        <Button
          title="Enregistrer"
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={name.trim().length < 2 || congs.some((c) => !c.name?.trim())}
        />
      }
    >
      {!isNew ? (
        <Section title="Photo de la salle">
          <HeroCard image={photo} style={{ minHeight: 150, justifyContent: 'flex-end' }}>
            <Text style={{ color: colors.onPrimary, fontSize: 20, fontWeight: '700' }}>{name || 'Salle'}</Text>
            <Text style={{ color: colors.onPrimaryMuted, fontSize: 13 }}>{photo ? 'Aperçu avec le voile' : 'Aucune photo'}</Text>
          </HeroCard>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <UploadButton
              uploadKey={`venue:${id}`}
              title={photo ? 'Changer' : 'Choisir une photo'}
              icon="image-outline"
              onPress={() => void choosePhoto()}
              style={{ flex: 1 }}
            />
            {photo ? <Button title="Retirer" variant="ghost" onPress={removePhoto} style={{ flex: 1 }} /> : null}
          </View>
        </Section>
      ) : null}
      <Field label="Nom officiel" value={name} onChangeText={setName} />
      <Field label="Ville" value={city} onChangeText={setCity} />
      <Field label="Adresse (facultatif)" value={address} onChangeText={setAddress} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body style={{ fontWeight: '600' }}>Programme à la semaine</Body>
          <Small>« Semaine du » : le jour est demandé au responsable</Small>
        </View>
        <Switch value={weekly} onValueChange={setWeekly} accessibilityLabel="Programme à la semaine" />
      </Card>
      <Field label="Observations" value={notes} onChangeText={setNotes} multiline />
      <Section title="Assemblées locales">
        {congs.map((c, i) => (
          <Card key={c._id ?? `n${i}`} style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.sm }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Field label="Nom de l’assemblée" value={c.name ?? ''} onChangeText={(name) => setCongs(congs.map((x, k) => (k === i ? { ...x, name } : x)))} />
              {c.aliases?.length ? <Small>Aussi reconnue sous : {c.aliases.join(', ')}</Small> : null}
            </View>
            <IconButton icon="trash-outline" label={`Retirer ${c.name}`} tone="danger" onPress={() => setCongs(congs.filter((_, k) => k !== i))} />
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
              setCongs([...congs, { name: newCong.trim(), aliases: [] }]);
              setNewCong('');
            }}
          />
        </View>
      </Section>
      {v ? (
        <Section title={`Historique des interventions (${v.events.length})`}>
          <Card style={{ paddingVertical: space.xs }}>
            {v.events.map((e) => (
              <Row
                key={e._id}
                icon="calendar-outline"
                title={`${e.congregationName} — ${fmtDate(e.date)}`}
                subtitle={e.tasks.map((t) => t.label).join(', ')}
                right={<Badge label={EVENT_STATUS[e.status].label} tone={EVENT_STATUS[e.status].tone} />}
                onPress={() => router.push(`/events/${e._id}`)}
              />
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
