import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFold } from '../../lib/useFold';
import { toast } from '../../components/toast';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post, errorMessage } from '../../lib/api';
import type { Contact, WorkEvent } from '../../lib/types';
import { CALL_STATUS, EVENT_STATUS, OUTCOME, fmtDate, fmtDateTime, fmtPhone, plural } from '../../lib/format';
import { Avatar, Badge, Banner, Body, Button, Card, Chip, Collapsible, Divider, ErrorState, Field, H3, HeroCard, IconButton, Loading, Row, Screen, Section, Segmented, Small } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

const FOLD_KEYS = ['tasks', 'history'];
const FOLD_OPEN = ['tasks'];

const HISTORY: Record<string, string> = {
  created_from_import: 'Créée depuis une importation',
  created_manually: 'Créée manuellement',
  updated_from_import: 'Mise à jour par un nouveau document',
  date_changed: 'Date modifiée',
  updated: 'Modifiée',
  cancelled: 'Annulée',
  reactivated: 'Réactivée',
  post_report_validated: 'Compte rendu après travaux validé',
};

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['work-event', id], queryFn: () => get<WorkEvent>(`/api/work-events/${id}`) });
  const contacts = useQuery({ queryKey: ['contacts'], queryFn: () => get<Contact[]>('/api/contacts') });
  const [editing, setEditing] = useState(false);
  const fold = useFold(FOLD_KEYS, FOLD_OPEN);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [tasks, setTasks] = useState<{ _id?: string; label: string; category: string; description: string }[]>([]);
  const [newTask, setNewTask] = useState('');
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [postTiming, setPostTiming] = useState<'default' | 'next_morning' | 'same_evening'>('default');

  /** Ouvre le mode édition avec les valeurs actuelles de l'intervention. */
  const startEdit = () => {
    const e = q.data;
    if (!e) return;
    setDate(e.date);
    setStartTime(e.startTime ?? '');
    setTasks(e.tasks.map((t) => ({ _id: t._id, label: t.label, category: t.category, description: t.description })));
    setResponsibleId(e.responsibleContactId?._id ?? null);
    setPostTiming(e.postCallTimingOverride ?? 'default');
    setEditing(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['work-event', id] });
    qc.invalidateQueries({ queryKey: ['work-events'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['missions'] });
  };
  const save = useMutation({
    mutationFn: () =>
      patch(`/api/work-events/${id}`, {
        date,
        startTime: startTime || null,
        tasks: tasks.map((t) => ({ ...(t._id ? { _id: t._id } : {}), label: t.label, category: t.category, description: t.description })),
        responsibleContactId: responsibleId,
        postCallTimingOverride: postTiming === 'default' ? null : postTiming,
      }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
      toast.success('Intervention mise à jour · rappels recalculés');
    },
    onError: (e) => Alert.alert('Enregistrement impossible', errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => post(`/api/work-events/${id}/cancel`, { reason: 'Annulée par le propriétaire' }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });
  const reactivate = useMutation({ mutationFn: () => post(`/api/work-events/${id}/reactivate`), onSuccess: invalidate });

  const openDoc = async (docId: string) => {
    try {
      const r = await get<{ url: string }>(`/api/documents/${docId}/download-url`);
      await Linking.openURL(r.url);
    } catch (e) {
      Alert.alert('Document indisponible', errorMessage(e));
    }
  };

  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const e = q.data!;
  const st = EVENT_STATUS[e.status];
  const resp = e.responsibleContactId;

  if (editing) {
    return (
      <Screen
        footer={
          <>
            <Button title="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} />
            <Button title="Annuler les modifications" variant="ghost" onPress={() => setEditing(false)} />
          </>
        }
      >
        <Banner tone="info" icon="information-circle-outline" title="Changement de date">
          Les missions, les rappels et les messages non envoyés seront recalculés automatiquement.
        </Banner>
        <Field label="Date des travaux (AAAA-MM-JJ)" value={date} onChangeText={setDate} autoCapitalize="none" />
        <Field label="Heure de début (facultatif, HH:MM)" value={startTime} onChangeText={setStartTime} placeholder="08:00" />
        <Section title="Rappel après travaux">
          <Segmented
            value={postTiming}
            onChange={setPostTiming}
            options={[
              { value: 'default', label: 'Par défaut' },
              { value: 'next_morning', label: 'Lendemain' },
              { value: 'same_evening', label: 'Le soir même' },
            ]}
          />
        </Section>
        <Section title="Responsable">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(contacts.data ?? []).map((c) => (
              <Chip key={c._id} label={c.fullName} active={responsibleId === c._id} onPress={() => setResponsibleId(c._id)} />
            ))}
          </View>
        </Section>
        <Section title="Tâches">
          {tasks.map((t, i) => (
            <Card key={t._id ?? `n${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
              <View style={{ flex: 1 }}>
                <Body>{t.label}</Body>
                {t.category ? <Small>{t.category}</Small> : null}
              </View>
              <Button title="Retirer" variant="danger" compact onPress={() => setTasks(tasks.filter((_, k) => k !== i))} />
            </Card>
          ))}
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field label="Nouvelle tâche" value={newTask} onChangeText={setNewTask} />
            </View>
            <Button
              title="Ajouter"
              compact
              variant="secondary"
              onPress={() => {
                if (!newTask.trim()) return;
                setTasks([...tasks, { label: newTask.trim(), category: '', description: '' }]);
                setNewTask('');
              }}
            />
          </View>
        </Section>
      </Screen>
    );
  }

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <HeroCard>
        <Badge label={st.label} tone={e.status === 'cancelled' ? 'danger' : 'gold'} />
        <Text style={{ color: colors.onPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: space.sm }}>Salle de {e.venueId?.name}</Text>
        <Text style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '600' }}>{e.congregationName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs }}>
          <Ionicons name="calendar-outline" size={15} color={colors.gold} />
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 14 }}>
            {fmtDate(e.date)}
            {e.startTime ? ` · ${e.startTime}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {[...new Set(e.tasks.map((t) => t.category).filter(Boolean))].map((c) => (
            <View key={c} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(248,244,236,0.1)' }}>
              <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '600' }}>{c}</Text>
            </View>
          ))}
        </View>
      </HeroCard>
      {e.status === 'cancelled' ? <Banner tone="danger" title="Intervention annulée">{e.cancelledReason || 'Les rappels futurs ont été supprimés. L’historique est conservé.'}</Banner> : null}

      <Section title="Responsable">
        <Card onPress={resp ? () => router.push(`/contacts/${resp._id}`) : undefined} accessibilityLabel={resp ? `Fiche de ${resp.fullName}` : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar name={resp?.fullName ?? '?'} size={48} tone={resp?.phones?.length ? 'primary' : 'danger'} />
            <View style={{ flex: 1, gap: 2 }}>
              <H3>{resp?.fullName ?? 'Responsable non renseigné'}</H3>
              <Small style={!resp?.phones?.length ? { color: colors.danger } : undefined}>{resp?.phones?.[0] ? fmtPhone(resp.phones[0]) : 'Numéro manquant'}</Small>
            </View>
            {resp?.phones?.[0] ? <IconButton icon="call" label={`Appeler ${resp.fullName}`} tone="primary" onPress={() => Linking.openURL(`tel:+${resp.phones[0]}`)} /> : null}
          </View>
        </Card>
      </Section>

      <Collapsible title="Travaux" subtitle={plural(e.tasks.length, 'tâche')} tone="primary" open={fold.isOpen('tasks')} onToggle={() => fold.toggle('tasks')}>
        {e.tasks.map((t) => {
          const cat = typeof t.catalogEntryId === 'object' ? t.catalogEntryId : null;
          const o = OUTCOME[t.outcome];
          return (
            <View key={t._id} style={{ backgroundColor: colors.bg, borderRadius: 16, padding: space.lg, gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <H3 style={{ flex: 1 }}>{t.label}</H3>
                {e.status !== 'scheduled' ? <Badge label={o.label} tone={o.tone} /> : null}
              </View>
              {t.category ? <Small>{t.category}{t.catalogRef ? ` · ${t.catalogRef}` : ''}</Small> : t.catalogRef ? <Small>{t.catalogRef}</Small> : null}
              {t.description ? <Body>{t.description}</Body> : null}
              {cat ? (
                <View style={{ gap: 4, marginTop: 4 }}>
                  {cat.frequency ? <Small>Fréquence : {cat.frequency}</Small> : null}
                  {cat.materials?.length ? <Small>Matériel : {cat.materials.join(', ')}</Small> : null}
                  {cat.ppe?.length ? <Small>EPI : {cat.ppe.join(', ')}</Small> : null}
                  {cat.steps?.slice(0, 6).map((s, i) => (
                    <Small key={i}>• {s}</Small>
                  ))}
                </View>
              ) : null}
              {t.outcomeNote ? <Small style={{ fontStyle: 'italic' }}>{t.outcomeNote}</Small> : null}
            </View>
          );
        })}
      </Collapsible>

      <Section title="Appels prévus">
        <Card style={{ paddingVertical: space.xs }}>
          {e.calls.map((c, i) => {
            const s = CALL_STATUS[c.status];
            return (
              <View key={c._id}>
                {i > 0 ? <Divider /> : null}
                <Row
                  icon={c.type === 'pre' ? 'arrow-forward-circle-outline' : 'arrow-undo-circle-outline'}
                  title={c.type === 'pre' ? 'Appel préalable' : 'Appel de suivi'}
                  subtitle={`${fmtDateTime(c.dueAt)} · ${c.volunteerId?.fullName ?? 'Aucun volontaire'}`}
                  right={<Badge label={s?.label ?? c.status} tone={s?.tone ?? 'neutral'} />}
                  onPress={() => router.push(`/missions/${c._id}`)}
                />
              </View>
            );
          })}
        </Card>
      </Section>

      {e.reports?.length ? (
        <Section title="Résultats des appels">
          {e.reports.map((r) => (
            <Card key={r._id} onPress={() => router.push(`/responses/${r._id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <H3>{r.type === 'pre' ? 'Avant travaux' : 'Après travaux'}</H3>
                <Badge label={r.status === 'validated' ? 'Validé' : 'Brouillon'} tone={r.status === 'validated' ? 'success' : 'warning'} />
              </View>
              <Body numberOfLines={3}>{r.validated?.summary || r.originalText}</Body>
            </Card>
          ))}
        </Section>
      ) : null}

      {e.documents?.length ? (
        <Section title="Documents sources">
          <Card style={{ paddingVertical: space.xs }}>
            {e.documents.map((d) => {
              const src = e.sources?.find((s) => String(s.documentId) === d._id);
              const where = src?.page ? `page ${src.page}` : src?.sheet ? `feuille « ${src.sheet} », ligne ${src.row}` : '';
              return <Row key={d._id} icon="document-outline" title={d.originalName} subtitle={where} onPress={() => openDoc(d._id)} />;
            })}
          </Card>
        </Section>
      ) : null}

      {e.history?.length ? (
        <Collapsible title="Historique" subtitle={plural(e.history.length, 'événement')} open={fold.isOpen('history')} onToggle={() => fold.toggle('history')}>
          {[...e.history].reverse().map((h, i) => (
            <Small key={i} style={{ paddingHorizontal: space.sm, paddingVertical: 4 }}>
              {fmtDateTime(h.at)} — {HISTORY[h.action] ?? h.action}
            </Small>
          ))}
        </Collapsible>
      ) : null}

      {e.status === 'cancelled' ? (
        <Button title="Réactiver l’intervention" variant="secondary" onPress={() => reactivate.mutate()} loading={reactivate.isPending} />
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title="Modifier" icon="create-outline" variant="secondary" onPress={startEdit} />
          <Button
            title="Annuler l’intervention"
            variant="danger"
            loading={cancel.isPending}
            onPress={() =>
              Alert.alert('Annuler cette intervention ?', 'Les rappels futurs seront supprimés. L’historique est conservé.', [
                { text: 'Non', style: 'cancel' },
                { text: 'Annuler l’intervention', style: 'destructive', onPress: () => cancel.mutate() },
              ])
            }
          />
        </View>
      )}
    </Screen>
  );
}
