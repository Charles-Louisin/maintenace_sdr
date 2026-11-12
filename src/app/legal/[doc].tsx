import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Card, H2, Screen, Small } from '../../components/ui';
import { getLegalDoc, LEGAL_LINKS, LEGAL_UPDATED_AT, type LegalDocId } from '../../lib/legal';
import { colors, space } from '../../theme/tokens';

/** Page juridique : confidentialité, conditions d'utilisation ou mentions légales. Accessible sans connexion. */
export default function LegalPage() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const id = (LEGAL_LINKS.some((l) => l.id === doc) ? doc : 'confidentialite') as LegalDocId;
  const page = getLegalDoc(id);
  return (
    <Screen>
      <Stack.Screen options={{ title: page.title }} />
      <View style={{ gap: space.sm }}>
        <Body style={{ color: colors.textMuted }}>{page.intro}</Body>
        <Small>Mise à jour le {LEGAL_UPDATED_AT}</Small>
      </View>
      {page.sections.map((s) => (
        <Card key={s.title} style={{ gap: space.sm }}>
          <H2>{s.title}</H2>
          {s.paragraphs.map((p, i) => (
            <Text key={i} selectable style={{ fontSize: 15, lineHeight: 23, color: colors.text }}>
              {p}
            </Text>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
