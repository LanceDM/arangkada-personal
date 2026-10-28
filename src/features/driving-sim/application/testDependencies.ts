/**
 * In-memory stand-ins for the per-competency course's repositories, for tests
 * that provide Driving Sim's dependencies themselves.
 */
import type { AssessmentRepository, AssessmentSitting, CompetencyCourseRepository, CourseLogEntry } from './ports';
import type { CourseCursor } from '@/domain/competencyRouting/course';
import { applyQOperations } from '@/domain/competencyRouting/course';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';

export interface MemoryCourseStore {
  cursors: Map<string, CourseCursor>;
  table: QTable;
  logs: CourseLogEntry[];
  sittings: Map<string, AssessmentSitting[]>;
}

export const memoryCourseStore = (): MemoryCourseStore => ({
  cursors: new Map(),
  table: emptyQTable(),
  logs: [],
  sittings: new Map(),
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
