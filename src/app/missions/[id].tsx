import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scheduledJobIds, syncLocalReminders } from '../../lib/localReminders';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { toast } from '../../components/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post, errorMessage } from '../../lib/api';
import type { CallAssignment, RankedVolunteer } from '../../lib/types';
import { CALL_STATUS, fmtDateTime, fmtPhone, fmtTime, isWhatsapp, whatsappUrl, fmtEventDate } from '../../lib/format';
import {
  Avatar,
  Badge,
  Banner,
  Body,
  Button,
  Card,
  ErrorState,
  Field,
  H2,
  H3,
  IconButton,
  KeyValue,
  Loading,
  Screen,
  Section,
  Small,
  VenueThumb,
  WaMark,
} from '../../components/ui';
import { colors, radius, shadow, space } from '../../theme/tokens';
import { useVenueImages, useVenueLookup } from '../../lib/images';
import { WeekDayPicker } from '../../components/WeekDayPicker';

async function copy(value: string, message: string) {
  await Clipboard.setStringAsync(value);
  toast.success(message);
}

export default function MissionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['mission', id], queryFn: () => get<CallAssignment>(`/api/call-assignments/${id}`) });
  /** Brouillon local du message : null tant que le propriétaire ne l'a pas modifié (on affiche alors la version serveur). */
  const [draft, setDraft] = useState<string | null>(null);
  const dirty = draft !== null;
  const text = draft ?? q.data?.message?.text ?? '';
  const setText = (t: string) => setDraft(t);
  const setDirty = (d: boolean) => !d && setDraft(null);
  const [showRanking, setShowRanking] = useState(false);
  const ranking = useQuery({
    queryKey: ['mission-ranking', id],
    queryFn: () => get<{ ranking: RankedVolunteer[] }>(`/api/call-assignments/${id}/recommendations`),
    enabled: showRanking,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['mission', id] });
    qc.invalidateQueries({ queryKey: ['missions'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['work-events'] });
  };
  const saveMessage = useMutation({
    mutationFn: () => patch(`/api/call-assignments/${id}/message`, { text }),
    onSuccess: () => {
      setDirty(false);
      refresh();
      toast.success('Message enregistré');
    },
  });
  const assign = useMutation({
    meta: { success: 'Volontaire mis à jour' },
    mutationFn: (body: { volunteerId: string | null; auto?: boolean }) => post(`/api/call-assignments/${id}/assign`, body),
    onSuccess: () => {
      setDirty(false);
      setShowRanking(false);
      refresh();
      qc.invalidateQueries({ queryKey: ['mission-ranking', id] });
    },
    onError: (e) => Alert.alert('Attribution impossible', errorMessage(e)),
  });
  const markSent = useMutation({
    mutationFn: () => post(`/api/call-assignments/${id}/mark-sent`),
    onSuccess: () => {
      toast.success('Envoi confirmé');
      refresh();
    },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });
  const unmark = useMutation({ mutationFn: () => post(`/api/call-assignments/${id}/unmark-sent`), onSuccess: refresh });
  const [note, setNote] = useState('');
  const venueImage = useVenueImages();
  const venueOf = useVenueLookup();
  const [now] = useState(() => Date.now());
  const complete = useMutation({
    mutationFn: (outcome: 'done' | 'not_done') => post(`/api/call-assignments/${id}/complete`, { note, outcome }),
    onSuccess: (_r, outcome) => {
      toast.success(outcome === 'done' ? 'Mission terminée · faite' : 'Mission terminée · non faite');
      setNote('');
      refresh();
    },
    onError: (e) => Alert.alert('Enregistrement impossible', errorMessage(e)),
  });
  const reopen = useMutation({
    mutationFn: () => post(`/api/call-assignments/${id}/reopen`),
    onSuccess: () => {
      toast.info('Mission rouverte · rappels réactivés');
      refresh();
    },
  });
  // Rappels réellement programmés sur CE téléphone (notifications locales)
  const [onPhone, setOnPhone] = useState<Set<string> | null>(null);
  const reminderKey = (q.data?.reminders ?? []).map((x) => x._id + x.status).join(',');
  useEffect(() => {
    let alive = true;
    syncLocalReminders()
      .then(scheduledJobIds)
      .then((ids) => alive && setOnPhone(ids));
    return () => {
      alive = false;
    };
  }, [reminderKey]);

  // Retour de WhatsApp : l’application demande d’elle-même si le message est parti
  const askOnReturn = useRef(false);
  const volunteerName = useRef('');
  const markSentMutate = markSent.mutate;
  useEffect(() => {
    volunteerName.current = q.data?.volunteerId?.fullName ?? '';
  }, [q.data]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !askOnReturn.current) return;
      askOnReturn.current = false;
      setTimeout(
        () =>
          Alert.alert('Message envoyé ?', `L’avez-vous envoyé à ${volunteerName.current} ?`, [
            { text: 'Pas encore', style: 'cancel' },
            { text: 'Oui, envoyé', onPress: () => markSentMutate() },
          ]),
        400,
      );
    });
    return () => sub.remove();
  }, [markSentMutate]);

  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const a = q.data!;
  const e = a.event!;
  const st = CALL_STATUS[a.status];
  const weekly = Boolean(venueOf(e.venueId?._id)?.weeklySchedule);
  const v = a.volunteerId;
  /** Message parti chez le volontaire actuel (ne veut PAS dire que la tâche est faite) */
  const sent = ['message_sent', 'response_received'].includes(a.status);
  /** Confirmation explicite que la mission est accomplie */
  const done = a.status === 'completed';
  const locked = sent || done;
  const sends = a.sends ?? [];
  const pickVolunteer = (volunteerId: string, name: string) => {
    if (!sent) return assign.mutate({ volunteerId });
    Alert.alert('Renvoyer à un autre volontaire', `Préparer un nouvel envoi pour ${name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui, renvoyer', onPress: () => assign.mutate({ volunteerId }) },
    ]);
  };
  const finish = (outcome: 'done' | 'not_done') =>
    Alert.alert(outcome === 'done' ? 'Mission faite ?' : 'Mission non faite ?', outcome === 'done' ? 'Les rappels s’arrêtent.' : 'Les rappels s’arrêtent.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: outcome === 'done' ? 'Oui, faite' : 'Oui, non faite',
        style: outcome === 'done' ? 'default' : 'destructive',
        onPress: () => complete.mutate(outcome),
      },
    ]);
  const overdue = !done && new Date(a.dueAt).getTime() < now;
  const reminders = a.reminders ?? [];
  const upcoming = reminders.filter((x) => x.status === 'scheduled');
  const past = reminders.filter((x) => x.status !== 'scheduled');
  const missing = text.includes('[À COMPLÉTER]');

  const openWhatsApp = async () => {
    if (!v) return;
    if (dirty) await saveMessage.mutateAsync().catch(() => undefined);
    post(`/api/call-assignments/${id}/whatsapp-opened`).catch(() => undefined);
    try {
      await Linking.openURL(whatsappUrl(v.whatsapp, text));
      if (Platform.OS !== 'web') askOnReturn.current = true;
    } catch {
      Alert.alert('WhatsApp introuvable', 'Copiez le message et collez-le dans WhatsApp.');
    }
  };

  const confirmSent = () =>
    Alert.alert('Confirmer l’envoi', `Message envoyé à ${v?.fullName} ?`, [
      { text: 'Pas encore', style: 'cancel' },
      { text: 'Oui, message envoyé', onPress: () => markSent.mutate() },
    ]);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Badge label={a.type === 'pre' ? 'Appel préalable' : 'Appel de suivi'} tone={a.type === 'pre' ? 'primary' : 'info'} />
          <Badge label={st?.label ?? a.status} tone={st?.tone ?? 'neutral'} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <VenueThumb image={venueImage(e.venueId?._id)} size={44} />
          <H2 style={{ flex: 1 }}>{e.venueId?.name}</H2>
        </View>
        <Body style={{ color: colors.textMuted }}>
          {e.congregationName} · travaux : {fmtEventDate(e, weekly)}
        </Body>
        <Small>Échéance de la mission : {fmtDateTime(a.dueAt)}</Small>
      </View>

      {done ? (
        <Banner
          tone="success"
          icon="checkmark-done-circle"
          title={a.completionOutcome === 'not_done' ? 'Terminée · non faite' : 'Terminée · faite'}
          action={
            <Button
              title="Rouvrir la mission"
              variant="ghost"
              compact
              onPress={() => reopen.mutate()}
              loading={reopen.isPending}
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
            />
          }
        >
          {`Confirmé le ${fmtDateTime(a.completedAt ?? a.sentConfirmedAt)}.${
            a.completionNote
              ? `
Commentaire : ${a.completionNote}`
              : ''
          }`}
        </Banner>
      ) : sent ? (
        <Banner
          tone="info"
          icon="paper-plane-outline"
          title={`Message envoyé à ${v?.fullName ?? 'un volontaire'}`}
          action={
            <Button
              title="Enregistrer la réponse reçue"
              compact
              onPress={() => router.push(`/responses/new?assignment=${a._id}`)}
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
            />
          }
        >
          {`Le ${fmtDateTime(a.sentConfirmedAt)} · mission pas encore terminée`}
        </Banner>
      ) : sends.length ? (
        <Banner tone="warning" icon="refresh-outline" title="Nouvel envoi en préparation">
          {`Déjà envoyé ${sends.length} fois`}
        </Banner>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <H3>Volontaire {a.assignmentMode === 'manual' ? '(choix manuel)' : 'recommandé'}</H3>
          {!done ? (
            <Button
              title={showRanking ? 'Fermer' : sent ? 'Renvoyer à un autre' : 'Changer'}
              variant="ghost"
              compact
              onPress={() => setShowRanking(!showRanking)}
            />
          ) : null}
        </View>
        {v ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs }}>
            <Avatar name={v.fullName} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Body style={{ fontWeight: '700' }}>Frère {v.fullName}</Body>
              <Small>{fmtPhone(v.whatsapp)}</Small>
            </View>
            <IconButton icon="copy-outline" label="Copier le numéro" tone="primary" onPress={() => copy(`+${v.whatsapp}`, 'Numéro copié')} />
          </View>
        ) : (
          <Banner tone="danger" title="Aucun volontaire disponible">
            Attribution manuelle nécessaire.
          </Banner>
        )}
        {a.recommendation?.explanation ? <Small>{a.recommendation.explanation}</Small> : null}
        {showRanking ? (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {ranking.isPending ? <Loading label="Calcul du classement…" /> : null}
            {(ranking.data?.ranking ?? []).map((r) => (
              <View
                key={r.volunteerId}
                style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, gap: 4, opacity: r.eligible ? 1 : 0.6 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Body style={{ fontWeight: '600', flex: 1 }}>{r.fullName}</Body>
                  <Badge label={r.eligible ? `${r.score} pts` : 'Indisponible'} tone={r.eligible ? 'primary' : 'neutral'} />
                </View>
                {r.reasons.map((x, i) => (
                  <Small key={i}>• {x}</Small>
                ))}
                {r.volunteerId !== v?._id ? (
                  <Button
                    title="Choisir"
                    compact
                    variant="secondary"
                    onPress={() => pickVolunteer(r.volunteerId, r.fullName)}
                    loading={assign.isPending && assign.variables?.volunteerId === r.volunteerId}
                    style={{ alignSelf: 'flex-start' }}
                  />
                ) : null}
              </View>
            ))}
            {a.assignmentMode === 'manual' && !sent ? (
              <Button
                title="Revenir à la recommandation automatique"
                variant="ghost"
                compact
                onPress={() => assign.mutate({ volunteerId: null, auto: true })}
                loading={assign.isPending && Boolean(assign.variables?.auto)}
              />
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card>
        <H3>Informations transmises</H3>
        <KeyValue label="Responsable" value={e.responsibleContactId?.fullName} />
        <KeyValue
          label="Téléphone"
          value={e.responsibleContactId?.phones?.[0] ? fmtPhone(e.responsibleContactId.phones[0]) : null}
          suffix={isWhatsapp(e.responsibleContactId, e.responsibleContactId?.phones?.[0]) ? <WaMark /> : null}
        />
        {e.responsibleContactId?.phones?.[1] ? (
          <KeyValue
            label="Autre numéro"
            value={fmtPhone(e.responsibleContactId.phones[1])}
            suffix={isWhatsapp(e.responsibleContactId, e.responsibleContactId.phones[1]) ? <WaMark /> : null}
          />
        ) : null}
        <KeyValue label="Tâches" value={e.tasks.map((t) => t.label).join(', ')} />
        {!e.responsibleContactId?.phones?.length ? (
          <Button
            title="Compléter la fiche du responsable"
            variant="secondary"
            compact
            onPress={() => (e.responsibleContactId ? router.push(`/contacts/${e.responsibleContactId._id}`) : router.push(`/events/${e._id}`))}
          />
        ) : null}
      </Card>

      {a.type === 'post' && a.questions.length ? (
        <Section title="Questions à poser">
          <Card>
            {a.questions.map((x, i) => (
              <Small key={i} style={{ color: colors.text }}>
                {i + 1}. {x.label}
              </Small>
            ))}
            <Small>Modifiables dans Paramètres › Questionnaires.</Small>
          </Card>
        </Section>
      ) : null}

      <Section title={`Message WhatsApp${a.message?.edited || dirty ? ' (modifié)' : ''}`}>
        {missing ? <Banner tone="warning" title="Informations à compléter"></Banner> : null}
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          editable={!locked}
          accessibilityLabel="Message WhatsApp à envoyer"
          style={{
            minHeight: 280,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderTopLeftRadius: radius.sm,
            borderCurve: 'continuous',
            padding: space.lg,
            fontSize: 15,
            lineHeight: 23,
            color: colors.text,
            textAlignVertical: 'top',
            ...shadow.card,
          }}
        />
        {dirty ? (
          <Button title="Enregistrer le message" variant="secondary" compact onPress={() => saveMessage.mutate()} loading={saveMessage.isPending} />
        ) : null}
      </Section>

      {!sent ? (
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Copier" icon="copy-outline" variant="secondary" onPress={() => copy(text, 'Message copié')} style={{ flex: 1 }} />
            <Button title="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={openWhatsApp} disabled={!v} style={{ flex: 1.4 }} />
          </View>
          <Button title="J’ai envoyé le message" icon="checkmark-done" onPress={confirmSent} loading={markSent.isPending} disabled={!v} />
          {a.whatsappOpenedAt ? <Small style={{ textAlign: 'center' }}>WhatsApp ouvert · envoi pas encore confirmé</Small> : null}
        </View>
      ) : null}

      {weekly && !done ? (
        <Card>
          <WeekDayPicker
            eventId={e._id}
            date={e.date}
            plannedDay={e.plannedDay}
            title={a.type === 'pre' ? 'Jour donné par le responsable' : 'Travaux reportés à un autre jour ?'}
          />
        </Card>
      ) : null}

      {!done ? (
        <Card style={{ gap: space.md }}>
          <H3>Terminer la mission</H3>
          <Field label="" value={note} onChangeText={setNote} multiline placeholder="Commentaire (facultatif)" accessibilityLabel="Commentaire" />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button
              title="Non faite"
              variant="secondary"
              onPress={() => finish('not_done')}
              loading={complete.isPending && complete.variables === 'not_done'}
              style={{ flex: 1 }}
            />
            <Button
              title="Faite"
              icon="checkmark-done"
              onPress={() => finish('done')}
              loading={complete.isPending && complete.variables === 'done'}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : null}

      <Section title="Rappels">
        <Card style={{ gap: space.sm }}>
          {done ? (
            <Small style={{ color: colors.text }}>Plus aucun rappel</Small>
          ) : (
            <Small style={{ color: colors.text }}>
              {overdue ? `En retard · rappel chaque jour à ${fmtTime(a.dueAt)}` : `Rappel le ${fmtDateTime(a.dueAt)}, puis chaque jour`}
            </Small>
          )}
          {upcoming.slice(0, 4).map((x) => {
            const here = onPhone?.has(x._id);
            return (
              <View key={x._id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Ionicons name={here ? 'notifications' : 'notifications-outline'} size={16} color={here ? colors.success : colors.textMuted} />
                <Small style={{ flex: 1, color: colors.text }}>
                  {fmtDateTime(x.dueAt)} · {x.kind === 'overdue_mission' ? 'rappel de retard' : 'échéance'}
                </Small>
                <Badge
                  label={
                    onPhone === null
                      ? 'Vérification…'
                      : here
                        ? 'Programmé sur ce téléphone'
                        : Platform.OS === 'web'
                          ? 'Enregistré (serveur)'
                          : 'Pas encore sur le téléphone'
                  }
                  tone={here ? 'success' : onPhone === null ? 'neutral' : Platform.OS === 'web' ? 'info' : 'warning'}
                />
              </View>
            );
          })}
          {upcoming.length > 4 ? <Small>+ {upcoming.length - 4} autre(s) rappel(s) prévu(s)</Small> : null}
          {past.length ? (
            <Small>
              Déjà rappelée {past.length} fois (dernier : {fmtDateTime(past[past.length - 1].dueAt)}).
            </Small>
          ) : null}
        </Card>
      </Section>

      {sends.length ? (
        <Section title={`Envois (${sends.length})`}>
          <Card style={{ gap: space.xs }}>
            {sends.map((s, i) => (
              <Small key={i} style={{ color: colors.text }}>
                {i + 1}. Frère {s.volunteerName || 'volontaire'} — {fmtDateTime(s.at)}
              </Small>
            ))}
          </Card>
        </Section>
      ) : null}

      {a.status === 'message_sent' ? (
        <Button title="Annuler la confirmation d’envoi" variant="ghost" onPress={() => unmark.mutate()} loading={unmark.isPending} />
      ) : null}
    </Screen>
  );
}
