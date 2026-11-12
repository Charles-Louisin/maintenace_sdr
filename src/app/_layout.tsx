import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform, View, Text } from 'react-native';
import Animated, { Extrapolation, FadeIn, FadeOut, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { AuthProvider, useAuth } from '../lib/auth';
import { queryClient, persister } from '../lib/query';
import { useNotificationNavigation } from '../lib/notifications';
import { syncDrafts } from '../lib/drafts';
import { IntroOverlay } from '../components/intro/IntroOverlay';
import { RouteMemory, clearLastRoute } from '../lib/routeMemory';
import { clearLocalReminders, useLocalReminders } from '../lib/localReminders';
import { AuthScreen } from '../components/AuthScreen';
import { NotificationGate, useNotificationGate } from '../components/NotificationGate';
import { ToastHost } from '../components/toast';
import { DialogHost } from '../components/DialogHost';
import { colors, motion } from '../theme/tokens';

/**
 * Un écran ouvert directement (notification, lien, rechargement) garde les onglets en dessous :
 * le bouton « Retour » ramène toujours à l'application au lieu de laisser une impasse.
 */
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Version web (aperçu) : pas de barre de défilement permanente, comme sur le téléphone
 * (Android/iOS n’affichent qu’un fin indicateur pendant le défilement).
 */
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}';
  document.head.appendChild(style);
}

/** Délai laissé à la page de destination (redirection, page restaurée) pour s’afficher avant l’ouverture. */
const SETTLE_MS = 200;

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
        Hors connexion
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
  useNotificationNavigation(status === 'signedIn');
  useLocalReminders(status === 'signedIn' && notif.passed === true);

  // Ouverture animée : la page se prépare sous l’animation, puis est révélée
  const ready = status !== 'loading' && notif.passed !== null;
  const inApp = status === 'signedIn' && notif.passed === true;
  const [restored, setRestored] = useState(false);
  const onRestored = useCallback(() => setRestored(true), []);
  const [settled, setSettled] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const reveal = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(reveal.get(), [0.35, 1], [1.08, 1], Extrapolation.CLAMP) }],
  }));
  useEffect(() => {
    if (!ready || (inApp && !restored)) return;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready, inApp, restored]);
  useEffect(() => {
    if (status === 'signedOut') {
      clearLastRoute();
      clearLocalReminders();
    }
  }, [status]);

  useEffect(() => {
    if (status === 'loading' || status === 'locked') return;
    const inAuth = segments[0] === 'login' || segments[0] === 'forgot-password';
    const isPublic = inAuth || segments[0] === 'legal';
    if (status === 'signedOut' && !isPublic) router.replace('/login');
    if (status === 'signedIn' && inAuth) router.replace('/');
  }, [status, segments]);

  let content: ReactNode = null;
  if (!ready) content = null;
  else if (!notif.passed && notif.perm) content = <NotificationGate perm={notif.perm} asking={notif.asking} check={notif.check} />;
  else if (status === 'locked') {
    content = (
      <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)}>
        <AuthScreen biometric />
      </Animated.View>
    );
  } else {
    content = (
      <Animated.View style={{ flex: 1 }} entering={introDone ? FadeIn.duration(motion.slow) : undefined}>
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
          <Stack.Screen name="settings/task-catalog" options={{ title: 'Fiches d’entretien' }} />
          <Stack.Screen name="settings/profile" options={{ title: 'Mon profil' }} />
          <Stack.Screen name="settings/security" options={{ title: 'Sécurité' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="legal/[doc]" options={{ title: 'Informations légales' }} />
        </Stack>
      </Animated.View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.View style={[{ flex: 1 }, contentStyle]}>{content}</Animated.View>
      <RouteMemory active={inApp} onRestored={onRestored} />
      {!introDone ? <IntroOverlay ready={settled} reveal={reveal} onDone={onIntroDone} /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
          <AuthProvider>
            <Gate />
            <DialogHost />
          <ToastHost />
          </AuthProvider>
        </PersistQueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
