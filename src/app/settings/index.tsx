import { useState } from 'react';
import { Switch, View } from 'react-native';
import { colors, space } from '../../theme/tokens';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, errorMessage } from '../../lib/api';
import type { Settings } from '../../lib/types';
import { usePushPermission } from '../../lib/notifications';
import { Badge, Banner, Button, Card, ErrorState, Field, H3, KeyValue, Loading, Screen, Section, Segmented, Small } from '../../components/ui';

export default function SettingsScreen() {
  const q = useQuery({ queryKey: ['settings'], queryFn: () => get<Settings>('/api/settings') });
  if (q.isPending) return <Loading />;
  if (!q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <SettingsForm s={q.data} />;
}

function SettingsForm({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const push = usePushPermission(true);
  const [f, setF] = useState({
    timezone: s.timezone,
    preCallDaysBefore: String(s.preCallDaysBefore),
    preCallTime: s.preCallTime,
    postCallMode: s.postCallMode,
    postCallNextMorningTime: s.postCallNextMorningTime,
    postCallSameEveningTime: s.postCallSameEveningTime,
    workloadWindowMonths: String(s.workloadWindowMonths),
    aiModel: s.ai?.model ?? '',
  });
  const [autoAi, setAutoAi] = useState(s.ai?.autoAnalyzeReplies === true);

  const save = useMutation({
    mutationFn: () =>
      patch<{ rescheduled: number }>('/api/settings', {
        timezone: f.timezone,
        preCallDaysBefore: Number(f.preCallDaysBefore),
        preCallTime: f.preCallTime,
        postCallMode: f.postCallMode,
        postCallNextMorningTime: f.postCallNextMorningTime,
        postCallSameEveningTime: f.postCallSameEveningTime,
        workloadWindowMonths: Number(f.workloadWindowMonths),
        ai: { model: f.aiModel.trim(), autoAnalyzeReplies: autoAi },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success(r.rescheduled ? `Paramètres enregistrés · ${r.rescheduled} intervention(s) reprogrammée(s)` : 'Paramètres enregistrés');
    },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });

  const set =(k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  return (
    <Screen footer={<Button title="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} />}>
      <Section title="Notifications sur ce téléphone">
        <Card>
          <H3>État : {push.state === 'granted' ? 'autorisées' : push.state === 'denied' ? 'refusées' : push.state === 'unsupported' ? 'non disponibles (simulateur ou web)' : 'non demandées'}</H3>
          {push.state !== 'granted' ? <Button title="Autoriser les notifications" variant="secondary" compact onPress={push.retry} /> : null}
          <Small>Les échéances sont conservées et envoyées par le serveur, même application fermée.</Small>
        </Card>
      </Section>
      <Section title="Appel préalable">
        <Field label="Nombre de jours avant les travaux" value={f.preCallDaysBefore} onChangeText={set('preCallDaysBefore')} keyboardType="number-pad" />
        <Field label="Heure du rappel (HH:MM)" value={f.preCallTime} onChangeText={set('preCallTime')} />
      </Section>
      <Section title="Appel après travaux (par défaut)">
        <Segmented value={f.postCallMode} onChange={(v) => setF({ ...f, postCallMode: v })} options={[{ value: 'next_morning', label: 'Le lendemain' }, { value: 'same_evening', label: 'Le soir même' }]} />
        <Field label="Heure le lendemain (HH:MM)" value={f.postCallNextMorningTime} onChangeText={set('postCallNextMorningTime')} />
        <Field label="Heure le soir même (HH:MM)" value={f.postCallSameEveningTime} onChangeText={set('postCallSameEveningTime')} />
        <Small>Modifiable aussi intervention par intervention.</Small>
      </Section>
      <Field label="Fuseau horaire" value={f.timezone} onChangeText={set('timezone')} autoCapitalize="none" hint="Par défaut : Africa/Douala" />
      <Field label="Période de calcul de la charge des volontaires (mois)" value={f.workloadWindowMonths} onChangeText={set('workloadWindowMonths')} keyboardType="number-pad" />

      <Section title="Intelligence artificielle">
        <Card>
          <KeyValue label="Fournisseur" value="OpenRouter (côté serveur)" />
          <KeyValue label="Modèle" value={s.integrations.ai.model} />
          <Badge label={s.integrations.ai.configured ? 'Clé configurée sur le serveur' : 'Clé API manquante sur le serveur'} tone={s.integrations.ai.configured ? 'success' : 'danger'} />
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <H3>Analyse automatique des réponses</H3>
              <Small>Désactivée : l’IA n’analyse une réponse WhatsApp que lorsque vous appuyez sur « Analyser avec l’IA ». Les fichiers Excel sont toujours lus sans IA.</Small>
            </View>
            <Switch value={autoAi} onValueChange={setAutoAi} trackColor={{ true: colors.primary, false: colors.surfaceDeep }} thumbColor={colors.surface} accessibilityLabel="Analyse automatique des réponses" />
          </View>
        </Card>
        <Field label="Modèle à utiliser (facultatif)" value={f.aiModel} onChangeText={set('aiModel')} autoCapitalize="none" placeholder={s.integrations.ai.model} hint="Laisser vide pour le modèle défini sur le serveur." />
        {!s.integrations.ai.configured ? <Banner tone="warning" title="IA non configurée">Les PDF et images ne peuvent pas être analysés et les réponses doivent être saisies manuellement. Les fichiers Excel restent lus automatiquement.</Banner> : null}
      </Section>
      <Section title="Stockage des documents">
        <Card>
          <KeyValue label="Service" value={s.integrations.storage.driver === 'uploadthing' ? (s.integrations.storage.acl === 'private' ? 'UploadThing (privé)' : 'UploadThing (public)') : 'Disque local (développement)'} />
          <Badge label={s.integrations.storage.configured ? 'Configuré' : 'Jeton UploadThing manquant'} tone={s.integrations.storage.configured ? 'success' : 'danger'} />
        </Card>
      </Section>
    </Screen>
  );
}
