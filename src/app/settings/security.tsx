import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { authenticate, biometricAvailable, biometricEnabled, biometricLabel, setBiometricEnabled } from '../../lib/biometric';
import { colors, space } from '../../theme/tokens';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { get, post, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDateTime } from '../../lib/format';
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
  const change = async (v: boolean) => {
    if (v && !(await authenticate('Confirmez pour activer'))) return;
    await setBiometricEnabled(v);
    setOn(v);
    toast.success(v ? `Connexion par ${kind} activée` : `Connexion par ${kind} désactivée`);
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <H3>Connexion par {kind}</H3>
          <Small>
            {available === false
              ? 'Indisponible : aucune empreinte enregistrée sur ce téléphone (ou navigateur web).'
              : 'Déverrouille l’application au démarrage et après 2 minutes en arrière-plan.'}
          </Small>
        </View>
        <Switch value={on} onValueChange={change} disabled={!available} trackColor={{ true: colors.primary, false: colors.surfaceDeep }} thumbColor={colors.surface} accessibilityLabel={`Connexion par ${kind}`} />
      </View>
    </Card>
  );
}

const ACTIONS: Record<string, string> = {
  login: 'Connexion',
  upload: 'Importation',
  validate: 'Validation',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  mark_sent: 'Message confirmé envoyé',
  generate: 'Rapport généré',
  password_change: 'Mot de passe modifié',
  password_reset: 'Mot de passe réinitialisé',
  paste_report: 'Réponse WhatsApp collée',
  assign: 'Volontaire attribué',
  edit_proposal: 'Correction d’une extraction',
  update_mapping: 'Correspondances du rapport',
  merge_duplicates: 'Fusion de doublons',
  cancel: 'Intervention annulée',
  archive: 'Archivage',
  soft_delete: 'Suppression (historique conservé)',
  create_from_import: 'Créé depuis une importation',
  settings_update: 'Paramètres modifiés',
  upload_template: 'Modèle importé',
};

export default function Security() {
  const { signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => get<{ _id: string; action: string; entity: string; createdAt: string }[]>('/api/audit') });
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
      <Card>
        <H3>Sauvegardes et conservation</H3>
        <Small>Les sauvegardes automatiques de la base MongoDB et la politique de conservation sont gérées côté serveur (voir la documentation du backend).</Small>
        <Small>Les jetons de session sont stockés dans le trousseau sécurisé du téléphone.</Small>
      </Card>
      <Section title="Journal des actions">
        <Card>
          {(audit.data ?? []).slice(0, 60).map((a) => (
            <Small key={a._id}>
              {fmtDateTime(a.createdAt)} — {ACTIONS[a.action] ?? a.action} ({a.entity})
            </Small>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
