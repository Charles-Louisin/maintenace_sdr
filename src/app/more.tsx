import { router } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../lib/auth';
import { LEGAL_LINKS } from '../lib/legal';
import { Card, Divider, Row, Screen, Section, Small } from '../components/ui';
import { space } from '../theme/tokens';

export default function More() {
  const { owner, signOut } = useAuth();
  const groups: { title: string; rows: { icon: Parameters<typeof Row>[0]['icon']; title: string; subtitle: string; href: string }[] }[] = [
    {
      title: 'Registres',
      rows: [
        { icon: 'people-outline', title: 'Volontaires', subtitle: 'Disponibilités, missions, répartition', href: '/volunteers' },
        { icon: 'person-circle-outline', title: 'Frères responsables', subtitle: 'Coordonnées et historique', href: '/contacts' },
        { icon: 'business-outline', title: 'Salles du Royaume', subtitle: 'Assemblées et interventions', href: '/venues' },
      ],
    },
    {
      title: 'Suivi',
      rows: [{ icon: 'notifications-outline', title: 'Notifications', subtitle: 'Rappels reçus et programmés', href: '/notifications' }],
    },
    {
      title: 'Paramètres',
      rows: [
        { icon: 'time-outline', title: 'Rappels et fuseau horaire', subtitle: 'Heures des notifications', href: '/settings' },
        { icon: 'chatbox-ellipses-outline', title: 'Modèles de messages', subtitle: 'Textes WhatsApp', href: '/settings/messages' },
        { icon: 'list-outline', title: 'Questionnaires', subtitle: 'Questions avant et après travaux', href: '/settings/questionnaires' },
        { icon: 'document-attach-outline', title: 'Modèle de rapport', subtitle: 'Fichier Word et correspondances', href: '/settings/report-template' },
        { icon: 'shield-checkmark-outline', title: 'Sécurité et sauvegardes', subtitle: 'Mot de passe, journal', href: '/settings/security' },
      ],
    },
    {
      title: 'Informations légales',
      rows: LEGAL_LINKS.map((l) => ({
        icon: l.id === 'confidentialite' ? 'lock-closed-outline' : l.id === 'conditions' ? 'reader-outline' : 'information-circle-outline',
        title: l.title,
        subtitle: l.subtitle,
        href: `/legal/${l.id}`,
      })),
    },
  ];
  return (
    <Screen>
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          <Card style={{ paddingVertical: space.xs }}>
            {g.rows.map((r, i) => (
              <View key={r.href}>
                {i > 0 ? <Divider /> : null}
                <Row icon={r.icon} title={r.title} subtitle={r.subtitle} onPress={() => router.push(r.href as never)} />
              </View>
            ))}
          </Card>
        </Section>
      ))}
      <Card style={{ paddingVertical: space.xs }}>
        <Row icon="log-out-outline" title="Se déconnecter" subtitle={owner?.email} danger onPress={signOut} />
      </Card>
      <Small style={{ textAlign: 'center' }}>BATIS · usage personnel</Small>
    </Screen>
  );
}
