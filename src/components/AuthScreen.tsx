import { useEffect, useState } from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../lib/auth';
import { LEGAL_LINKS } from '../lib/legal';
import { errorMessage } from '../lib/api';
import { biometricLabel } from '../lib/biometric';
import { Emblem } from './brand';
import { Banner, Button, Field } from './ui';
import { colors, motion, radius, space } from '../theme/tokens';

/**
 * Image de fond de l'écran de connexion.
 * Pour la changer : remplacez le fichier assets/login-background.jpg (format portrait, ~1080×1920).
 */
const BACKGROUND = require('../../assets/login-background.jpg');

const schema = z.object({
  email: z.email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

function PasswordForm({ showForgot }: { showForgot: boolean }) {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signIn(v.email.trim(), v.password);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <View style={{ gap: space.xl }}>
      {error ? (
        <Banner tone="danger" title="Connexion impossible">
          {error}
        </Banner>
      ) : null}
      <View style={{ gap: space.lg }}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field
              label="E-mail"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              value={field.value}
              onChangeText={field.onChange}
              error={formState.errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Field
              label="Mot de passe"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              value={field.value}
              onChangeText={field.onChange}
              onSubmitEditing={() => onSubmit()}
              error={formState.errors.password?.message}
            />
          )}
        />
      </View>
      <Button title="Se connecter" icon="arrow-forward" onPress={onSubmit} loading={formState.isSubmitting} />
      {showForgot ? (
        <Link href="/forgot-password" style={{ alignSelf: 'center', padding: space.sm }}>
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Mot de passe oublié ?</Text>
        </Link>
      ) : null}
    </View>
  );
}

/** Connexion par empreinte / Face ID : aucun formulaire, un seul geste. L'invite s'ouvre d'elle-même. */
function BiometricPanel({ onOther }: { onOther: () => void }) {
  const { unlock } = useAuth();
  const [kind, setKind] = useState('empreinte');
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);

  const tryUnlock = async () => {
    setBusy(true);
    const ok = await unlock();
    setBusy(false);
    setFailed(!ok);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const k = await biometricLabel();
      if (alive) setKind(k);
      const ok = await unlock();
      if (!alive) return;
      setBusy(false);
      setFailed(!ok);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- invite unique à l'ouverture
  }, []);

  const isFace = kind === 'Face ID';
  return (
    <View style={{ gap: space.md }}>
      {failed ? (
        <Banner tone="warning" title={isFace ? 'Visage non reconnu' : 'Empreinte non reconnue'}>
          Réessayez, ou utilisez une autre méthode.
        </Banner>
      ) : null}
      <Button
        title={isFace ? 'Se connecter avec Face ID' : 'Se connecter par empreinte'}
        icon={isFace ? 'scan-outline' : 'finger-print'}
        onPress={tryUnlock}
        loading={busy}
      />
      <Button title="Autre méthode" variant="ghost" onPress={onOther} />
    </View>
  );
}

/**
 * Écran d'accès unique : image de fond, emblème, puis une feuille ivoire.
 * - mode « biometric » (session présente + empreinte activée) : bouton d'empreinte et « Autre méthode » seulement ;
 * - sinon : formulaire e-mail / mot de passe.
 */
export function AuthScreen({ biometric = false }: { biometric?: boolean }) {
  const [usePassword, setUsePassword] = useState(!biometric);
  return (
    <ImageBackground source={BACKGROUND} resizeMode="cover" style={{ flex: 1, backgroundColor: colors.primaryDeep }}>
      <StatusBar style="light" />
      <View style={styles.scrim} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Emblem size={72} onDark />
            <Text style={styles.brand}>BATIS</Text>
            <Text style={styles.brandSub}>Maintenance des Salles du Royaume</Text>
            <Text style={styles.tagline}>Planifier · Suivre · Rendre compte</Text>
          </View>
          <View style={styles.sheet}>
            <View style={{ gap: 6 }}>
              <Text style={styles.title}>{usePassword ? 'Connexion' : 'Bon retour'}</Text>
              <Text style={styles.subtitle}>{usePassword ? 'Votre espace personnel de suivi' : 'Votre session vous attend.'}</Text>
            </View>
            {usePassword ? (
              <Animated.View key="pw" entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={{ gap: space.md }}>
                <PasswordForm showForgot={!biometric} />
                {biometric ? <Button title="Utiliser l’empreinte" variant="ghost" icon="finger-print" onPress={() => setUsePassword(false)} /> : null}
              </Animated.View>
            ) : (
              <Animated.View key="bio" entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)}>
                <BiometricPanel onOther={() => setUsePassword(true)} />
              </Animated.View>
            )}
            {!biometric ? (
              <View style={styles.legal}>
                {LEGAL_LINKS.map((l) => (
                  <Link key={l.id} href={`/legal/${l.id}`} style={styles.legalLink}>
                    {l.title}
                  </Link>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  /** Voile neutre légèrement sombre : le texte reste lisible quelle que soit la couleur de l'image. */
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  top: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingTop: space.xxl * 2,
    paddingBottom: space.xxl,
    paddingHorizontal: space.xl,
  },
  brand: {
    color: colors.onPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: space.md,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  brandSub: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '500',
    opacity: 0.95,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tagline: {
    color: '#F0D29A',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: space.sm,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl + 8,
    borderTopRightRadius: radius.xl + 8,
    borderCurve: 'continuous',
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
  },
  subtitle: { fontSize: 15, color: colors.textMuted },
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: space.lg, rowGap: space.xs },
  legalLink: { color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline', paddingVertical: space.xs },
});
