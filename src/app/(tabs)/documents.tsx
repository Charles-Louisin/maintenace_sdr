import { useMemo, useState, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, errorMessage } from '../../lib/api';
import type { ImportBatch } from '../../lib/types';
import { BATCH_STATUS, DOC_KIND, dateToIso, fmtDate, fmtDateTime, plural } from '../../lib/format';
import { useFold } from '../../lib/useFold';
import { startUpload } from '../../lib/uploads';
import { Badge, Banner, Card, Collapsible, Empty, ErrorState, FoldBar, Loading, Screen, Small } from '../../components/ui';
import { colors, radius, shadow, space } from '../../theme/tokens';
import { UploadButton } from '../../components/UploadButton';

const TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

interface UploadResult {
  batchId: string | null;
  accepted: { id: string; name: string }[];
  duplicates: { name: string }[];
  rejected: { name: string; reason: string }[];
}

/** Trois fiches inclinées : illustration statique, légère (aucune image à charger). */
function FilesArt() {
  const tile = (icon: keyof typeof Ionicons.glyphMap, color: string, rotate: string, y: number, z: number) => (
    <View style={[styles.tile, { transform: [{ translateY: y }, { rotate }], zIndex: z }]}>
      <Ionicons name={icon} size={30} color={color} />
    </View>
  );
  return (
    <View style={styles.art} accessibilityElementsHidden>
      {tile('document-text', '#C0392B', '-10deg', 10, 1)}
      {tile('grid', '#1F7A45', '0deg', -6, 2)}
      {tile('image', '#3C5A78', '10deg', 10, 1)}
      <View style={styles.plinth} />
    </View>
  );
}

export default function Documents() {
  const qc = useQueryClient();
  const [last, setLast] = useState<UploadResult | null>(null);
  const q = useQuery({
    queryKey: ['batches'],
    queryFn: () => get<ImportBatch[]>('/api/documents/batches'),
    refetchInterval: (query) => ((query.state.data ?? []).some((b) => ['queued', 'processing'].includes(b.status)) ? 4000 : false),
  });

  const groups = useMemo(() => {
    const m = new Map<string, ImportBatch[]>();
    for (const b of q.data ?? []) {
      const k = dateToIso(new Date(b.createdAt));
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return [...m.entries()].map(([date, items]) => ({ date, items }));
  }, [q.data]);
  const keys = useMemo(() => groups.map((g) => g.date), [groups]);
  const defaults = useMemo(() => keys.slice(0, 1), [keys]);
  const fold = useFold(keys, defaults);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, type: TYPES, copyToCacheDirectory: true });
    if (res.canceled || !res.assets.length) return;
    setLast(null);
    try {
      const form = new FormData();
      for (const a of res.assets) {
        // Web : l'objet File est fourni ; téléphone : { uri, name, type }
        if (a.file) form.append('files', a.file, a.name);
        else form.append('files', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      }
      // Envoi suivi : barre de progression, arrêt possible, continue si l'on quitte l'écran
      const label = plural(res.assets.length, 'document', 'documents');
      const r = await startUpload<UploadResult>({
        key: 'documents',
        label: `Import de ${label}`,
        path: '/api/documents/upload',
        form,
        successMessage: `Import de ${label} terminé — analyse en cours`,
        accept: (e) => {
          const p = (e as { payload?: UploadResult }).payload;
          return p && Array.isArray(p.duplicates) ? p : null;
        },
      });
      qc.invalidateQueries({ queryKey: ['batches'] });
      if (!r) return;
      if (mounted.current) setLast(r);
      if (r.batchId && mounted.current) router.push(`/documents/${r.batchId}`);
    } catch {
      // erreur déjà signalée par un toast
    }
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Card style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xl }}>
        <FilesArt />
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Text style={styles.heroTitle}>Importer vos documents</Text>
          <Small style={{ textAlign: 'center', maxWidth: 290 }}>PDF, Excel, Word ou image</Small>
        </View>
        <UploadButton uploadKey="documents" title="Choisir des fichiers" icon="cloud-upload-outline" variant="primary" onPress={() => void pick()} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
          <Small>Rien n’est enregistré sans validation</Small>
        </View>
      </Card>

      {last?.duplicates.length ? (
        <Banner tone="warning" title="Déjà importés (ignorés)">
          {last.duplicates.map((d) => d.name).join(', ')}
        </Banner>
      ) : null}
      {last?.rejected.length ? (
        <Banner tone="danger" title="Fichiers refusés">
          {last.rejected.map((d) => `${d.name} : ${d.reason}`).join('\n')}
        </Banner>
      ) : null}

      {q.isPending ? (
        <Loading rows={2} />
      ) : q.isError && !q.data ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !groups.length ? (
        <Empty icon="folder-open-outline" title="Aucune importation" text="Vos programmes importés apparaîtront ici." />
      ) : (
        <View style={{ gap: space.md }}>
          <FoldBar
            count={groups.length}
            allOpen={fold.allOpen}
            onToggleAll={fold.toggleAll}
            label={`Historique · ${plural(q.data?.length ?? 0, 'importation')}`}
          />
          {groups.map((g) => (
            <Collapsible
              key={g.date}
              title={fmtDate(g.date)}
              subtitle={plural(g.items.length, 'importation')}
              tone={g.items.some((b) => b.status === 'review') ? 'warning' : 'primary'}
              open={fold.isOpen(g.date)}
              onToggle={() => fold.toggle(g.date)}
            >
              {g.items.map((b) => {
                const st = BATCH_STATUS[b.status] ?? { label: b.status, tone: 'neutral' as const };
                return (
                  <Pressable
                    key={b._id}
                    onPress={() => router.push(`/documents/${b._id}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.batch, pressed && { backgroundColor: colors.surfaceDeep }]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                      <Small>{fmtDateTime(b.createdAt)}</Small>
                      <Badge label={b.status === 'processing' ? `${st.label} · ${b.progress?.percent ?? 0} %` : st.label} tone={st.tone} />
                    </View>
                    {b.documentIds.map((d) => (
                      <View key={d._id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <Ionicons name="document-text-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.docName} numberOfLines={1}>
                          {d.originalName}
                        </Text>
                        <Small>{DOC_KIND[d.kind] ?? d.kind}</Small>
                      </View>
                    ))}
                    {b.error ? <Small style={{ color: colors.danger }}>{b.error}</Small> : null}
                  </Pressable>
                );
              })}
            </Collapsible>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { height: 112, width: 220, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: -10 },
  tile: {
    width: 64,
    height: 78,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -6,
    ...shadow.raised,
  },
  plinth: { position: 'absolute', bottom: 0, width: 150, height: 14, borderRadius: radius.pill, backgroundColor: colors.primary, opacity: 0.9 },
  heroTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  batch: { backgroundColor: colors.bg, borderRadius: radius.md, borderCurve: 'continuous', padding: space.lg, gap: space.sm },
  docName: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
});
