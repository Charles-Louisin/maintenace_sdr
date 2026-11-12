import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { biometricAvailable, biometricEnabled, biometricLabel } from '../../lib/biometric';
import { colors, space } from '../../theme/tokens';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import { useMutation } from '@tanstack/react-query';
import { post, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Card, Field, H3, Screen, Section, Small } from '../../components/ui';

/** Interrupteur « connexion par empreinte » : l'activation est confirmée par l'empreinte elle-même. */
function BiometricToggle() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [kind, setKind] = useState('empreinte');
  useEffect(() => {
    (async () => {
      setAvailable(await biometricAvailable());
      setOn(await biometricEnabled());
      setKind(await biometricLabel());
    })();
  }, []);
  const { setBiometric } = useAuth();
  const change = async (v: boolean) => {
    try {
      if (!(await setBiometric(v))) return;
      setOn(v);
      toast.success(v ? `Connexion par ${kind} activée` : `Connexion par ${kind} désactivée`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <H3>Connexion par {kind}</H3>
          <Small>{available === false ? 'Aucune empreinte sur cet appareil' : 'Proposée sur l’écran de connexion après une déconnexion'}</Small>
        </View>
        <Switch
          value={on}
          onValueChange={change}
          disabled={!available}
          trackColor={{ true: colors.primary, false: colors.surfaceDeep }}
          thumbColor={colors.surface}
          accessibilityLabel={`Connexion par ${kind}`}
        />
      </View>
    </Card>
  );
}

export default function Security() {
  const { signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const change = useMutation({
    mutationFn: () => post('/api/auth/password/change', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      toast.success('Mot de passe modifié — reconnectez-vous');
      signOut();
    },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });
  return (
    <Screen>
      <BiometricToggle />
      <Section title="Changer le mot de passe">
        <Field label="Mot de passe actuel" value={current} onChangeText={setCurrent} secureTextEntry />
        <Field label="Nouveau mot de passe" value={next} onChangeText={setNext} secureTextEntry hint="10 caractères minimum, lettres et chiffres." />
        <Button title="Modifier" onPress={() => change.mutate()} loading={change.isPending} disabled={!current || next.length < 10} />
      </Section>
    </Screen>
  );
}
