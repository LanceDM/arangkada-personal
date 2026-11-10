/**
 * What the Pilot page and the dashboard's records need from the outside world.
 * Kept apart from the report's port, whose row types read Driving Sim's public
 * API, so these adapters depend on nothing but this feature's own pilot domain.
 */
import type { StudyCohort } from '@/domain/study/participantCode';
import type { PilotAccountProgress } from '@/features/admin/domain/pilotProgress';

/**
 * The study's registry of enrolled participants, followed live.
 * Progress only: nothing it hands over carries a score.
 */
export interface PilotPoolRepository {
  /** Calls back with every enrolled participant whenever any of them changes. Returns an unsubscribe. */
  watch(onChange: (accounts: PilotAccountProgress[]) => void, onError: (message: string) => void): () => void;
}

/** An invite, as the admin's Invites panel lists it (`study_invites/{code}`). */
export interface InviteEntry {
  code: string;
  cohort: StudyCohort;
  open: boolean;
  createdAt: number;
  closedAt: number | null;
}

/** The study's invites: followed live, created open, closed once. */
export interface StudyInvitesRepository {
  watch(onChange: (invites: InviteEntry[]) => void, onError: (message: string) => void): () => void;
  /** Creates an open invite for the cohort under a fresh random code, and returns the code. */
  create(cohort: StudyCohort): Promise<string>;
  close(code: string): Promise<void>;
}

/** A registry entry, as the records reader names its account. */
export interface PoolAccountEntry {
  code: string;
  cohort: StudyCohort;
  uid: string;
}

/** A saved attempt as read: its document, unchecked, and when it was saved. */
export interface AttemptDocument {
  id: string;
  savedAt: number;
  data: unknown;
}

/** The three records beside an attempt, as read: each null where it does not exist. */
export interface AttemptRecordDocuments {
  fsm: unknown;
  decisions: unknown;
  routing: unknown;
}

/**
 * The pilot's stored records, read for the dashboard: the same documents the
 * pilot's export reads for each account, and nothing is written. Kept as
 * document data, unchecked, so that this port and its adapter depend on no
 * other feature; the definitions that read them are handed to the store.
 */
export interface PilotRecordsRepository {
  /** Every entry of the study's registry. */
  pool(): Promise<PoolAccountEntry[]>;
  /** The account's `routing/assignment` and `routing/cursor` as stored; null where absent. */
  routing(uid: string): Promise<{ assignment: unknown; cursor: unknown }>;
  /** The attempts saved at or after `from` (every attempt when null), oldest first. */
  attemptsFrom(uid: string, from: number | null): Promise<AttemptDocument[]>;
  /** The records beside one attempt. */
  attemptRecords(uid: string, attemptId: string): Promise<AttemptRecordDocuments>;
  /**
   * One attempt's whole FSM record, read again for the Replay of that attempt
   * alone: the store keeps only its start. Null where it does not exist.
   */
  fsmLog(uid: string, attemptId: string): Promise<unknown>;
  /** When each Mock Exam sitting and Daily Challenge answer was saved: read only to flag their use during play. */
  otherModes(uid: string): Promise<{ examSittings: Array<{ timestamp: number }>; dailyAnswers: Array<{ timestamp: number }> }>;
}
