import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, errorMessage } from '../../lib/api';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import type { CatalogEntry } from '../../lib/types';
import { Button, Collapsible, Empty, ErrorState, Field, Loading, Screen } from '../../components/ui';
import { space } from '../../theme/tokens';

/** Liste ⇄ texte : une ligne par élément. */
const toLines = (a: string[] | undefined) => (a ?? []).join('\n');
const fromLines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

/** Fiches d'entretien (catalogue des tâches) : titre, fréquence, matériel, EPI, étapes… toutes modifiables. */
export default function TaskCatalog() {
  const q = useQuery({ queryKey: ['task-catalog'], queryFn: () => get<CatalogEntry[]>('/api/task-catalog') });
  const [open, setOpen] = useState<string | null>(null);
  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const list = q.data ?? [];
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {!list.length ? <Empty icon="construct-outline" title="Aucune fiche" /> : null}
      {list.map((e) => (
        <Collapsible
          key={e._id}
          title={e.title}
          subtitle={[e.category, e.frequency].filter(Boolean).join(' · ') || undefined}
          open={open === e._id}
          onToggle={() => setOpen(open === e._id ? null : e._id)}
        >
          {open === e._id ? <EntryForm entry={e} onSaved={() => setOpen(null)} /> : null}
        </Collapsible>
      ))}
    </Screen>
  );
}

function EntryForm({ entry, onSaved }: { entry: CatalogEntry; onSaved: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState(entry.category ?? '');
  const [frequency, setFrequency] = useState(entry.frequency ?? '');
  const [materials, setMaterials] = useState(toLines(entry.materials));
  const [ppe, setPpe] = useState(toLines(entry.ppe));
  const [products, setProducts] = useState(toLines(entry.products));
  const [steps, setSteps] = useState(toLines(entry.steps));
  const [notes, setNotes] = useState(entry.notes ?? '');
  const save = useMutation({
    mutationFn: () =>
      patch(`/api/task-catalog/${entry._id}`, {
        title: title.trim(),
        category,
        frequency,
        materials: fromLines(materials),
        ppe: fromLines(ppe),
        products: fromLines(products),
        steps: fromLines(steps),
        notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-catalog'] });
      toast.success('Fiche enregistrée');
      onSaved();
    },
    onError: (e) => Alert.alert('Enregistrement impossible', errorMessage(e)),
  });
  return (
    <View style={{ gap: space.md }}>
      <Field label="Titre de la tâche" value={title} onChangeText={setTitle} />
      <Field label="Catégorie" value={category} onChangeText={setCategory} />
      <Field label="Fréquence" value={frequency} onChangeText={setFrequency} />
      <Field label="Matériel (un par ligne)" value={materials} onChangeText={setMaterials} multiline />
      <Field label="Équipements de protection (un par ligne)" value={ppe} onChangeText={setPpe} multiline />
      <Field label="Produits (un par ligne)" value={products} onChangeText={setProducts} multiline />
      <Field label="Étapes du travail (une par ligne, dans l’ordre)" value={steps} onChangeText={setSteps} multiline />
      <Field label="Notes et consignes" value={notes} onChangeText={setNotes} multiline />
      <Button title="Enregistrer la fiche" onPress={() => save.mutate()} loading={save.isPending} disabled={!title.trim()} />
    </View>
  );
}
