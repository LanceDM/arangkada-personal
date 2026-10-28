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
  SurveyRepository,
} from './ports';
import type { BackgroundResponse } from '@/domain/study/backgroundForm';
import type { CourseCursor } from '@/domain/competencyRouting/course';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import type { StudyEvent } from '@/domain/study/studyEvent';
import type { BKTProfileDoc, BKTUpdateRecord } from '@/domain/study/bktLog';
import { applyQLog, type QLogEntry } from '@/domain/study/qLog';
import type { SurveyResponse } from '@/domain/study/survey';
import { provideDrivingSimDependencies } from './dependencies';

export interface MemoryCourseStore {
  cursors: Map<string, CourseCursor>;
  table: QTable;
  /** The shared table's update log, in `globalSeq` order. */
  qUpdates: QLogEntry[];
  logs: CourseLogEntry[];
  sittings: Map<string, AssessmentSitting[]>;
  backgrounds: Map<string, BackgroundResponse>;
  events: Map<string, StudyEvent[]>;
  bktProfiles: Map<string, BKTProfileDoc>;
  bktUpdates: Map<string, BKTUpdateRecord[]>;
  surveys: Map<string, SurveyResponse>;
}

export const memoryCourseStore = (): MemoryCourseStore => ({
  cursors: new Map(),
  table: emptyQTable(),
  qUpdates: [],
  logs: [],
  sittings: new Map(),
  backgrounds: new Map(),
  events: new Map(),
  bktProfiles: new Map(),
  bktUpdates: new Map(),
  surveys: new Map(),
});

export const memoryCompetencyCourse = (store: MemoryCourseStore): CompetencyCourseRepository => ({
  loadCursor: async uid => store.cursors.get(uid) ?? null,
  saveCursor: async (uid, cursor) => void store.cursors.set(uid, structuredClone(cursor)),
  loadQTable: async () => structuredClone(store.table),
  applyQLog: async ({ items, context, envelope }) => {
    const applied = applyQLog({ table: store.table, items, firstGlobalSeq: store.qUpdates.length + 1, context, envelope });
    store.table = applied.table;
    store.qUpdates.push(...applied.entries);
    return structuredClone(applied);
  },
  appendLog: async (_uid, entry) => void store.logs.push(entry),
});

export const memoryAssessments = (store: MemoryCourseStore): AssessmentRepository => ({
  load: async uid => [...(store.sittings.get(uid) ?? [])],
  save: async (uid, sitting) => void store.sittings.set(uid, [...(store.sittings.get(uid) ?? []), sitting]),
});

export const memoryBackground = (store: MemoryCourseStore): BackgroundFormRepository => ({
  load: async uid => store.backgrounds.get(uid) ?? null,
  save: async (uid, response) => void store.backgrounds.set(uid, structuredClone(response)),
});

/** The event stream, the BKT log and the surveys, in memory. */
export const memoryStudyLogs = (
  store: MemoryCourseStore
): { studyEvents: StudyEventRepository; bktLog: BKTLogRepository; surveys: SurveyRepository } => ({
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
  surveys: {
    load: async (uid, instrument) => structuredClone(store.surveys.get(`${uid}/${instrument}`) ?? null),
    save: async (uid, response) => void store.surveys.set(`${uid}/${response.instrument}`, structuredClone(response)),
  },
});

/**
 * Binds every Driving Sim port to in-memory stand-ins: no Firebase, nothing
 * persisted. For tests that click through the course from outside the feature.
 */
export const provideInMemoryDrivingSim = (store: MemoryCourseStore, options: { backgroundFormEnabled?: boolean } = {}) =>
  provideDrivingSimDependencies({
    learnerHistory: { load: async () => ({ source: 'firestore', attempts: [] }) },
    storyAttempts: {
      save: async () => 'attempt',
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
