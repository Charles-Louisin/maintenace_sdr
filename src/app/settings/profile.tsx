import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { del, errorMessage, patch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { pickAndUploadImage } from '../../lib/images';
import { toast } from '../../components/toast';
import { Avatar, Button, Field, Screen, Section } from '../../components/ui';
import { space } from '../../theme/tokens';
import { UploadButton } from '../../components/UploadButton';

/** Mes informations : nom, téléphone, e-mail de connexion et photo de profil (affichée sur l'accueil). */
export default function Profile() {
  const { owner, refreshOwner } = useAuth();
  const [displayName, setDisplayName] = useState(owner?.displayName ?? '');
  const [phone, setPhone] = useState(owner?.phone ?? '');
  const [email, setEmail] = useState(owner?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const emailChanged = email.trim().toLowerCase() !== (owner?.email ?? '').toLowerCase();

  const save = useMutation({
    meta: { success: 'Profil enregistré' },
    mutationFn: () =>
      patch('/api/auth/me', {
        displayName: displayName.trim(),
        phone: phone.trim(),
        ...(emailChanged ? { email: email.trim(), currentPassword } : {}),
      }),
    onSuccess: async () => {
      await refreshOwner();
      setCurrentPassword('');
      router.back();
    },
  });

  const choosePhoto = async () => {
    try {
      if (!(await pickAndUploadImage('/api/uploads/images/avatar', [1, 1], 'Photo de profil', 'Photo de profil enregistrée', 'avatar'))) return;
      await refreshOwner();
    } catch {
      // erreur déjà signalée par un toast
    }
  };
  const removePhoto = async () => {
    try {
      await del('/api/uploads/images/avatar');
      await refreshOwner();
      toast.success('Photo retirée');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Screen
      footer={
        <Button
          title="Enregistrer"
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={displayName.trim().length < 2 || (emailChanged && currentPassword.length < 1)}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: space.md }}>
        <Avatar name={displayName || 'P'} tone="gold" size={104} image={owner?.avatarUrl} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <UploadButton
            uploadKey="avatar"
            title={owner?.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
            icon="camera-outline"
            onPress={() => void choosePhoto()}
          />
          {owner?.avatarUrl ? <Button title="Retirer" variant="ghost" compact onPress={removePhoto} /> : null}
        </View>
      </View>
      <Section title="Mes informations">
        <Field label="Nom affiché" value={displayName} onChangeText={setDisplayName} />
        <Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="E-mail de connexion" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        {emailChanged ? (
          <Field label="Mot de passe actuel" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry hint="Requis pour changer l’e-mail" />
        ) : null}
      </Section>
    </Screen>
  );
}
