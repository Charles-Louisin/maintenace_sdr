import { useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post, errorMessage } from '../../lib/api';
import type { IncomingReport, Structured } from '../../lib/types';
import { ANSWER_STATUS, OUTCOME, fmtDate, fmtDateTime } from '../../lib/format';
import { Badge, Banner, Body, Button, Card, Chip, ErrorState, Field, H2, H3, Loading, Screen, Section, Segmented, Small } from '../../components/ui';
import { colors, radius, space } from '../../theme/tokens';
import { toast } from '../../components/toast';

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export default function ResponseReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['incoming-report', id], queryFn: () => get<IncomingReport>(`/api/incoming-reports/${id}`) });
  if (q.isPending) return <Loading />;
  if (!q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <ReviewForm key={`${q.data._id}-${q.data.aiModel}`} r={q.data} />;
}

function ReviewForm({ r }: { r: IncomingReport }) {
  const id = r._id;
  const qc = useQueryClient();
  const v = r.validated;
  const [data, setData] = useState<Structured | null>(v);
  const [issues, setIssues] = useState(v?.issues.join('\n') ?? '');
  const [solutions, setSolutions] = useState(v?.solutions.join('\n') ?? '');
  const [recos, setRecos] = useState(v?.recommendations.join('\n') ?? '');
  const [expenses, setExpenses] = useState(v?.expenses.map((e) => `${e.label} : ${e.amount ?? '?'}`).join('\n') ?? '');
  const [view, setView] = useState<'structured' | 'original'>('structured');

  const build = (): Structured => ({
    ...data!,
    issues: lines(issues),
    solutions: lines(solutions),
    recommendations: lines(recos),
    expenses: lines(expenses).map((l) => {
      const m = l.match(/^(.*?)(?:\s*:\s*([\d\s.,]+|\?))?\s*(?:f|fcfa|xaf)?$/i);
      const raw = m?.[2]?.replace(/[\s.]/g, '').replace(',', '.');
      const amount = raw && raw !== '?' && !isNaN(Number(raw)) ? Number(raw) : null;
      return { label: (m?.[1] ?? l).trim(), amount, currency: 'XAF' };
    }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['incoming-report', id] });
    qc.invalidateQueries({ queryKey: ['incoming-reports'] });
    qc.invalidateQueries({ queryKey: ['missions'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['work-events'] });
  };
  const save = useMutation({
    meta: { success: 'Brouillon enregistré' },
    mutationFn: () => patch(`/api/incoming-reports/${id}`, build()),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });
  const validate = useMutation({
    meta: { success: 'Réponse validée' },
    mutationFn: () => post(`/api/incoming-reports/${id}/validate`, build()),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (e) => Alert.alert('Validation impossible', errorMessage(e)),
  });

  const analyze = useMutation({
    mutationFn: () => post<{ cached: boolean }>(`/api/incoming-reports/${id}/analyze`, {}),
    onSuccess: (x) => {
      invalidate();
      toast.success(x.cached ? 'Analyse déjà disponible, réutilisée' : 'Réponses pré-remplies par l’IA');
    },
    onError: (e) => Alert.alert('Analyse impossible', errorMessage(e)),
  });

  const validated = r.status === 'validated';
  const setAnswer = (i: number, patch_: Partial<Structured['answers'][number]>) =>
    setData((d) => (d ? { ...d, answers: d.answers.map((a, k) => (k === i ? { ...a, ...patch_ } : a)) } : d));
  const setTask = (i: number, outcome: Structured['tasks'][number]['outcome']) =>
    setData((d) => (d ? { ...d, tasks: d.tasks.map((t, k) => (k === i ? { ...t, outcome } : t)) } : d));
  const missingCount = data?.answers.filter((a) => a.status !== 'answered').length ?? 0;

  return (
    <Screen
      footer={
        validated ? undefined : (
          <>
            <Button
              title="Valider le compte rendu"
              icon="checkmark-done"
              loading={validate.isPending}
              onPress={() =>
                missingCount
                  ? Alert.alert('Réponses incomplètes', `${missingCount} réponse(s) sans réponse ou à vérifier.`, [
                      { text: 'Revoir', style: 'cancel' },
                      { text: 'Valider quand même', onPress: () => validate.mutate() },
                    ])
                  : validate.mutate()
              }
            />
            <Button title="Enregistrer les corrections" variant="ghost" onPress={() => save.mutate()} loading={save.isPending} />
          </>
        )
      }
    >
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Badge label={r.type === 'pre' ? 'Avant travaux' : 'Après travaux'} tone="info" />
          <Badge label={validated ? 'Validé' : 'Brouillon'} tone={validated ? 'success' : 'warning'} />
        </View>
        <H2>{r.event ? `${r.event.venueName} · ${r.event.congregationName}` : 'Réponse'}</H2>
        {r.event ? <Small>Travaux du {fmtDate(r.event.date)}</Small> : null}
        <Small>
          Reçu le {fmtDateTime(r.createdAt)}
          {typeof r.volunteerId === 'object' && r.volunteerId ? ` · transmis par ${r.volunteerId.fullName}` : ''}
        </Small>
      </View>
      {r.aiError ? (
        <Banner tone="warning" title="Analyse automatique indisponible">
          {r.aiError}
        </Banner>
      ) : null}
      {!validated && r.aiModel ? <Banner tone="info" icon="sparkles-outline" title="Proposition de l’IA"></Banner> : null}
      {!validated && !r.aiModel ? (
        <Card>
          <H3>Remplir avec l’IA ?</H3>

          <Button
            title="Analyser avec l’IA"
            icon="sparkles-outline"
            variant="secondary"
            compact
            onPress={() => analyze.mutate()}
            loading={analyze.isPending}
            style={{ alignSelf: 'flex-start' }}
          />
        </Card>
      ) : null}

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'structured', label: 'B. Informations structurées' },
          { value: 'original', label: 'A. Message original' },
        ]}
      />

      {view === 'original' ? (
        <Card>
          <Body selectable>{r.originalText}</Body>
        </Card>
      ) : data ? (
        <>
          <Field label="Résumé" value={data.summary} onChangeText={(v) => setData({ ...data, summary: v })} multiline editable={!validated} />
          {r.type === 'pre' ? (
            <Card>
              <H3>Appel préalable</H3>
              <Small>Responsable joint</Small>
              <Segmented
                value={data.responsibleReached}
                onChange={(v) => !validated && setData({ ...data, responsibleReached: v })}
                options={[
                  { value: 'yes', label: 'Oui' },
                  { value: 'no', label: 'Non' },
                  { value: 'unknown', label: 'Inconnu' },
                ]}
              />
              <Small>Préparatifs</Small>
              <Segmented
                value={data.preparationsDone}
                onChange={(v) => !validated && setData({ ...data, preparationsDone: v })}
                options={[
                  { value: 'yes', label: 'Prêts' },
                  { value: 'partial', label: 'En partie' },
                  { value: 'no', label: 'Non' },
                  { value: 'unknown', label: 'Inconnu' },
                ]}
              />
            </Card>
          ) : null}

          <Section title={`Réponses aux questions (${data.answers.length})`}>
            {data.answers.map((a, i) => {
              const s = ANSWER_STATUS[a.status];
              return (
                <Card key={`${a.questionId}-${i}`}>
                  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                    <Body style={{ flex: 1, fontWeight: '600' }}>{a.label}</Body>
                    <Badge label={s.label} tone={s.tone} />
                  </View>
                  <Field
                    label="Réponse"
                    value={a.value}
                    editable={!validated}
                    onChangeText={(v) => setAnswer(i, { value: v, status: v.trim() ? (a.status === 'missing' ? 'answered' : a.status) : 'missing' })}
                    placeholder="Aucune réponse dans le message"
                    multiline={a.value.length > 60}
                  />
                  {a.evidence ? (
                    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: space.sm }}>
                      <Small style={{ fontStyle: 'italic' }}>« {a.evidence} »</Small>
                    </View>
                  ) : null}
                  {!validated ? (
                    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                      {(['answered', 'to_verify', 'missing'] as const).map((st) => (
                        <Chip
                          key={st}
                          label={ANSWER_STATUS[st].label}
                          active={a.status === st}
                          onPress={() => setAnswer(i, { status: st, ...(st === 'missing' ? { value: '' } : {}) })}
                        />
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </Section>

          {data.tasks.length ? (
            <Section title="Réalisation des tâches">
              {data.tasks.map((t, i) => (
                <Card key={t.label}>
                  <Body style={{ fontWeight: '600' }}>{t.label}</Body>
                  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                    {(['done', 'partial', 'not_done', 'unknown'] as const).map((o) => (
                      <Chip key={o} label={OUTCOME[o].label} active={t.outcome === o} onPress={() => !validated && setTask(i, o)} />
                    ))}
                  </View>
                  {t.note ? <Small>{t.note}</Small> : null}
                </Card>
              ))}
            </Section>
          ) : null}

          <Field label="Problèmes signalés (un par ligne)" value={issues} onChangeText={setIssues} multiline editable={!validated} />
          <Field label="Solutions apportées ou prévues (une par ligne)" value={solutions} onChangeText={setSolutions} multiline editable={!validated} />
          <Field label="Recommandations (une par ligne)" value={recos} onChangeText={setRecos} multiline editable={!validated} />
          <Field
            label="Dépenses (« libellé : montant », une par ligne)"
            value={expenses}
            onChangeText={setExpenses}
            multiline
            editable={!validated}
            hint="Montants en FCFA. « ? » si le montant n’a pas été communiqué."
          />
          {r.type === 'pre' ? (
            <Field
              label="Disponibilités évoquées"
              value={data.availability}
              onChangeText={(v) => setData({ ...data, availability: v })}
              editable={!validated}
            />
          ) : null}
          <Field label="Autres informations" value={data.otherInfo} onChangeText={(v) => setData({ ...data, otherInfo: v })} multiline editable={!validated} />
        </>
      ) : null}
    </Screen>
  );
}
