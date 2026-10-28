/**
 * In-memory stand-ins for the per-competency course's repositories, for tests
 * that provide Driving Sim's dependencies themselves.
 */
import type {
  AssessmentRepository,
  AssessmentSitting,
  BackgroundFormRepository,
  BKTLogRepository,
  CompetencyCourseRepository,
  CourseLogEntry,
  StudyEventRepository,
} from './ports';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import type { BackgroundResponse } from '@/domain/study/backgroundForm';
import type { CourseCursor } from '@/domain/competencyRouting/course';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import type { StudyEvent } from '@/domain/study/studyEvent';
import type { BKTProfileDoc, BKTUpdateRecord } from '@/domain/study/bktLog';
import { applyQLog, pairQOperations, type QLogEntry } from '@/domain/study/qLog';
import { sameCursor } from '@/domain/competencyRouting/course';
import { CourseConflictError } from './errors';
import { provideDrivingSimDependencies } from './dependencies';

export interface MemoryCourseStore {
  cursors: Map<string, CourseCursor>;
  table: QTable;
  /** The shared table's update log, in `globalSeq` order. */
  qUpdates: QLogEntry[];
  /** Every participant's course log entries, with whose they are. */
  logs: (CourseLogEntry & { uid: string })[];
  /** Every participant's saved drives. */
  attempts: Map<string, LevelAttempt[]>;
  sittings: Map<string, AssessmentSitting[]>;
  backgrounds: Map<string, BackgroundResponse>;
  events: Map<string, StudyEvent[]>;
  bktProfiles: Map<string, BKTProfileDoc>;
  bktUpdates: Map<string, BKTUpdateRecord[]>;
  /** Runs between computing a step and committing it: lets a test interleave another participant. */
  beforeCommit?: (uid: string, attempt: number) => Promise<void>;
  /** How many steps had to be recomputed because the table moved under them. */
  retries: number;
}

export const memoryCourseStore = (): MemoryCourseStore => ({
  cursors: new Map(),
  table: emptyQTable(),
  qUpdates: [],
  logs: [],
  attempts: new Map(),
  sittings: new Map(),
  backgrounds: new Map(),
  events: new Map(),
  bktProfiles: new Map(),
  bktUpdates: new Map(),
  retries: 0,
});

export const memoryCompetencyCourse = (store: MemoryCourseStore): CompetencyCourseRepository => ({
  loadCursor: async uid => structuredClone(store.cursors.get(uid) ?? null),
  loadQTable: async () => structuredClone(store.table),
  /**
   * The same contract as the Firestore transaction, optimistic like it: the
   * step is computed on a snapshot, then committed only if the table has not
   * moved meanwhile, otherwise computed again. `store.beforeCommit`, when set,
   * runs between the two, so a test can let another participant's step land
   * in that gap.
   */
  commitStep: async (uid, { expected, compute, context, envelope }) => {
    for (let attempt = 1; attempt <= 12; attempt++) {
      const stored = store.cursors.get(uid) ?? null;
      if (stored && !sameCursor(stored, JSON.parse(JSON.stringify(expected)))) throw new CourseConflictError(structuredClone(stored));
      const snapshot = store.table;
      const seen = store.qUpdates.length;
      const step = compute(structuredClone(snapshot));
      const items = pairQOperations(step.operations, step.decisions, step.rewards);
      const applied = items.length > 0
        ? applyQLog({ table: snapshot, items, firstGlobalSeq: seen + 1, context, envelope })
        : { table: snapshot, entries: [] };
      await store.beforeCommit?.(uid, attempt);
      if (store.table !== snapshot || store.qUpdates.length !== seen) {
        store.retries += 1;
        continue;
      }
      store.table = applied.table;
      store.qUpdates.push(...applied.entries);
      if (step.log) store.logs.push(structuredClone({ ...step.log, uid, decisions: step.decisions, rewards: step.rewards, tableAfter: applied.table }));
      store.cursors.set(uid, structuredClone(step.cursor));
      return structuredClone({ step, entries: applied.entries, table: applied.table });
    }
    throw new Error('The shared table kept changing: gave up after 12 attempts.');
  },
});

export const memoryAssessments = (store: MemoryCourseStore): AssessmentRepository => ({
  load: async uid => [...(store.sittings.get(uid) ?? [])],
  save: async (uid, sitting) => void store.sittings.set(uid, [...(store.sittings.get(uid) ?? []), sitting]),
});

export const memoryBackground = (store: MemoryCourseStore): BackgroundFormRepository => ({
  load: async uid => store.backgrounds.get(uid) ?? null,
  save: async (uid, response) => void store.backgrounds.set(uid, structuredClone(response)),
});

/** The event stream and the BKT log, in memory. */
export const memoryStudyLogs = (
  store: MemoryCourseStore
): { studyEvents: StudyEventRepository; bktLog: BKTLogRepository } => ({
  studyEvents: {
    append: async (uid, events) => {
      const mine = store.events.get(uid) ?? [];
      const next = mine.length + 1;
      store.events.set(uid, [...mine, ...events.map((event, i) => ({ ...structuredClone(event), seq: next + i }))]);
    },
  },
  bktLog: {
    loadProfile: async uid => structuredClone(store.bktProfiles.get(uid) ?? null),
    record: async (uid, profile, entries) => {
      store.bktUpdates.set(uid, [...(store.bktUpdates.get(uid) ?? []), ...structuredClone(entries)]);
      store.bktProfiles.set(uid, structuredClone(profile));
    },
  },
});

/**
 * Binds every Driving Sim port to in-memory stand-ins: no Firebase, nothing
 * persisted. For tests that click through the course from outside the feature.
 */
export const provideInMemoryDrivingSim = (store: MemoryCourseStore, options: { backgroundFormEnabled?: boolean } = {}) =>
  provideDrivingSimDependencies({
    learnerHistory: {
      load: async uid => ({
        source: 'firestore',
        attempts: (store.attempts.get(uid ?? '') ?? []).map(a => ({ levelId: a.levelId, timestamp: a.timestamp, logs: a.logs })),
      }),
    },
    storyAttempts: {
      save: async (uid, attempt) => {
        const mine = [...(store.attempts.get(uid) ?? []), structuredClone(attempt)];
        store.attempts.set(uid, mine);
        return `${uid}-attempt-${mine.length}`;
      },
      saveFsmTelemetry: async () => {},
      saveDecisionTelemetry: async () => {},
      saveRoutingTelemetry: async () => {},
    },
    signCoverage: { load: () => ({}), record: () => {} },
    briefingProgress: { load: () => ({}), save: () => {}, markLessonsRead: () => {} },
    routingMode: 'new',
    routing: { loadAssignment: async () => null, loadCursor: async () => null, saveCursor: async () => {} },
    routingOverride: { load: () => 'assigned', save: () => {} },
    optimizedRouting: async () => {
      throw new Error('the course reads no designated table');
    },
    competencyCourse: memoryCompetencyCourse(store),
    assessments: memoryAssessments(store),
    background: memoryBackground(store),
    ...memoryStudyLogs(store),
    ...(options.backgroundFormEnabled !== undefined ? { backgroundFormEnabled: options.backgroundFormEnabled } : {}),
  });
