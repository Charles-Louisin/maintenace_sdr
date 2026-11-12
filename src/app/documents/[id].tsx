import { useMemo, useState } from 'react';
import { useFold } from '../../lib/useFold';
import { Linking, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post, errorMessage } from '../../lib/api';
import type { ImportBatch, Proposal } from '../../lib/types';
import { BATCH_STATUS, DOC_KIND, fmtDate, fmtPhone, plural } from '../../lib/format';
import { Badge, Banner, Body, Button, Card, Collapsible, Empty, ErrorState, H2, H3, Loading, Row, Screen, Section, Small } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

const MATCH: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  matched: { label: 'Contact connu', tone: 'success' },
  new: { label: 'Nouveau contact', tone: 'info' },
  ambiguous: { label: 'À confirmer', tone: 'warning' },
  missing: { label: 'Responsable absent', tone: 'danger' },
};

function ProposalCard({ p, batchId, exId, onChange, locked }: { p: Proposal; batchId: string; exId: string; onChange: () => void; locked: boolean }) {
  const decide = useMutation({
    meta: { success: 'Choix enregistré' },
    mutationFn: (decision: 'pending' | 'rejected') => patch(`/api/extractions/${exId}/proposals/${p._id}`, { decision }),
    onSuccess: onChange,
  });
  const accepted = p.decision === 'accepted';
  const rejected = p.decision === 'rejected';
  const m = MATCH[p.responsible.matchStatus];
  const src = p.sources[0];
  return (
    <Card style={rejected ? { opacity: 0.6 } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <H3 style={{ flex: 1 }} numberOfLines={2}>
          {p.venueName || 'Salle manquante'} · {p.congregationName || 'Assemblée manquante'}
        </H3>
        {accepted ? <Badge label="Validée" tone="success" /> : rejected ? <Badge label="Écartée" tone="neutral" /> : <Badge label="Brouillon" tone="warning" />}
      </View>
      <Body style={!p.date ? { color: colors.danger, fontWeight: '600' } : undefined}>{fmtDate(p.date)}</Body>
      {p.tasks.map((t) => (
        <Small key={t._id} style={{ color: colors.text }}>
          • {t.label}
          {t.catalogRef ? ` (${t.catalogRef})` : ''}
          {t.catalogEntryId || t.catalogProposalId ? ' ✓ fiche liée' : ''}
        </Small>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Small style={{ color: colors.text }}>
          {p.responsible.name || 'Responsable non indiqué'}
          {p.responsible.phone ? ` · ${fmtPhone(p.responsible.phone)}` : ''}
        </Small>
        <Badge label={m.label} tone={m.tone} />
      </View>
      {p.missing.length ? <Badge label={`Manquant : ${p.missing.join(', ')}`} tone="danger" icon="alert-circle" /> : null}
      {p.warnings.map((w, i) => (
        <Small key={i} style={{ color: colors.warning }}>
          ⚠ {w}
        </Small>
      ))}
      <Small>
        Source : {src?.documentName}
        {src?.page ? `, page ${src.page}` : ''}
        {src?.sheet ? `, feuille « ${src.sheet} » ligne ${src.row}` : ''} · confiance {Math.round(p.confidence * 100)} %
      </Small>
      {!accepted && !locked ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 4 }}>
          {!rejected ? (
            <Button
              title="Corriger"
              icon="create-outline"
              variant="secondary"
              compact
              onPress={() => router.push(`/documents/proposal?batch=${batchId}&ex=${exId}&pid=${p._id}`)}
            />
          ) : null}
          <Button
            title={rejected ? 'Rétablir' : 'Écarter'}
            variant="ghost"
            compact
            onPress={() => decide.mutate(rejected ? 'pending' : 'rejected')}
            loading={decide.isPending}
          />
        </View>
      ) : null}
    </Card>
  );
}

export default function BatchReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['batch', id],
    queryFn: () => get<ImportBatch>(`/api/documents/batches/${id}`),
    // Rafraîchi pendant l'analyse ET pendant la validation (toutes deux exécutées en arrière-plan)
    refetchInterval: (query) =>
      ['queued', 'processing'].includes(query.state.data?.status ?? '') || query.state.data?.extraction?.validation?.running ? 3000 : false,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['batch', id] });
    qc.invalidateQueries({ queryKey: ['batches'] });
  };
  // Le serveur valide en arrière-plan (202) ; la progression est suivie via l'importation
  const validate = useMutation({
    meta: { success: 'Validation lancée' },
    mutationFn: (ids?: string[]) =>
      post<{ started: boolean; total: number }>(`/api/extractions/${q.data!.extraction!._id}/validate`, ids ? { proposalIds: ids } : {}),
    onSuccess: refresh,
    onError: (e) => Alert.alert('Validation impossible', errorMessage(e)),
  });
  // Propositions regroupées par salle, repliables (vue d'ensemble sur de longs programmes)
  const proposalGroups = useMemo(() => {
    const m = new Map<string, Proposal[]>();
    for (const p of q.data?.extraction?.proposals ?? []) m.set(p.venueName || 'Salle à préciser', [...(m.get(p.venueName || 'Salle à préciser') ?? []), p]);
    return [...m.entries()].map(([venue, items]) => ({ venue, items }));
  }, [q.data]);
  const groupKeys = useMemo(() => proposalGroups.map((g) => g.venue), [proposalGroups]);
  const fold = useFold(groupKeys);
  const runningServer = Boolean(q.data?.extraction?.validation?.running);
  const [wasRunning, setWasRunning] = useState(false);
  if (runningServer !== wasRunning) {
    // Fin de validation détectée : planning et tableau de bord rafraîchis (ajustement d'état pendant le rendu, sans effet)
    setWasRunning(runningServer);
    if (!runningServer) {
      qc.invalidateQueries({ queryKey: ['work-events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
  }
  const reanalyze = useMutation({
    meta: { success: 'Nouvelle analyse lancée' },
    mutationFn: () => post(`/api/documents/batches/${id}/analyze`),
    onSuccess: refresh,
  });
  const useAsTemplate = useMutation({
    meta: { success: 'Modèle de rapport enregistré' },
    mutationFn: (docId: string) => post<{ _id: string }>(`/api/report-templates/from-document/${docId}`),
    onSuccess: () => router.push('/settings/report-template'),
    onError: (e) => Alert.alert('Modèle refusé', errorMessage(e)),
  });
  const catalogDecide = useMutation({
    meta: { success: 'Choix enregistré' },
    mutationFn: ({ cid, decision }: { cid: string; decision: 'pending' | 'rejected' }) =>
      patch(`/api/extractions/${q.data!.extraction!._id}/catalog/${cid}`, { decision }),
    onSuccess: refresh,
  });

  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const b = q.data!;
  const ex = b.extraction;
  const st = BATCH_STATUS[b.status];
  const pending = ex?.proposals.filter((p) => p.decision === 'pending') ?? [];
  const blocking = pending.filter((p) => !p.date || !p.tasks.length || p.responsible.matchStatus === 'ambiguous');
  const v = ex?.validation;
  const running = Boolean(v?.running) || validate.isPending;
  const results = !running && v?.finishedAt ? (v.results ?? []) : null;
  const ok = results?.filter((x) => x.ok).length ?? 0;
  const ko = results?.filter((x) => !x.ok) ?? [];

  const openDoc = async (docId: string) => {
    try {
      const r = await get<{ url: string }>(`/api/documents/${docId}/download-url`);
      await Linking.openURL(r.url);
    } catch (e) {
      Alert.alert('Document indisponible', errorMessage(e));
    }
  };

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={
        ex && ex.status !== 'validated' && pending.length && !running ? (
          <>
            {blocking.length ? (
              <Small style={{ color: colors.warning }}>
                {blocking.length} intervention(s) à corriger avant validation (date, tâches ou responsable à confirmer).
              </Small>
            ) : null}
            <Button
              title={`Valider ${pending.length - blocking.length} intervention(s)`}
              icon="checkmark-done"
              onPress={() => validate.mutate(pending.filter((p) => !blocking.includes(p)).map((p) => p._id))}
              loading={validate.isPending}
              disabled={pending.length === blocking.length}
            />
          </>
        ) : undefined
      }
    >
      <View style={{ gap: space.xs }}>
        <Badge label={st?.label ?? b.status} tone={st?.tone ?? 'neutral'} />
        <H2>Importation</H2>
      </View>
      {['queued', 'processing'].includes(b.status) ? (
        <Card>
          <H3>Analyse en cours… {b.progress?.percent ?? 0} %</H3>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
            <View style={{ width: `${b.progress?.percent ?? 0}%`, height: 6, backgroundColor: colors.primary }} />
          </View>
          <Small>{b.progress?.step || 'En attente du serveur'}</Small>
        </Card>
      ) : null}
      {b.status === 'failed' ? (
        <Banner
          tone="danger"
          title="Analyse échouée"
          action={
            <Button
              title="Relancer l’analyse"
              compact
              variant="secondary"
              onPress={() => reanalyze.mutate()}
              loading={reanalyze.isPending}
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
            />
          }
        >
          {b.error}
        </Banner>
      ) : null}
      {running ? (
        <Card>
          <H3>
            Validation en cours… {v?.done ?? 0} / {v?.total ?? '…'}
          </H3>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
            <View style={{ width: `${v?.total ? Math.round(((v.done ?? 0) / v.total) * 100) : 0}%`, height: 6, backgroundColor: colors.primary }} />
          </View>
          <Small>Vous pouvez quitter cet écran.</Small>
        </Card>
      ) : null}
      {v?.error ? (
        <Banner tone="danger" title="Validation interrompue">
          {v.error}
        </Banner>
      ) : null}
      {results ? (
        <Banner tone={ko.length ? 'warning' : 'success'} icon="checkmark-circle" title="Validation effectuée">
          {`${ok} intervention(s) ajoutée(s) ou mise(s) à jour au planning.${ko.length ? `\n${ko.length} à corriger :\n- ${ko.map((x) => x.error).join('\n- ')}` : ''}`}
        </Banner>
      ) : null}

      <Section title="Documents">
        <Card style={{ paddingVertical: space.xs }}>
          {b.documentIds.map((d) => {
            const info = ex?.documents.find((x) => String(x.documentId) === d._id);
            return (
              <View key={d._id}>
                <Row
                  icon="document-outline"
                  title={d.originalName}
                  subtitle={`${DOC_KIND[d.kind] ?? d.kind}${info ? ` · ${info.summary}` : ''}${d.error ? ` · ${d.error}` : ''}`}
                  onPress={() => openDoc(d._id)}
                />
                {d.kind === 'report_template' ? (
                  <Button
                    title="Utiliser comme modèle de rapport"
                    compact
                    variant="secondary"
                    onPress={() => useAsTemplate.mutate(d._id)}
                    loading={useAsTemplate.isPending && useAsTemplate.variables === d._id}
                  />
                ) : null}
              </View>
            );
          })}
        </Card>
      </Section>
      {ex?.warnings.length ? (
        <Banner tone="warning" title="Avertissements">
          {ex.warnings.join('\n')}
        </Banner>
      ) : null}

      {ex?.catalogProposals.length ? (
        <Section title={`Fiches des tâches (${ex.catalogProposals.length})`}>
          {ex.catalogProposals.map((c) => (
            <Card key={c._id} style={c.decision === 'rejected' ? { opacity: 0.6 } : undefined}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <H3 style={{ flex: 1 }}>{c.title}</H3>
                <Badge label={c.pages.length ? `p. ${c.pages.join(', ')}` : 'sans page'} tone="neutral" />
              </View>
              <Small>{[c.category, c.frequency].filter(Boolean).join(' · ')}</Small>
              {c.materials.length ? <Small>Matériel : {c.materials.join(', ')}</Small> : null}
              <Small>
                {c.steps.length} étape(s){c.existingEntryId ? ' · mettra à jour la fiche existante' : ''}
              </Small>
              {running ? null : c.decision !== 'accepted' ? (
                <Button
                  title={c.decision === 'rejected' ? 'Rétablir' : 'Écarter'}
                  variant="ghost"
                  compact
                  onPress={() => catalogDecide.mutate({ cid: c._id, decision: c.decision === 'rejected' ? 'pending' : 'rejected' })}
                  loading={catalogDecide.isPending && catalogDecide.variables?.cid === c._id}
                  style={{ alignSelf: 'flex-start' }}
                />
              ) : (
                <Badge label="Enregistrée" tone="success" />
              )}
            </Card>
          ))}
        </Section>
      ) : null}

      {ex ? (
        <Section title={`Interventions extraites (${ex.proposals.length})`}>
          {ex.proposals.length === 0 ? <Empty icon="search-outline" title="Aucune intervention détectée" /> : null}
          {proposalGroups.map((g) => (
            <Collapsible
              key={g.venue}
              title={g.venue}
              subtitle={`${plural(g.items.length, 'intervention')} · ${g.items.filter((p) => p.decision === 'pending').length} à valider`}
              tone={g.items.some((p) => p.missing.length || p.responsible.matchStatus === 'ambiguous') ? 'warning' : 'primary'}
              open={fold.isOpen(g.venue)}
              onToggle={() => fold.toggle(g.venue)}
            >
              {g.items.map((p) => (
                <ProposalCard key={p._id} p={p} batchId={id} exId={ex._id} onChange={refresh} locked={running} />
              ))}
            </Collapsible>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
