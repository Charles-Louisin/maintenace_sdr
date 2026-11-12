import { useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { toast } from '../../components/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post, errorMessage } from '../../lib/api';
import type { CallAssignment, RankedVolunteer } from '../../lib/types';
import { CALL_STATUS, fmtDate, fmtDateTime, fmtPhone, whatsappUrl } from '../../lib/format';
import { Avatar, Badge, Banner, Body, Button, Card, ErrorState, H2, H3, IconButton, KeyValue, Loading, Screen, Section, Small } from '../../components/ui';
import { colors, radius, shadow, space } from '../../theme/tokens';

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

  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const a = q.data!;
  const e = a.event!;
  const st = CALL_STATUS[a.status];
  const v = a.volunteerId;
  const sent = ['message_sent', 'response_received', 'completed'].includes(a.status);
  const missing = text.includes('[À COMPLÉTER]');

  const openWhatsApp = async () => {
    if (!v) return;
    if (dirty) await saveMessage.mutateAsync().catch(() => undefined);
    post(`/api/call-assignments/${id}/whatsapp-opened`).catch(() => undefined);
    try {
      await Linking.openURL(whatsappUrl(v.whatsapp, text));
    } catch {
      Alert.alert('WhatsApp introuvable', 'Copiez le message et collez-le dans WhatsApp.');
    }
  };

  const confirmSent = () =>
    Alert.alert(
      'Confirmer l’envoi',
      `Avez-vous bien envoyé ce message à ${v?.fullName} sur WhatsApp ? L’ouverture de WhatsApp ne prouve pas l’envoi.`,
      [
        { text: 'Pas encore', style: 'cancel' },
        { text: 'Oui, message envoyé', onPress: () => markSent.mutate() },
      ],
    );

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Badge label={a.type === 'pre' ? 'Appel préalable' : 'Appel de suivi'} tone={a.type === 'pre' ? 'primary' : 'info'} />
          <Badge label={st?.label ?? a.status} tone={st?.tone ?? 'neutral'} />
        </View>
        <H2>{e.venueId?.name}</H2>
        <Body style={{ color: colors.textMuted }}>
          {e.congregationName} · travaux {a.type === 'pre' ? 'prévus' : 'effectués'} le {fmtDate(e.date)}
        </Body>
        <Small>Échéance de la mission : {fmtDateTime(a.dueAt)}</Small>
      </View>

      {sent ? (
        <Banner tone="success" icon="checkmark-circle" title="Message envoyé" action={<Button title="Enregistrer la réponse reçue" compact onPress={() => router.push(`/responses/new?assignment=${a._id}`)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />}>
          {`Confirmé le ${fmtDateTime(a.sentConfirmedAt)}.`}
        </Banner>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <H3>Volontaire {a.assignmentMode === 'manual' ? '(choix manuel)' : 'recommandé'}</H3>
          {!sent ? <Button title={showRanking ? 'Fermer' : 'Changer'} variant="ghost" compact onPress={() => setShowRanking(!showRanking)} /> : null}
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
          <Banner tone="danger" title="Aucun volontaire disponible">Attribution manuelle nécessaire.</Banner>
        )}
        {a.recommendation?.explanation ? <Small>{a.recommendation.explanation}</Small> : null}
        {showRanking ? (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {ranking.isPending ? <Loading label="Calcul du classement…" /> : null}
            {(ranking.data?.ranking ?? []).map((r) => (
              <View key={r.volunteerId} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, gap: 4, opacity: r.eligible ? 1 : 0.6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Body style={{ fontWeight: '600', flex: 1 }}>{r.fullName}</Body>
                  <Badge label={r.eligible ? `${r.score} pts` : 'Indisponible'} tone={r.eligible ? 'primary' : 'neutral'} />
                </View>
                {r.reasons.map((x, i) => (
                  <Small key={i}>• {x}</Small>
                ))}
                {r.volunteerId !== v?._id ? (
                  <Button title="Choisir" compact variant="secondary" onPress={() => assign.mutate({ volunteerId: r.volunteerId })} loading={assign.isPending} style={{ alignSelf: 'flex-start' }} />
                ) : null}
              </View>
            ))}
            {a.assignmentMode === 'manual' ? <Button title="Revenir à la recommandation automatique" variant="ghost" compact onPress={() => assign.mutate({ volunteerId: null, auto: true })} /> : null}
          </View>
        ) : null}
      </Card>

      <Card>
        <H3>Informations transmises</H3>
        <KeyValue label="Responsable" value={e.responsibleContactId?.fullName} />
        <KeyValue label="Téléphone" value={e.responsibleContactId?.phones?.[0] ? fmtPhone(e.responsibleContactId.phones[0]) : null} />
        <KeyValue label="Tâches" value={e.tasks.map((t) => t.label).join(', ')} />
        {!e.responsibleContactId?.phones?.length ? (
          <Button title="Compléter la fiche du responsable" variant="secondary" compact onPress={() => (e.responsibleContactId ? router.push(`/contacts/${e.responsibleContactId._id}`) : router.push(`/events/${e._id}`))} />
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
        {missing ? <Banner tone="warning" title="Informations à compléter">Le message contient [À COMPLÉTER] : corrigez-le ou complétez les fiches avant l’envoi.</Banner> : null}
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          editable={!sent}
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
        {dirty ? <Button title="Enregistrer le message" variant="secondary" compact onPress={() => saveMessage.mutate()} loading={saveMessage.isPending} /> : null}
      </Section>

      {!sent ? (
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Copier" icon="copy-outline" variant="secondary" onPress={() => copy(text, 'Message copié')} style={{ flex: 1 }} />
            <Button title="WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={openWhatsApp} disabled={!v} style={{ flex: 1.4 }} />
          </View>
          <Button title="Message envoyé" icon="checkmark-done" onPress={confirmSent} loading={markSent.isPending} disabled={!v} />
          {a.whatsappOpenedAt ? <Small style={{ textAlign: 'center' }}>WhatsApp ouvert le {fmtDateTime(a.whatsappOpenedAt)} — envoi non confirmé</Small> : null}
        </View>
      ) : a.status === 'message_sent' ? (
        <Button title="Annuler la confirmation d’envoi" variant="ghost" onPress={() => unmark.mutate()} />
      ) : null}
    </Screen>
  );
}
