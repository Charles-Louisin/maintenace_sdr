import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Alert } from '../../lib/dialog';
import { toast } from '../../components/toast';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, patch, post, errorMessage } from '../../lib/api';
import type { ReportTemplate } from '../../lib/types';
import { Badge, Banner, Body, Button, Card, Chip, Empty, Field, H3, Loading, Screen, Section, Segmented, Small } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

/**
 * Assistant de correspondance : chaque colonne du modèle Word est reliée aux données de l'application.
 * La configuration est enregistrée une fois et réutilisée chaque mois.
 */
export default function ReportTemplateScreen() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['report-templates'], queryFn: () => get<ReportTemplate[]>('/api/report-templates') });
  const fields = useQuery({ queryKey: ['report-fields'], queryFn: () => get<{ sources: { key: string; label: string }[] }>('/api/report-templates/fields') });
  const [picked, setSelectedId] = useState<string | null>(null);
  // Modèle affiché : celui choisi, sinon le modèle actif, sinon le plus récent
  const selectedId = picked ?? (list.data?.length ? (list.data.find((t) => t.active) ?? list.data[0])._id : null);
  const tpl = useQuery({ queryKey: ['report-template', selectedId], queryFn: () => get<ReportTemplate>(`/api/report-templates/${selectedId}`), enabled: Boolean(selectedId) });
  const [uploading, setUploading] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['report-templates'] });
    qc.invalidateQueries({ queryKey: ['report-template', selectedId] });
    qc.invalidateQueries({ queryKey: ['report-preview'] });
  };
  const activate = useMutation({ mutationFn: () => post(`/api/report-templates/${selectedId}/activate`), onSuccess: refresh });

  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', copyToCacheDirectory: true });
    if (r.canceled) return;
    setUploading(true);
    try {
      const form = new FormData();
      const a = r.assets[0];
      // Web : objet File fourni par le sélecteur ; téléphone : { uri, name, type }
      if (a.file) form.append('file', a.file, a.name);
      else form.append('file', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as unknown as Blob);
      const t = await api<ReportTemplate>('/api/report-templates/upload', { method: 'POST', form });
      setSelectedId(t._id);
      refresh();
    } catch (e) {
      Alert.alert('Modèle refusé', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  if (list.isPending) return <Loading />;
  const t = tpl.data;

  const header = (
    <>
      <Card>
        <H3>Modèle « Rapport de suivi »</H3>
        <Body style={{ color: colors.textMuted }}>
          Importez le fichier Word exemple. L’application remplit une COPIE de ce modèle chaque mois : styles, polices, bordures, en-têtes et mise en page sont conservés.
        </Body>
        <Button title="Importer un modèle (.docx)" icon="cloud-upload-outline" variant="secondary" onPress={upload} loading={uploading} />
      </Card>

      {!list.data?.length ? <Empty icon="document-attach-outline" title="Aucun modèle importé" /> : null}
      {list.data && list.data.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {list.data.map((x) => (
            <Chip key={x._id} label={`${x.name}${x.active ? ' (actif)' : ''}`} active={x._id === selectedId} onPress={() => setSelectedId(x._id)} />
          ))}
        </View>
      ) : null}
    </>
  );

  if (!t) {
    return (
      <Screen>
        {header}
        {selectedId ? <Loading /> : null}
      </Screen>
    );
  }
  return <MappingEditor key={`${t._id}-${tpl.dataUpdatedAt}`} t={t} header={header} sources={fields.data?.sources ?? []} onActivate={() => activate.mutate()} activating={activate.isPending} onSaved={refresh} />;
}

function MappingEditor({
  t,
  header,
  sources,
  onActivate,
  activating,
  onSaved,
}: {
  t: ReportTemplate;
  header: ReactNode;
  sources: { key: string; label: string }[];
  onActivate: () => void;
  activating: boolean;
  onSaved: () => void;
}) {
  const [columns, setColumns] = useState(t.mapping.columns);
  const [rowMode, setRowMode] = useState(t.mapping.rowMode);
  const [titleTemplate, setTitleTemplate] = useState(t.mapping.titleTemplate);
  const [emptyValue, setEmptyValue] = useState(t.mapping.emptyValue);
  const saveMapping = useMutation({
    mutationFn: () => patch(`/api/report-templates/${t._id}/mapping`, { columns, rowMode, titleTemplate, emptyValue }),
    onSuccess: () => {
      onSaved();
      toast.success('Correspondances enregistrées — réutilisées chaque mois');
    },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  });
  const toggle = (ci: number, key: string) =>
    setColumns(columns.map((c) => (c.index === ci ? { ...c, sources: c.sources.includes(key) ? c.sources.filter((s) => s !== key) : [...c.sources, key] } : c)));

  return (
    <Screen footer={<Button title="Enregistrer les correspondances" onPress={() => saveMapping.mutate()} loading={saveMapping.isPending} />}>
      {header}
      {(
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <H3 style={{ flex: 1 }}>{t.name}</H3>
              <Badge label={t.active ? 'Actif' : 'Inactif'} tone={t.active ? 'success' : 'neutral'} />
            </View>
            <Small>
              Mise en page : {t.analysis?.page.orientation === 'landscape' ? 'paysage' : 'portrait'} · Polices : {t.analysis?.fonts.slice(0, 4).join(', ')}
            </Small>
            {!t.active ? <Button title="Utiliser ce modèle" compact onPress={onActivate} loading={activating} /> : null}
          </Card>
          {!t.mappingConfirmedAt ? <Banner tone="info" title="Vérifiez les correspondances">Une proposition a été faite à partir des en-têtes du modèle. Ajustez-la puis enregistrez.</Banner> : null}

          <Section title="Organisation des lignes">
            <Segmented value={rowMode} onChange={setRowMode} options={[{ value: 'per_event', label: 'Date × assemblée' }, { value: 'per_task', label: 'Par tâche' }, { value: 'per_venue', label: 'Par salle' }]} />
            <Small>Par défaut : une rubrique par date de travaux et par assemblée, uniquement pour les comptes rendus reçus après travaux.</Small>
          </Section>

          <Section title="Colonnes du modèle">
            {columns.map((c) => {
              const question = t.analysis?.questions.find((x) => x.columnIndex === c.index)?.question;
              return (
                <Card key={c.index}>
                  <H3>{c.header || `Colonne ${c.index + 1}`}</H3>
                  {question ? <Small style={{ fontStyle: 'italic' }}>Question du modèle : {question}</Small> : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {sources.map((s) => (
                      <Chip key={s.key} label={s.label} active={c.sources.includes(s.key)} onPress={() => toggle(c.index, s.key)} />
                    ))}
                  </View>
                  {!c.sources.length ? <Small style={{ color: colors.warning }}>Aucune donnée : la colonne affichera « {emptyValue} ».</Small> : null}
                </Card>
              );
            })}
          </Section>
          <Field label="Titre (« {venues} » = salles du mois)" value={titleTemplate} onChangeText={setTitleTemplate} />
          <Field label="Texte pour une information absente" value={emptyValue} onChangeText={setEmptyValue} />
        </>
      )}
    </Screen>
  );
}
