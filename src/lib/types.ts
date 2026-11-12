/** Formes des réponses de l'API utilisées par l'application. */
export interface Ref<T = string> {
  _id: string;
  name?: T;
}
export interface Congregation {
  _id: string;
  name: string;
  aliases: string[];
  isGroup: boolean;
  coordinatorId?: string | { _id: string; fullName: string; phones: string[] } | null;
}
export interface Venue {
  _id: string;
  name: string;
  city: string;
  address: string;
  notes: string;
  congregations: Congregation[];
  /** Photo de la salle (lien signé) */
  imageUrl?: string | null;
  /** Programmes donnés « semaine du » */
  weeklySchedule?: boolean;
  eventCount?: number;
}
export interface Contact {
  _id: string;
  fullName: string;
  phones: string[];
  /** Responsable de toute la salle (toutes ses assemblées) */
  venueIds: string[];
  /** Responsable d’assemblées précises */
  congregationIds?: string[];
  /** Numéros (parmi phones) joignables sur WhatsApp */
  whatsappPhones?: string[];
  role: string;
  notes: string;
  callLog?: { at: string; summary: string; workEventId?: string }[];
}
export interface Volunteer {
  _id: string;
  fullName: string;
  whatsapp: string;
  active: boolean;
  skills: string[];
  notes: string;
  weeklyAvailability: { weekday: number; from?: string; to?: string }[];
  unavailabilities: { from: string; to: string; reason?: string }[];
  stats?: {
    totalMissions: number;
    monthMissions: number;
    windowMissions: number;
    windowMonths: number;
    lastMissionAt: string | null;
    nextMissionAt: string | null;
  };
}
export interface CatalogEntry {
  _id: string;
  title: string;
  category: string;
  frequency: string;
  materials: string[];
  ppe: string[];
  products: string[];
  steps: string[];
  notes: string;
  reference: string;
}
export interface EventTask {
  _id: string;
  label: string;
  category: string;
  description: string;
  catalogRef: string;
  catalogEntryId: string | CatalogEntry | null;
  outcome: 'unknown' | 'done' | 'partial' | 'not_done';
  outcomeNote: string;
}
export interface CallSummary {
  _id: string;
  type: 'pre' | 'post';
  status: string;
  dueAt: string;
  needsManualAssignment: boolean;
  volunteerId: { _id: string; fullName: string; whatsapp?: string } | null;
}
export interface WorkEvent {
  _id: string;
  programName: string;
  venueId: { _id: string; name: string; city?: string; congregations?: Congregation[] };
  congregationId: string | null;
  congregationName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: 'scheduled' | 'done' | 'cancelled';
  tasks: EventTask[];
  responsibleContactId: { _id: string; fullName: string; phones: string[]; role?: string; whatsappPhones?: string[] } | null;
  postCallTimingOverride: 'next_morning' | 'same_evening' | null;
  /** Salle à la semaine : jour des travaux donné par le responsable */
  plannedDay?: string | null;
  calls: CallSummary[];
  history?: { at: string; action: string; details?: unknown }[];
  reports?: IncomingReport[];
  documents?: { _id: string; originalName: string; format: string; kind: string }[];
  sources?: { documentId: string; documentName: string; page?: number; sheet?: string; row?: number; cell?: string }[];
  cancelledReason?: string;
}
export interface RankedVolunteer {
  volunteerId: string;
  fullName: string;
  score: number;
  eligible: boolean;
  reasons: string[];
}
export interface CallAssignment {
  _id: string;
  workEventId: string | WorkEvent;
  type: 'pre' | 'post';
  status: string;
  dueAt: string;
  volunteerId: { _id: string; fullName: string; whatsapp: string } | null;
  assignmentMode: 'auto' | 'manual' | 'none';
  needsManualAssignment: boolean;
  recommendation?: { computedAt: string; ranking: RankedVolunteer[]; explanation: string };
  message: { text: string; edited: boolean; versions?: { text: string; at: string; source: string }[] };
  questions: { questionId: string; label: string; reportField: string; taskLabel: string }[];
  sentConfirmedAt: string | null;
  /** Envois confirmés, un par volontaire contacté */
  sends?: { at: string; volunteerId: string; volunteerName: string }[];
  completedAt?: string | null;
  completionNote?: string;
  completionOutcome?: 'done' | 'not_done' | null;
  /** Rappels prévus ou envoyés pour cette mission (échéance, puis retard chaque jour) */
  reminders?: { _id: string; kind: string; dueAt: string; status: string; deliveryStatus?: string }[];
  whatsappOpenedAt: string | null;
  event?: WorkEvent;
  whatsappUrl?: string | null;
  volunteerPhoneDisplay?: string | null;
  history?: { at: string; action: string }[];
}
export interface Answer {
  questionId: string;
  label: string;
  reportField: string;
  taskLabel: string;
  value: string;
  status: 'answered' | 'missing' | 'to_verify';
  evidence: string;
}
export interface Structured {
  summary: string;
  responsibleReached: 'yes' | 'no' | 'unknown';
  preparationsDone: 'yes' | 'no' | 'partial' | 'unknown';
  answers: Answer[];
  tasks: { label: string; outcome: 'done' | 'partial' | 'not_done' | 'unknown'; note: string }[];
  issues: string[];
  solutions: string[];
  recommendations: string[];
  expenses: { label: string; amount: number | null; currency: string }[];
  availability: string;
  otherInfo: string;
  unansweredQuestions?: string[];
}
export interface IncomingReport {
  _id: string;
  callAssignmentId: string;
  workEventId: string | { _id: string; date: string; congregationName: string; venueId: { name: string } };
  volunteerId: { _id: string; fullName: string } | string | null;
  type: 'pre' | 'post';
  originalText: string;
  aiResult: Structured | null;
  aiModel: string;
  aiError: string;
  validated: Structured | null;
  status: 'draft' | 'validated';
  createdAt: string;
  validatedAt: string | null;
  event?: { id: string; date: string; venueName: string; congregationName: string; tasks: { label: string }[] };
}
export interface Proposal {
  _id: string;
  programName: string;
  venueName: string;
  venueId: string | null;
  congregationName: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  tasks: {
    _id: string;
    label: string;
    category: string;
    description: string;
    catalogRef: string;
    catalogEntryId: string | null;
    catalogProposalId: string | null;
  }[];
  responsible: {
    name: string;
    phone: string | null;
    role: string;
    contactId: string | null;
    matchStatus: 'matched' | 'new' | 'ambiguous' | 'missing';
    candidates: { contactId: string; fullName: string; score: number }[];
  };
  sources: { documentId: string; documentName: string; page?: number; sheet?: string; row?: number; cell?: string }[];
  confidence: number;
  missing: string[];
  warnings: string[];
  duplicateOfEventId: string | null;
  updateOfEventId: string | null;
  decision: 'pending' | 'accepted' | 'rejected';
  createdEventId: string | null;
}
export interface CatalogProposal {
  _id: string;
  title: string;
  category: string;
  pages: number[];
  frequency: string;
  materials: string[];
  ppe: string[];
  products: string[];
  steps: string[];
  decision: 'pending' | 'accepted' | 'rejected';
  existingEntryId: string | null;
}
export interface Extraction {
  _id: string;
  version: number;
  status: 'ready' | 'validated' | 'superseded';
  documents: { documentId: string; kind: string; method: string; summary: string }[];
  proposals: Proposal[];
  catalogProposals: CatalogProposal[];
  warnings: string[];
  model: string;
  validation?: {
    running: boolean;
    total: number;
    done: number;
    finishedAt: string | null;
    results: { proposalId: string; ok: boolean; error?: string }[] | null;
    error: string;
  };
}
export interface SourceDoc {
  _id: string;
  originalName: string;
  format: string;
  kind: string;
  status: string;
  size: number;
  pageCount?: number;
  error?: string;
}
export interface ImportBatch {
  _id: string;
  status: string;
  documentIds: SourceDoc[];
  progress: { step: string; percent: number };
  error: string;
  createdAt: string;
  extraction?: Extraction | null;
}
export interface Question {
  _id?: string;
  label: string;
  description?: string;
  type: string;
  required?: boolean;
  order: number;
  category?: string;
  taskCategory?: string;
  perTask?: boolean;
  reportField?: string;
  options?: string[];
  active?: boolean;
}
export interface Questionnaire {
  _id: string;
  name: string;
  kind: 'pre' | 'post';
  questions: Question[];
}
export interface Settings {
  timezone: string;
  preCallDaysBefore: number;
  preCallTime: string;
  postCallMode: 'next_morning' | 'same_evening';
  postCallNextMorningTime: string;
  postCallSameEveningTime: string;
  workloadWindowMonths: number;
  messageTemplates: { pre: string; post: string };
  ai: { model: string; enabled: boolean; autoAnalyzeReplies?: boolean };
  dataRetentionMonths: number;
  reportFields: { key: string; label: string }[];
  defaults: { pre: string; post: string };
  integrations: { ai: { configured: boolean; model: string }; storage: { driver: string; acl?: string; configured: boolean } };
}
export interface ReportTemplate {
  _id: string;
  name: string;
  active: boolean;
  analysis: {
    questions: { columnIndex: number; header: string; question: string }[];
    tables: { index: number; columnCount: number; rows: { index: number; cells: string[] }[] }[];
    page: { orientation: string };
    fonts: string[];
  } | null;
  mapping: {
    rowMode: 'per_event' | 'per_task' | 'per_venue';
    columns: { index: number; header: string; sources: string[] }[];
    titleTemplate: string;
    emptyValue: string;
  };
  mappingConfirmedAt: string | null;
}
export interface MonthPreview {
  year: number;
  month: number;
  monthLabel: string;
  template: { _id: string; name: string; mappingConfirmedAt: string | null } | null;
  totalEvents: number;
  included: { eventId: string; date: string; venueName: string; congregationName: string; tasks: string[] }[];
  venues: string[];
  questionnairesCompleted: number;
  missingAnswers: { eventId: string; venueName: string; congregationName: string; date: string; question: string; status: string }[];
  expensesMissing: { eventId: string; date: string; venueName: string; congregationName: string }[];
  withoutReport: { eventId: string; date: string; venueName: string; congregationName: string; past: boolean }[];
  preCallsWithoutResponse: number;
  inconsistencies: string[];
  complete: boolean;
}
export interface MonthlyReport {
  _id: string;
  year: number;
  month: number;
  fileName: string;
  rowsWritten: number;
  warnings: string[];
  preservationNotes: string[];
  acknowledgedIncomplete: boolean;
  createdAt: string;
}
export interface Dashboard {
  upcoming: {
    _id: string;
    date: string;
    plannedDay?: string | null;
    congregationName: string;
    venueId: { _id: string; name: string };
    tasks: { label: string }[];
  }[];
  counts: {
    venues: number;
    scheduledEvents: number;
    preCallsToSend: number;
    postCallsToOrganize: number;
    documentsToReview: number;
    responsesToValidate: number;
    awaitingResponse: number;
    unassignedMissions: number;
  };
  previousMonthReport: { year: number; month: number; complete: boolean; withoutReport: number; missingAnswers: number };
  notificationsEnabled: boolean;
}
