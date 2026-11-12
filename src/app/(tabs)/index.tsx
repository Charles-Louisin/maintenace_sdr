import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { usePushPermission } from '../../lib/notifications';
import type { Dashboard } from '../../lib/types';
import { fmtDate, relativeDays, MONTH_NAMES, todayIso } from '../../lib/format';
import { Avatar, Badge, Banner, Button, Card, Divider, ErrorState, HeroCard, Loading, Row, Screen, Section, Small, Stat, StatRow, Title } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

function monthOf(m: number) {
  const n = MONTH_NAMES[m - 1].toLowerCase();
  return /^[aeiou]/.test(n) ? `d’${n}` : `de ${n}`;
}

export default function Home() {
  const { owner } = useAuth();
  const push = usePushPermission(true);
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Dashboard>('/api/dashboard') });

  if (q.isPending) return <Loading rows={3} />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const c = d.counts;
  const prev = d.previousMonthReport;
  const next = d.upcoming[0];
  const firstName = owner?.displayName?.split(' ')[0] ?? '';

  const attention = [
    { n: c.preCallsToSend, label: 'appel(s) préalable(s) à transmettre', icon: 'paper-plane-outline' as const, href: '/missions' },
    { n: c.postCallsToOrganize, label: 'appel(s) de suivi à organiser', icon: 'call-outline' as const, href: '/missions' },
    { n: c.responsesToValidate, label: 'réponse(s) à valider', icon: 'chatbubble-ellipses-outline' as const, href: '/missions?tab=responses' },
    { n: c.documentsToReview, label: 'importation(s) à vérifier', icon: 'document-text-outline' as const, href: '/documents' },
    { n: c.unassignedMissions, label: 'mission(s) sans volontaire', icon: 'person-remove-outline' as const, href: '/missions' },
  ].filter((a) => a.n > 0);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Title>Bonjour{firstName ? `, ${firstName}` : ''}</Title>
          <Small>{fmtDate(todayIso())} · voici votre activité</Small>
        </View>
        <Avatar name={owner?.displayName ?? 'P'} tone="gold" size={48} />
      </View>

      {push.state === 'denied' || (push.state !== 'unsupported' && !d.notificationsEnabled) ? (
        <Banner tone="warning" icon="notifications-off-outline" title="Notifications désactivées" action={<Button title="Activer" compact variant="secondary" onPress={push.retry} style={{ alignSelf: 'flex-start', marginTop: 6 }} />}>
          Vous ne recevrez pas les rappels d’appels sur ce téléphone. Les échéances restent enregistrées sur le serveur.
        </Banner>
      ) : null}

      <StatRow>
        <Stat icon="calendar-outline" value={c.scheduledEvents} label="Travaux à venir" tone="primary" onPress={() => router.push('/planning')} />
        <Stat icon="business-outline" value={c.venues} label="Salles" tone="warning" onPress={() => router.push('/venues')} />
        <Stat icon="checkmark-done-outline" value={c.awaitingResponse} label="En attente de retour" tone="success" onPress={() => router.push('/missions')} />
      </StatRow>

      {next ? (
        <HeroCard onPress={() => router.push(`/events/${next._id}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.onPrimaryMuted, fontSize: 13, fontWeight: '600' }}>Prochaine intervention</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </View>
          <Text style={{ color: colors.onPrimary, fontSize: 28, fontWeight: '700', letterSpacing: -0.6, marginTop: space.sm }}>{relativeDays(next.date)}</Text>
          <Text style={{ color: colors.onPrimary, fontSize: 16, fontWeight: '600' }}>
            {next.venueId?.name} · {next.congregationName}
          </Text>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 14 }}>{fmtDate(next.date)}</Text>
          <Text style={{ color: colors.gold, fontSize: 13, marginTop: space.sm }} numberOfLines={2}>
            {next.tasks.map((t) => t.label).join(' · ')}
          </Text>
        </HeroCard>
      ) : null}

      <Section title="À votre attention">
        {attention.length ? (
          <Card style={{ paddingVertical: space.xs, paddingHorizontal: space.sm }}>
            {attention.map((a, i) => (
              <View key={a.label}>
                {i > 0 ? <Divider inset={56} /> : null}
                <Row icon={a.icon} title={`${a.n} ${a.label}`} onPress={() => router.push(a.href as never)} />
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <Row icon="checkmark-circle-outline" title="Tout est à jour" subtitle="Aucune action en attente." />
          </Card>
        )}
      </Section>

      <Card onPress={() => router.push(`/reports?year=${prev.year}&month=${prev.month}`)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 }}>
            Rapport {monthOf(prev.month)} {prev.year}
          </Text>
          <Badge label={prev.complete ? 'Complet' : 'Incomplet'} tone={prev.complete ? 'success' : 'warning'} />
        </View>
        <Small>
          {prev.complete
            ? 'Toutes les informations sont réunies.'
            : `${prev.withoutReport} intervention(s) sans compte rendu · ${prev.missingAnswers} réponse(s) à compléter`}
        </Small>
      </Card>

      {d.upcoming.length > 1 ? (
        <Section title="Ensuite" action={<Button title="Planning" variant="ghost" compact onPress={() => router.push('/planning')} />}>
          <Card style={{ paddingVertical: space.xs, paddingHorizontal: space.sm }}>
            {d.upcoming.slice(1).map((e, i) => (
              <View key={e._id}>
                {i > 0 ? <Divider inset={56} /> : null}
                <Row icon="calendar-clear-outline" title={`${e.venueId?.name} · ${e.congregationName}`} subtitle={`${fmtDate(e.date)} · ${relativeDays(e.date)}`} onPress={() => router.push(`/events/${e._id}`)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
