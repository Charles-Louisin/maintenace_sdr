import type { Tone } from '../theme/tokens';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MONTH_NAMES = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));
export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** "AAAA-MM-JJ" -> Date locale à midi (évite les décalages de fuseau). */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayIso() {
  return dateToIso(new Date());
}
export function addDays(iso: string, n: number) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + n);
  return dateToIso(d);
}

export function fmtDate(iso: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!iso) return 'Date manquante';
  const d = isoToDate(iso);
  const s = `${opts.weekday === false ? '' : DAYS[d.getDay()] + ' '}${d.getDate()} ${MONTHS[d.getMonth()]}${opts.year === false ? '' : ' ' + d.getFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** Semaine d'un programme « semaine du X » : du jour X au dimanche suivant. */
export function weekDays(iso: string): string[] {
  const d = isoToDate(iso);
  const wd = (d.getDay() + 6) % 7; // 0 = lundi
  const len = wd === 6 ? 8 : 7 - wd;
  return Array.from({ length: len }, (_, i) => dateToIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)));
}
/** « Semaine du 9 au 15 novembre » */
export function fmtWeek(iso: string): string {
  const days = weekDays(iso);
  const s = isoToDate(days[0]);
  const e = isoToDate(days[days.length - 1]);
  return `Semaine du ${s.getDate()}${s.getMonth() !== e.getMonth() ? ' ' + MONTHS[s.getMonth()] : ''} au ${e.getDate()} ${MONTHS[e.getMonth()]}`;
}
/** Date affichée d'une intervention : jour exact, ou semaine (avec le jour s'il est connu). */
export function fmtEventDate(e: { date: string; plannedDay?: string | null }, weekly: boolean, opts: { year?: boolean } = {}): string {
  if (!weekly) return fmtDate(e.date, opts);
  return e.plannedDay ? `${fmtDate(e.plannedDay, opts)} · ${fmtWeek(e.date).toLowerCase()}` : fmtWeek(e.date);
}

/** « 1 intervention », « 3 interventions » */
export function plural(n: number, word: string, pluralWord = word + 's') {
  return `${n} ${n > 1 ? pluralWord : word}`;
}

export function fmtShort(iso: string) {
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}
/** Ce numéro du responsable est-il sur WhatsApp ? */
export function isWhatsapp(c: { whatsappPhones?: string[] } | null | undefined, phone: string | undefined): boolean {
  return Boolean(c && phone && c.whatsappPhones?.includes(phone));
}
/** Heure seule, ex. 09h00 */
export function fmtTime(v: string | Date): string {
  const d = new Date(v);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}
export function relativeDays(iso: string): string {
  const diff = Math.round((isoToDate(iso).getTime() - isoToDate(todayIso()).getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return diff > 0 ? `Dans ${diff} jours` : `Il y a ${-diff} jours`;
}

export function fmtPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  if (e164.startsWith('237') && e164.length === 12) {
    const n = e164.slice(3);
    return `+237 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  return '+' + e164;
}

/** Lien WhatsApp Click to Chat avec message prérempli (accents, retours à la ligne encodés). */
export function whatsappUrl(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

export const CALL_STATUS: Record<string, { label: string; tone: Tone }> = {
  planned: { label: 'Programmé', tone: 'neutral' },
  notified: { label: 'À transmettre', tone: 'warning' },
  message_sent: { label: 'Message envoyé', tone: 'info' },
  response_received: { label: 'Réponse reçue', tone: 'info' },
  completed: { label: 'Accompli', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};
export const EVENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  scheduled: { label: 'Programmée', tone: 'primary' },
  done: { label: 'Bilan reçu', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};
export const BATCH_STATUS: Record<string, { label: string; tone: Tone }> = {
  uploaded: { label: 'Importé', tone: 'neutral' },
  queued: { label: 'En attente', tone: 'info' },
  processing: { label: 'Analyse en cours', tone: 'info' },
  review: { label: 'À vérifier', tone: 'warning' },
  validated: { label: 'Validé', tone: 'success' },
  failed: { label: 'Échec', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};
export const ANSWER_STATUS: Record<string, { label: string; tone: Tone }> = {
  answered: { label: 'Répondu', tone: 'success' },
  to_verify: { label: 'À vérifier', tone: 'warning' },
  missing: { label: 'Sans réponse', tone: 'danger' },
};
export const OUTCOME: Record<string, { label: string; tone: Tone }> = {
  done: { label: 'Réalisée', tone: 'success' },
  partial: { label: 'Partielle', tone: 'warning' },
  not_done: { label: 'Non réalisée', tone: 'danger' },
  unknown: { label: 'Non renseigné', tone: 'neutral' },
};
export const DOC_KIND: Record<string, string> = {
  program: 'Programme',
  task_catalog: 'Fiche des tâches',
  report_template: 'Modèle de rapport',
  other: 'Autre',
  unknown: 'Non classé',
};
