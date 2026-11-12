import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, get, post, errorMessage } from '../../lib/api';
import { Alert } from '../../lib/dialog';
import { shareReport } from '../../lib/share-report';
import type { MonthPreview, MonthlyReport } from '../../lib/types';
import { MONTH_NAMES, fmtDate, fmtDateTime, fmtShort, plural } from '../../lib/format';
import { useFold } from '../../lib/useFold';
import { toast } from '../../components/toast';
import {
  Badge,
  Banner,
  Button,
  Card,
  Collapsible,
  Divider,
  ErrorState,
  IconButton,
  Loading,
  Row,
  Screen,
  Section,
  Small,
  Stat,
  StatRow,
} from '../../components/ui';
import { colors, radius, space } from '../../theme/tokens';

const SECTIONS = ['included', 'missing', 'answers'];

export default function Reports() {
  const params = useLocalSearchParams<{ year?: string; month?: string }>();
  const now = new Date();
  const [year, setYear] = useState(Number(params.year) || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()));
  const [month, setMonth] = useState(Number(params.month) || (now.getMonth() === 0 ? 12 : now.getMonth()));
  const qc = useQueryClient();
  const fold = useFold(SECTIONS, ['included']);

  const preview = useQuery({
    queryKey: ['report-preview', year, month],
    queryFn: () => get<MonthPreview>(`/api/reports/monthly/preview?year=${year}&month=${month}`),
  });
  const history = useQuery({ queryKey: ['reports'], queryFn: () => get<MonthlyReport[]>('/api/reports/monthly') });

  const generate = useMutation({
    mutationFn: (ack: boolean) => post<{ report: MonthlyReport }>('/api/reports/monthly/generate', { year, month, acknowledgeIncomplete: ack }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      const p = new URLSearchParams({
        id: r.report._id,
        file: r.report.fileName,
        rows: String(r.report.rowsWritten),
        notes: r.report.preservationNotes.join('\n'),
      });
      router.push(`/reports/success?${p}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'INCOMPLETE_DATA') {
        Alert.alert('Données incomplètes', 'Les informations absentes resteront « Non renseigné ».', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Générer avec avertissement', style: 'destructive', onPress: () => generate.mutate(true) },
        ]);
      } else Alert.alert('Génération impossible', errorMessage(e));
    },
  });

  const shift = (d: number) => {
    let m = month + d;
    let y = year;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    setMonth(m);
    setYear(y);
  };
  const p = preview.data;
  const rate = p && p.totalEvents ? Math.round((p.included.length / p.totalEvents) * 100) : 0;

  return (
    <Screen
      refreshing={preview.isRefetching}
      onRefresh={() => {
        preview.refetch();
        history.refetch();
      }}
    >
      <View style={styles.monthBar}>
        <IconButton icon="chevron-back" label="Mois précédent" onPress={() => shift(-1)} size={40} />
        <Text style={styles.month}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <IconButton icon="chevron-forward" label="Mois suivant" onPress={() => shift(1)} size={40} />
      </View>

      {preview.isPending ? (
        <Loading rows={2} />
      ) : preview.isError && !p ? (
        <ErrorState message={errorMessage(preview.error)} onRetry={() => preview.refetch()} />
      ) : p ? (
        <>
          {!p.template ? (
            <Banner
              tone="danger"
              title="Aucun modèle de rapport"
              action={
                <Button
                  title="Importer le modèle"
                  compact
                  variant="secondary"
                  onPress={() => router.push('/settings/report-template')}
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                />
              }
            ></Banner>
          ) : null}

          <StatRow>
            <Stat icon="calendar-outline" value={p.totalEvents} label="Interventions" tone="primary" />
            <Stat icon="business-outline" value={p.venues.length} label="Salles" tone="warning" />
            <Stat icon="pie-chart-outline" value={`${rate} %`} label="Taux de suivi" tone="success" />
          </StatRow>

          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardTitle}>Synthèse</Text>
              <Badge label={p.complete ? 'Complet' : 'Incomplet'} tone={p.complete ? 'success' : 'warning'} />
            </View>
            <Small>
              {plural(p.included.length, 'compte rendu reçu', 'comptes rendus reçus')} après travaux ·{' '}
              {plural(p.questionnairesCompleted, 'questionnaire complet', 'questionnaires complets')} · {p.preCallsWithoutResponse} appel(s) préalable(s) sans
              retour
            </Small>
          </Card>

          {p.inconsistencies.length ? (
            <Banner tone="warning" title="Incohérences détectées">
              {p.inconsistencies.join('\n')}
            </Banner>
          ) : null}

          <Collapsible
            title="Rubriques du rapport"
            subtitle={`${plural(p.included.length, 'rubrique')} · une par date et par assemblée`}
            tone="success"
            open={fold.isOpen('included')}
            onToggle={() => fold.toggle('included')}
          >
            {p.included.length === 0 ? (
              <Small style={{ padding: space.sm }}>Comptes rendus validés uniquement</Small>
            ) : (
              // Même ordre que le fichier Word : une salle avec toutes ses dates et assemblées, puis la suivante
              p.venues.map((venue) => (
                <View key={venue} style={{ gap: 2 }}>
                  <Text style={styles.venue}>{venue}</Text>
                  {p.included
                    .filter((i) => i.venueName === venue)
                    .map((i) => (
                      <Row
                        key={i.eventId}
                        icon="checkmark-circle-outline"
                        title={`${fmtShort(i.date)} · ${i.congregationName}`}
                        subtitle={i.tasks.join(', ')}
                        onPress={() => router.push(`/events/${i.eventId}`)}
                      />
                    ))}
                </View>
              ))
            )}
          </Collapsible>

          {p.withoutReport.length ? (
            <Collapsible
              title="Bilans non reçus"
              subtitle={plural(p.withoutReport.length, 'intervention')}
              tone="warning"
              open={fold.isOpen('missing')}
              onToggle={() => fold.toggle('missing')}
            >
              {p.withoutReport.map((i) => (
                <Row
                  key={i.eventId}
                  icon={i.past ? 'alert-circle-outline' : 'time-outline'}
                  danger={i.past}
                  title={`${i.venueName} · ${i.congregationName}`}
                  subtitle={`${fmtDate(i.date)}${i.past ? '' : ' (à venir)'}`}
                  onPress={() => router.push(`/events/${i.eventId}`)}
                />
              ))}
            </Collapsible>
          ) : null}

          {p.missingAnswers.length ? (
            <Collapsible
              title="Réponses à compléter"
              subtitle={`${plural(p.missingAnswers.length, 'réponse')} manquante(s) ou à vérifier`}
              tone="danger"
              open={fold.isOpen('answers')}
              onToggle={() => fold.toggle('answers')}
            >
              {p.missingAnswers.slice(0, 40).map((a, i) => (
                <View key={i} style={styles.answer}>
                  <Small style={{ color: colors.text, fontWeight: '600' }}>
                    {a.congregationName} · {fmtShort(a.date)}
                  </Small>
                  <Small>{a.question}</Small>
                  <Badge label={a.status === 'missing' ? 'Sans réponse' : 'À vérifier'} tone={a.status === 'missing' ? 'danger' : 'warning'} />
                </View>
              ))}
            </Collapsible>
          ) : null}

          <Button
            title="Générer le rapport Word"
            icon="document-attach-outline"
            onPress={() => generate.mutate(false)}
            loading={generate.isPending}
            disabled={!p.template || p.included.length === 0}
          />
        </>
      ) : null}

      <Section title="Historique des rapports">
        {(history.data ?? []).length === 0 ? (
          <Small>Aucun rapport généré pour l’instant.</Small>
        ) : (
          <Card style={{ paddingVertical: space.xs, paddingHorizontal: space.sm }}>
            {history.data!.map((r, i) => (
              <View key={r._id}>
                {i > 0 ? <Divider inset={56} /> : null}
                <Row
                  icon="document-text-outline"
                  title={r.fileName}
                  subtitle={`${fmtDateTime(r.createdAt)} · ${plural(r.rowsWritten, 'ligne')}${r.acknowledgedIncomplete ? ' · données incomplètes' : ''}`}
                  onPress={() =>
                    shareReport(r._id, r.fileName)
                      .then(() => toast.info('Téléchargement lancé'))
                      .catch((e) => Alert.alert('Erreur', errorMessage(e)))
                  }
                />
              </View>
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 6,
  },
  month: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  venue: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.gold,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
  },
  answer: { backgroundColor: colors.bg, borderRadius: radius.md, borderCurve: 'continuous', padding: space.md, gap: 4 },
});
