import { Tabs } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../components/ui';
import { colors } from '../../theme/tokens';

function icon(name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) {
  return function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? active : name} size={23} color={color as string} />;
  };
}

function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingRight: 12 }}>
      <IconButton icon="notifications-outline" label="Notifications" size={40} onPress={() => router.push('/notifications')} />
      <IconButton icon="grid-outline" label="Registres et paramètres" size={40} onPress={() => router.push('/more')} />
    </View>
  );
}

/**
 * Onglets : pairs entre eux, donc jamais de glissement — fondu bref uniquement.
 * Les écrans d'onglet sont chargés à la demande (lazy) : seul l'écran ouvert est monté.
 */
export default function TabsLayout() {
  // Barre d’onglets au-dessus de la barre de navigation du téléphone (gestes ou boutons)
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        lazy: true,
        animation: 'fade',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Icône + libellé entiers, avec une marge confortable au-dessus de la barre de navigation du téléphone
          height: 92 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 14, marginTop: 4 },
        tabBarItemStyle: { justifyContent: 'center' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 22, letterSpacing: -0.4 },
        headerTitleAlign: 'left',
        headerRight: () => <HeaderActions />,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="planning" options={{ title: 'Planning', tabBarIcon: icon('calendar-outline', 'calendar') }} />
      <Tabs.Screen name="missions" options={{ title: 'Missions', tabBarIcon: icon('call-outline', 'call') }} />
      <Tabs.Screen name="documents" options={{ title: 'Documents', tabBarIcon: icon('document-text-outline', 'document-text') }} />
      <Tabs.Screen name="reports" options={{ title: 'Rapports', tabBarIcon: icon('stats-chart-outline', 'stats-chart') }} />
    </Tabs>
  );
}
