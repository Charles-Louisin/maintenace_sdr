import { useState } from 'react';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, errorMessage } from '../../lib/api';
import type { Settings } from '../../lib/types';
import { Button, Card, ErrorState, Field, Loading, Screen, Segmented, Small } from '../../components/ui';

const VARS = '{volontaire} {salle} {assemblee} {date} {date_relative} {responsable} {telephone_responsable} {travaux} {taches} {consignes} {questions}';

export default function MessageTemplates() {
  const q = useQuery({ queryKey: ['settings'], queryFn: () => get<Settings>('/api/settings') });
  if (q.isPending) return <Loading />;
  if (!q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <TemplatesForm s={q.data} />;
}

function TemplatesForm({ s }: { s: Settings }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'pre' | 'post'>('pre');
  const [pre, setPre] = useState(s.messageTemplates.pre);
  const [postT, setPostT] = useState(s.messageTemplates.post);
  const save = useMutation({
    mutationFn: () => patch('/api/settings', { messageTemplates: { pre, post: postT } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Modèles enregistrés');
    },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });
  return (
    <Screen footer={<Button title="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} />}>
      <Segmented value={kind} onChange={setKind} options={[{ value: 'pre', label: 'Avant travaux' }, { value: 'post', label: 'Après travaux' }]} />
      <Card>
        <Small>Variables disponibles : {VARS}</Small>
        <Small>Une information absente apparaît comme [À COMPLÉTER] dans le message, jamais inventée.</Small>
      </Card>
      {kind === 'pre' ? (
        <Field label="Message de l’appel préalable" value={pre} onChangeText={setPre} multiline style={{ minHeight: 320 }} />
      ) : (
        <Field label="Message de l’appel de suivi" value={postT} onChangeText={setPostT} multiline style={{ minHeight: 320 }} />
      )}
      <Button title="Rétablir le texte par défaut" variant="ghost" onPress={() => (kind === 'pre' ? setPre(s.defaults.pre) : setPostT(s.defaults.post))} />
    </Screen>
  );
}
