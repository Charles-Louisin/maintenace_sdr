import { Easing, cubicBezier } from 'react-native-reanimated';

/**
 * Système visuel « Salles du Royaume »
 * Ivoire chaud + vert forêt profond + or discret (emblème). Thème clair volontaire (usage de jour, lisibilité).
 * Typographie système (SF / Roboto) : aucune police à télécharger, application légère, mise à l'échelle native.
 */
export const colors = {
  // Surfaces
  bg: '#F3EEE6', // ivoire chaud : fond de l'application
  surface: '#FBF8F3', // cartes : blanc cassé, jamais blanc pur
  surfaceAlt: '#ECE6DC', // zones en creux, pistes de segmentés
  surfaceDeep: '#E2DACD',
  border: 'rgba(28, 42, 34, 0.08)', // filets uniquement
  // Encres
  text: '#18241D',
  textMuted: '#5E655D',
  textFaint: '#979A90',
  // Marque
  primary: '#1F3B2D', // vert forêt
  primaryPressed: '#173024',
  primaryDeep: '#132A1F', // en-têtes, carte « héros »
  primarySoft: '#E1E8DD',
  onPrimary: '#F8F4EC',
  onPrimaryMuted: 'rgba(248, 244, 236, 0.68)',
  gold: '#B48C4E', // emblème, accents rares
  goldSoft: '#F0E5D1',
  // États
  success: '#2D7350',
  successSoft: '#DFEDE3',
  warning: '#9C6417',
  warningSoft: '#F5E7CF',
  danger: '#A93A2C',
  dangerSoft: '#F6DFD9',
  info: '#3C5A78',
  infoSoft: '#E1E8EF',
  whatsapp: '#1F8F4E',
  scrim: 'rgba(19, 42, 31, 0.42)',
} as const;

/** Grille de 4 pt — espacements généreux : ligne < groupe < section. */
export const space = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 40 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6, color: colors.text },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4, color: colors.text },
  h2: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2, color: colors.text },
  h3: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.1, textTransform: 'uppercase' as const, color: colors.textFaint },
  number: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.8, color: colors.text, fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
};

/** Ombres chaudes et légères (2 niveaux) : la hiérarchie vient du contraste des surfaces, pas des ombres. */
export const shadow = {
  card: { boxShadow: '0 1px 2px rgba(42, 36, 24, 0.05), 0 6px 18px rgba(42, 36, 24, 0.05)' },
  raised: { boxShadow: '0 10px 30px rgba(19, 42, 31, 0.16)' },
};

/** Mouvement : durées et courbes partagées (voir animate-expo). */
export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
  easeInOut: Easing.bezier(0.77, 0, 0.175, 1),
  // Même courbe pour les transitions CSS de Reanimated
  cssEaseOut: cubicBezier(0.23, 1, 0.32, 1),
} as const;

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  gold: { bg: colors.goldSoft, fg: colors.gold },
};
