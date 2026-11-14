import type { SiteStatus } from '@/features/admin/domain/siteStatus';
import type { BktSetsData, SavedValueSet, StartEditRecord } from '@/features/admin/domain/bktSetsAdmin';
import type { CalibrationRecord, PilotRef } from '@/features/admin/domain/bktCalibration';
/**
 * What Admin needs from the outside world, stated as an interface.
 *
 * One port rather than four: the report is a single cross-user read, and every
 * screen wants all of it at once. The Firestore implementation is bound by this
 * feature's `composition.ts`.
 */
import type {
  AttemptRow,
  BackgroundRow,
  ConfigVersionRow,
  CourseLogRow,
  LiveQTable,
  ParticipantRow,
  QUpdateRow,
  RoleGrantRow,
  DailyRow,
  ExamRow,
  SharedQTableRow,
  SittingRow,
  UserRow,
} from '@/features/admin/domain/adminReport';

export interface AdminReportRepository {
  users(): Promise<UserRow[]>;
  attempts(): Promise<AttemptRow[]>;
  examResults(): Promise<ExamRow[]>;
  dailyResults(): Promise<DailyRow[]>;
  /** The per-competency course: every participant's log, sittings and background form, and the shared table. */
  courseLogs(): Promise<CourseLogRow[]>;
  sittings(): Promise<SittingRow[]>;
  backgrounds(): Promise<BackgroundRow[]>;
  sharedQTable(): Promise<SharedQTableRow | null>;
}

/**
 * The people, roles and settings records. Two implementations: Firestore
 * collections (A) and SQL Connect tables (B), picked by the composition root.
 */
export interface StudyRecordsRepository {
  participants(): Promise<ParticipantRow[]>;
  roleGrants(): Promise<RoleGrantRow[]>;
  configVersions(): Promise<ConfigVersionRow[]>;
}

/** Live reads for the dashboard: each callback runs again whenever the data changes. Returns the unsubscribe. */
export interface LiveQTableRepository {
  watchTable(onChange: (table: LiveQTable | null) => void, onError: (error: Error) => void): () => void;
  watchUpdates(limit: number, onChange: (rows: QUpdateRow[]) => void, onError: (error: Error) => void): () => void;
}

/** The logged study records the export reads (Firestore in both implementations). */
export interface StudyLogRepository {
  /** Every participant's BKT update log entries. */
  bktUpdates(): Promise<Record<string, unknown>[]>;
  /** The shared Q-table's whole update log. */
  qUpdates(): Promise<Record<string, unknown>[]>;
  /** Every participant's event stream. */
  events(): Promise<Record<string, unknown>[]>;
  /** One player's event stream, oldest first. */
  eventsOf(uid: string): Promise<Record<string, unknown>[]>;
}


/** `site/status`: whether the site is open to players. Live for everyone; written by an admin. */
export interface SiteStatusRepository {
  watch(onChange: (status: SiteStatus) => void, onError: (error: Error) => void): () => void;
  set(status: { suspended: boolean; message: string }, uid: string): Promise<void>;
}

/**
 * The BKT value sets and pilot marks (2026-11-13): read together for the
 * admin; a pilot mark changes with its log entry; a calibration is applied in
 * one transaction that saves the set and points new players at it.
 */
export interface BktSetsRepository {
  load(): Promise<BktSetsData>;
  setPilot(player: PilotRef, on: boolean, adminUid: string): Promise<void>;
  /**
   * Saves `record` as Calibration N + 1 and makes it the set new players get.
   * Refused when another calibration was applied since `expectedNumber` was read.
   */
  apply(record: CalibrationRecord, expectedNumber: number, admin: { uid: string; email: string | null }): Promise<SavedValueSet>;
  /**
   * Saves `record` as Edited start N + 1 (`set-N`) and makes it the set new
   * players get. Refused, like `apply`, when another set was saved since.
   */
  editStart(record: StartEditRecord, expectedNumber: number, admin: { uid: string; email: string | null }): Promise<SavedValueSet>;
}
