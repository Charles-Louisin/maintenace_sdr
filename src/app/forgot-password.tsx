import { useState } from 'react';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '../lib/api';
import { Banner, Body, Button, Card, Field, H3, Screen } from '../components/ui';
import { colors } from '../theme/tokens';

const schema = z
  .object({
    email: z.email('Adresse e-mail invalide'),
    recoveryCode: z.string().min(10, 'Code de récupération requis'),
    newPassword: z
      .string()
      .min(10, '10 caractères minimum')
      .regex(/[a-zA-Z]/, 'Ajoutez des lettres')
      .regex(/\d/, 'Ajoutez des chiffres'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Les mots de passe ne correspondent pas' });

/**
 * Réinitialisation sécurisée sans service d'e-mail : elle exige le code de récupération
 * remis à la création du compte. Un nouveau code est alors généré.
 */
export default function ForgotPassword() {
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', recoveryCode: '', newPassword: '', confirm: '' },
  });

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await api<{ newRecoveryCode: string }>('/api/auth/password/reset', {
        method: 'POST',
        auth: false,
        body: { email: v.email.trim(), recoveryCode: v.recoveryCode.trim(), newPassword: v.newPassword },
      });
      setNewCode(r.newRecoveryCode);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  if (newCode) {
    return (
      <Screen>
        <Banner tone="success" icon="checkmark-circle" title="Mot de passe modifié">
          Notez votre NOUVEAU code de récupération.
        </Banner>
        <Card>
          <H3 style={{ fontFamily: 'monospace', letterSpacing: 1, textAlign: 'center' }}>{newCode}</H3>
          <Button title="Copier le code" variant="secondary" icon="copy-outline" onPress={() => Clipboard.setStringAsync(newCode)} />
        </Card>
        <Button title="Retour à la connexion" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  const fields = [
    { name: 'email' as const, label: 'E-mail du compte', props: { autoCapitalize: 'none' as const, keyboardType: 'email-address' as const } },
    { name: 'recoveryCode' as const, label: 'Code de récupération', props: { autoCapitalize: 'characters' as const } },
    { name: 'newPassword' as const, label: 'Nouveau mot de passe', props: { secureTextEntry: true } },
    { name: 'confirm' as const, label: 'Confirmer le mot de passe', props: { secureTextEntry: true } },
  ];

  return (
    <Screen>
      <Body style={{ color: colors.textMuted }}>
        Saisissez le code de récupération qui vous a été remis lors de la création du compte (format XXXXX-XXXXX-XXXXX-XXXXX).
      </Body>
      {error ? (
        <Banner tone="danger" title="Échec">
          {error}
        </Banner>
      ) : null}
      {fields.map((f) => (
        <Controller
          key={f.name}
          control={control}
          name={f.name}
          render={({ field }) => (
            <Field label={f.label} value={field.value} onChangeText={field.onChange} error={formState.errors[f.name]?.message} {...f.props} />
          )}
        />
      ))}
      <Button title="Réinitialiser" onPress={submit} loading={formState.isSubmitting} />
    </Screen>
  );
}
