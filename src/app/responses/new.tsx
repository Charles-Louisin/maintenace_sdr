import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, get, errorMessage } from '../../lib/api';
import type { CallAssignment, IncomingReport, WorkEvent } from '../../lib/types';
import { fmtDate } from '../../lib/format';
import { listDrafts, newDraftId, removeDraft, saveDraft } from '../../lib/drafts';
import { Banner, Body, Button, Card, Chip, H3, Loading, Screen, Section, Segmented, Small } from '../../components/ui';
import { colors, radius, space } from '../../theme/tokens';

interface Candidate {
  id: string;
  date: string;
  venueName: string;
  congregationName: string;
}

export default function NewResponse() {
  const params = useLocalSearchParams<{ assignment?: string; draft?: string }>();
  const qc = useQueryClient();
  const [chosenType, setType] = useState<'post' | 'pre' | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(params.assignment ?? null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const draftId = useRef(params.draft ?? newDraftId());

  const missions = useQuery({ queryKey: ['missions', 'awaiting_response'], queryFn: () => get<CallAssignment[]>('/api/call-assignments?scope=awaiting_response') });
  const preset = useQuery({
    queryKey: ['mission', assignmentId],
    queryFn: () => get<CallAssignment>(`/api/call-assignments/${assignmentId}`),
    enabled: Boolean(assignmentId),
  });

  // Le type suit la mission sélectionnée, sauf choix explicite
  const type: 'post' | 'pre' = chosenType ?? preset.data?.type ?? 'post';
  useEffect(() => {
    if (!params.draft) return;
    listDrafts().then((all) => {
      const d = all.find((x) => x.clientDraftId === params.draft);
      if (d) {
        setText(d.text);
        setType(d.type);
        if (d.callAssignmentId) setAssignmentId(d.callAssignmentId);
      }
    });
  }, [params.draft]);

  const label = preset.data?.event ? `${preset.data.event.venueId?.name} · ${preset.data.event.congregationName}` : '';
  const keepDraft = async () => {
    await saveDraft({ clientDraftId: draftId.current, callAssignmentId: assignmentId ?? undefined, type, text, label, updatedAt: new Date().toISOString() });
  };

  const analyze = async (forcedAssignment?: string) => {
    if (text.trim().length < 2) return Alert.alert('Message vide', 'Collez le message reçu sur WhatsApp.');
    setBusy(true);
    setInfo(null);
    await keepDraft();
    try {
      const r = await api<{ report: IncomingReport; aiUsed?: boolean }>('/api/incoming-reports/parse', {
        method: 'POST',
        body: { callAssignmentId: forcedAssignment ?? assignmentId ?? undefined, type, text, clientDraftId: draftId.current },
      });
      await removeDraft(draftId.current);
      qc.invalidateQueries({ queryKey: ['incoming-reports'] });
      router.replace(`/responses/${r.report._id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EVENT_AMBIGUOUS') {
        setCandidates((e.payload?.candidates as Candidate[]) ?? []);
      } else if (e instanceof ApiError && e.isNetwork) {
        setInfo('Hors connexion : le message est conservé sur le téléphone et sera envoyé au retour de la connexion.');
      } else {
        Alert.alert('Analyse impossible', errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const pickCandidate = async (c: Candidate) => {
    const ev = await get<WorkEvent>(`/api/work-events/${c.id}`);
    const call = ev.calls.find((x) => x.type === type);
    if (!call) return Alert.alert('Mission introuvable', 'Aucune mission de ce type pour cette intervention.');
    setAssignmentId(call._id);
    setCandidates(null);
    await analyze(call._id);
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Enregistrer la réponse" icon="checkmark" onPress={() => analyze()} loading={busy} />
          <Button title="Garder en brouillon" variant="ghost" onPress={async () => { await keepDraft(); router.back(); }} />
        </>
      }
    >
      {info ? <Banner tone="info" icon="cloud-offline-outline" title="Brouillon enregistré">{info}</Banner> : null}

      <Section title="Type de réponse">
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            if (preset.data && preset.data.type !== v) setAssignmentId(null);
          }}
          options={[
            { value: 'pre', label: 'Avant travaux' },
            { value: 'post', label: 'Après travaux' },
          ]}
        />
      </Section>

      <Section title="Intervention et mission concernées">
        {assignmentId && preset.data ? (
          <Card>
            <H3>{label}</H3>
            <Small>
              {preset.data.type === 'pre' ? 'Appel préalable' : 'Appel de suivi'} · {fmtDate(preset.data.event!.date)} · {preset.data.volunteerId?.fullName ?? '—'}
            </Small>
            <Button title="Changer" variant="ghost" compact onPress={() => setAssignmentId(null)} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ) : missions.isPending ? (
          <Loading />
        ) : (
          <View style={{ gap: space.sm }}>
            {(missions.data ?? [])
              .filter((m) => m.type === type)
              .map((m) => {
                const e = m.workEventId as WorkEvent;
                return (
                  <Chip key={m._id} label={`${e.venueId?.name} · ${e.congregationName} · ${fmtDate(e.date, { weekday: false })} (${m.volunteerId?.fullName ?? '—'})`} onPress={() => setAssignmentId(m._id)} />
                );
              })}
            <Small>
              Sans sélection, l’intervention est reconnue d’après le nom de la salle ou de l’assemblée cité dans le message ; en cas de doute, vous la choisirez.
            </Small>
          </View>
        )}
      </Section>

      {candidates ? (
        <Section title="Quelle intervention ?">
          {candidates.map((c) => (
            <Card key={c.id} onPress={() => pickCandidate(c)}>
              <H3>{c.venueName} · {c.congregationName}</H3>
              <Small>{fmtDate(c.date)}</Small>
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Message reçu sur WhatsApp" action={<Button title="Coller" icon="clipboard-outline" variant="ghost" compact onPress={async () => setText(await Clipboard.getStringAsync())} />}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={() => text.trim() && keepDraft()}
          multiline
          placeholder="Collez ici le texte reçu du volontaire…"
          placeholderTextColor={colors.textFaint}
          style={{ minHeight: 240, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, fontSize: 15, lineHeight: 21, color: colors.text, textAlignVertical: 'top' }}
        />
        <Body style={{ color: colors.textMuted, fontSize: 13 }}>Le message original est conservé tel quel ; il devient un brouillon que vous compléterez (vous-même ou avec l’IA) puis validerez.</Body>
      </Section>
    </Screen>
  );
}
