import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, put, errorMessage } from '../../lib/api';
import type { Question, Questionnaire, Settings } from '../../lib/types';
import { Button, Card, Chip, Field, H3, Loading, Screen, Section, Segmented, Small } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

const TYPES: { value: string; label: string }[] = [
  { value: 'yes_no', label: 'Oui / Non' },
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'amount', label: 'Montant' },
  { value: 'date', label: 'Date' },
  { value: 'multiple_choice', label: 'Choix multiple' },
  { value: 'status_list', label: 'Liste de statuts' },
  { value: 'observations', label: 'Observations' },
];

export default function Questionnaires() {
  const q = useQuery({ queryKey: ['questionnaires'], queryFn: () => get<Questionnaire[]>('/api/questionnaires') });
  const [kind, setKind] = useState<'post' | 'pre'>('post');
  if (q.isPending) return <Loading />;
  const t = q.data?.find((x) => x.kind === kind);
  return <Editor key={`${kind}-${q.dataUpdatedAt}`} kind={kind} setKind={setKind} initial={t ? [...t.questions].sort((a, b) => a.order - b.order) : []} />;
}

function Editor({ kind, setKind, initial }: { kind: 'post' | 'pre'; setKind: (k: 'post' | 'pre') => void; initial: Question[] }) {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => get<Settings>('/api/settings') });
  const [questions, setQuestions] = useState<Question[]>(initial);
  const [open, setOpen] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: () => put(`/api/questionnaires/${kind}`, { questions: questions.map((x, i) => ({ ...x, order: i + 1 })) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire enregistré');
    },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });

  const upd = (i: number, p: Partial<Question>) => setQuestions(questions.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= questions.length) return;
    const n = [...questions];
    [n[i], n[j]] = [n[j], n[i]];
    setQuestions(n);
    setOpen(j);
  };

  return (
    <Screen footer={<Button title="Enregistrer le questionnaire" onPress={() => save.mutate()} loading={save.isPending} />}>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'post', label: 'Après travaux' },
          { value: 'pre', label: 'Avant travaux' },
        ]}
      />
      <Small>
        Les questions « par tâche » sont répétées pour chaque tâche de l’intervention ({'{tache}'} est remplacé par son nom). Le champ du rapport indique la
        colonne du rapport mensuel alimentée par la réponse.
      </Small>
      {questions.map((x, i) => (
        <Card key={x._id ?? `n${i}`} style={x.active === false ? { opacity: 0.6 } : undefined}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <H3 style={{ flex: 1 }} numberOfLines={open === i ? undefined : 2}>
              {i + 1}. {x.label}
            </H3>
            <Button title={open === i ? 'Fermer' : 'Modifier'} variant="ghost" compact onPress={() => setOpen(open === i ? null : i)} />
          </View>
          <Small>
            {TYPES.find((t) => t.value === x.type)?.label} · {x.required ? 'obligatoire' : 'facultative'}
            {x.perTask ? ' · par tâche' : ''}
            {x.reportField ? ` · rapport : ${settings.data?.reportFields.find((f) => f.key === x.reportField)?.label ?? x.reportField}` : ''}
          </Small>
          {open === i ? (
            <View style={{ gap: space.md, marginTop: space.sm }}>
              <Field label="Intitulé" value={x.label} onChangeText={(v) => upd(i, { label: v })} multiline />
              <Field label="Description" value={x.description ?? ''} onChangeText={(v) => upd(i, { description: v })} />
              <Section title="Type de réponse">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {TYPES.map((t) => (
                    <Chip key={t.value} label={t.label} active={x.type === t.value} onPress={() => upd(i, { type: t.value })} />
                  ))}
                </View>
              </Section>
              {['multiple_choice', 'status_list'].includes(x.type) ? (
                <Field
                  label="Options (séparées par des virgules)"
                  value={(x.options ?? []).join(', ')}
                  onChangeText={(v) =>
                    upd(i, {
                      options: v
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              ) : null}
              <Field label="Catégorie" value={x.category ?? ''} onChangeText={(v) => upd(i, { category: v })} />
              <Field
                label="Seulement pour les tâches de la catégorie (facultatif)"
                value={x.taskCategory ?? ''}
                onChangeText={(v) => upd(i, { taskCategory: v })}
              />
              <Section title="Champ du rapport mensuel">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <Chip label="Aucun" active={!x.reportField} onPress={() => upd(i, { reportField: '' })} />
                  {(settings.data?.reportFields ?? []).map((f) => (
                    <Chip key={f.key} label={f.label} active={x.reportField === f.key} onPress={() => upd(i, { reportField: f.key })} />
                  ))}
                </View>
              </Section>
              {[
                { k: 'required' as const, label: 'Obligatoire' },
                { k: 'perTask' as const, label: 'Répéter pour chaque tâche' },
                { k: 'active' as const, label: 'Active' },
              ].map((o) => (
                <View key={o.k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Small style={{ color: colors.text }}>{o.label}</Small>
                  <Switch
                    value={o.k === 'active' ? x.active !== false : Boolean(x[o.k])}
                    onValueChange={(v) => upd(i, { [o.k]: v })}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button title="Monter" compact variant="secondary" onPress={() => move(i, -1)} />
                <Button title="Descendre" compact variant="secondary" onPress={() => move(i, 1)} />
                <Button title="Supprimer" compact variant="danger" onPress={() => setQuestions(questions.filter((_, k) => k !== i))} />
              </View>
            </View>
          ) : null}
        </Card>
      ))}
      <Button
        title="Ajouter une question"
        icon="add"
        variant="secondary"
        onPress={() => {
          setQuestions([...questions, { label: 'Nouvelle question ?', type: 'text', order: questions.length + 1, required: false, active: true }]);
          setOpen(questions.length);
        }}
      />
    </Screen>
  );
}
