import { useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AuthProvider, useAuth } from '../lib/auth';
import { queryClient, persister } from '../lib/query';
import { useNotificationNavigation } from '../lib/notifications';
import { syncDrafts } from '../lib/drafts';
import { BrandLoader } from '../components/brand';
import { AuthScreen } from '../components/AuthScreen';
import { NotificationGate, useNotificationGate } from '../components/NotificationGate';
import { ToastHost } from '../components/toast';
import { colors, motion } from '../theme/tokens';

/**
 * Un écran ouvert directement (notification, lien, rechargement) garde les onglets en dessous :
 * le bouton « Retour » ramène toujours à l'application au lieu de laisser une impasse.
 */
export const unstable_settings = { initialRouteName: '(tabs)' };

/** Durée minimale du chargeur : évite un flash de 100 ms, sans retarder un démarrage déjà lent. */
const MIN_LOADER_MS = 900;

function OfflineBar() {
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        const off = s.isConnected === false;
        setOffline(off);
        if (!off) {
          syncDrafts().then((n) => {
            if (n) queryClient.invalidateQueries({ queryKey: ['incoming-reports'] });
          });
        }
      }),
    [],
  );
  if (!offline) return null;
  return (
    <View
      style={{
        backgroundColor: colors.warningSoft,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          color: colors.warning,
          fontSize: 12,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        Hors connexion — données enregistrées affichées, brouillons conservés sur le téléphone
      </Text>
    </View>
  );
}

/** En-têtes de la couleur du fond : la page se prolonge jusqu'en haut, sans bandeau. */
const header = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.primary,
  headerTitleStyle: {
    color: colors.text,
    fontWeight: '700' as const,
    fontSize: 17,
  },
  headerShadowVisible: false,
  headerBackTitle: 'Retour',
  contentStyle: { backgroundColor: colors.bg },
};

function Gate() {
  const notif = useNotificationGate();
  const { status } = useAuth();
  const segments = useSegments();
  const [minElapsed, setMinElapsed] = useState(false);
  useNotificationNavigation(status === 'signedIn');

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status === 'loading' || status === 'locked') return;
    const inAuth = segments[0] === 'login' || segments[0] === 'forgot-password';
    const isPublic = inAuth || segments[0] === 'legal';
    if (status === 'signedOut' && !isPublic) router.replace('/login');
    if (status === 'signedIn' && inAuth) router.replace('/');
  }, [status, segments]);

  if (status === 'loading' || !minElapsed || notif.passed === null) return <BrandLoader />;
  if (!notif.passed && notif.perm) return <NotificationGate perm={notif.perm} asking={notif.asking} check={notif.check} />;
  if (status === 'locked') {
    return (
      <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)}>
        <AuthScreen biometric />
      </Animated.View>
    );
  }
  return (
    <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(motion.slow)}>
      <StatusBar style="dark" />
      <OfflineBar />
      <Stack screenOptions={{ ...header, animation: 'ios_from_right' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Mot de passe oublié' }} />
        <Stack.Screen name="events/[id]" options={{ title: 'Intervention' }} />
        <Stack.Screen name="missions/[id]" options={{ title: 'Message à envoyer' }} />
        <Stack.Screen name="documents/[id]" options={{ title: 'Vérification des données' }} />
        <Stack.Screen name="documents/proposal" options={{ title: 'Corriger', animation: 'slide_from_bottom' }} />
        <Stack.Screen
          name="responses/new"
          options={{
            title: 'Enregistrer une réponse',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="responses/[id]" options={{ title: 'Validation de la réponse' }} />
        <Stack.Screen name="reports/success" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="more" options={{ title: 'Registres et paramètres' }} />
        <Stack.Screen name="volunteers/index" options={{ title: 'Volontaires' }} />
        <Stack.Screen name="volunteers/[id]" options={{ title: 'Volontaire' }} />
        <Stack.Screen name="contacts/index" options={{ title: 'Responsables' }} />
        <Stack.Screen name="contacts/[id]" options={{ title: 'Responsable' }} />
        <Stack.Screen name="venues/index" options={{ title: 'Salles du Royaume' }} />
        <Stack.Screen name="venues/[id]" options={{ title: 'Salle du Royaume' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Paramètres' }} />
        <Stack.Screen name="settings/messages" options={{ title: 'Modèles de messages' }} />
        <Stack.Screen name="settings/questionnaires" options={{ title: 'Questionnaires' }} />
        <Stack.Screen name="settings/report-template" options={{ title: 'Modèle de rapport' }} />
        <Stack.Screen name="settings/security" options={{ title: 'Sécurité' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="legal/[doc]" options={{ title: 'Informations légales' }} />
      </Stack>
    </Animated.View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
        <AuthProvider>
          <Gate />
          <ToastHost />
        </AuthProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
