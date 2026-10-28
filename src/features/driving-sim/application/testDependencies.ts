/**
 * In-memory stand-ins for the per-competency course's repositories, for tests
 * that provide Driving Sim's dependencies themselves.
 */
import type { AssessmentRepository, AssessmentSitting, BackgroundFormRepository, CompetencyCourseRepository, CourseLogEntry } from './ports';
import type { BackgroundResponse } from '@/domain/study/backgroundForm';
import type { CourseCursor } from '@/domain/competencyRouting/course';
import { applyQOperations } from '@/domain/competencyRouting/course';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import { provideDrivingSimDependencies } from './dependencies';

export interface MemoryCourseStore {
  cursors: Map<string, CourseCursor>;
  table: QTable;
  logs: CourseLogEntry[];
  sittings: Map<string, AssessmentSitting[]>;
  backgrounds: Map<string, BackgroundResponse>;
}

export const memoryCourseStore = (): MemoryCourseStore => ({
  cursors: new Map(),
  table: emptyQTable(),
  logs: [],
  sittings: new Map(),
  backgrounds: new Map(),
});

export const memoryCompetencyCourse = (store: MemoryCourseStore): CompetencyCourseRepository => ({
  loadCursor: async uid => store.cursors.get(uid) ?? null,
  saveCursor: async (uid, cursor) => void store.cursors.set(uid, structuredClone(cursor)),
  loadQTable: async () => structuredClone(store.table),
  applyQOperations: async operations => {
    store.table = applyQOperations(store.table, operations);
    return structuredClone(store.table);
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
    ...(options.backgroundFormEnabled !== undefined ? { backgroundFormEnabled: options.backgroundFormEnabled } : {}),
  });
