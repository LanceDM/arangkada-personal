import { describe, expect, it } from 'vitest';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { sameCursor, startingCourse, type CourseCursor } from '@/domain/competencyRouting/course';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import { buildEvidenceBKTProfile } from '@/domain/learner/mastery/evidenceBKT';
import type { EvidenceRecord } from '@/domain/study/evidence';
import { applyQLog, pairQOperations, type QLogEntry } from '@/domain/study/qLog';
import { buildLevelConfig } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { drawCourseQuiz } from '@/features/driving-sim/domain/scenario/courseQuiz';
import type { QuizItemDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import { CourseConflictError } from '../errors';
import type { ActiveActivity, CompetencyCourseRepository, CourseLogEntry, PreTestSeed } from '../ports';
import {
  completeCourseDrive,
  loadCourse,
  loadCourseEvidence,
  markCourseLessonsRead,
  openCourseQuiz,
  planCourseDrive,
  submitCourseQuiz,
  type CourseDeps,
} from './competencyCourse';

/** The store as one transaction would leave it, held in memory. */
const memoryStore = () => {
  let cursor: CourseCursor | null = null;
  let table: QTable = emptyQTable();
  let evidenceSeq = 0;
  const evidence: EvidenceRecord[] = [];
  const qLog: QLogEntry[] = [];
  const courseLog: CourseLogEntry[] = [];
  const activities = new Map<string, ActiveActivity>();
  let seed: PreTestSeed | null = null;

  const repo: CompetencyCourseRepository = {
    loadCursor: async () => (cursor ? structuredClone(cursor) : null),
    loadQTable: async () => structuredClone(table),
    loadEvidence: async () => structuredClone(evidence),
    loadPreTestSeed: async () => seed,
    commitStep: async (_uid, input) => {
      if (cursor && !sameCursor(cursor, input.expected)) throw new CourseConflictError(cursor);
      if (!cursor && !sameCursor(startingCourse(), input.expected)) throw new CourseConflictError(null);
      const step = input.compute(structuredClone(table));
      const applied = applyQLog({
        table,
        items: pairQOperations(step.operations, step.decisions, step.rewards),
        firstGlobalSeq: qLog.length + 1,
        context: input.context,
        envelope: input.envelope,
      });
      let seq: number | null = null;
      if (input.evidence) {
        seq = ++evidenceSeq;
        const e = input.evidence;
        evidence.push(
          e.kind === 'attempt'
            ? { kind: 'attempt', levelId: e.attempt.levelId, attempt: null, evidenceSeq: seq, timestamp: e.attempt.timestamp, logs: e.attempt.logs, ref: e.id }
            : { kind: 'quiz', levelId: e.sitting.levelId, attempt: e.sitting.attempt, evidenceSeq: seq, timestamp: e.sitting.timestamp, logs: e.sitting.answers, ref: e.id }
        );
      }
      table = applied.table;
      qLog.push(...applied.entries);
      if (step.log) courseLog.push({ ...step.log, decisions: step.decisions, rewards: step.rewards, tableAfter: table });
      cursor = structuredClone(step.cursor);
      return { step, entries: applied.entries, table, evidenceSeq: seq };
    },
    openActivity: async (_uid, fresh) => {
      const open = activities.get(fresh.position);
      const next = open ? { ...open, opens: open.opens + 1 } : { ...fresh, opens: 1 };
      activities.set(fresh.position, next);
      return next;
    },
  };
  return {
    repo,
    evidence,
    qLog,
    courseLog,
    table: () => table,
    setSeed: (s: PreTestSeed) => { seed = s; },
  };
};

const item = (moduleId: string, competency: DrivingCompetency, n: number): QuizItemDoc => ({
  schemaVersion: 1, id: `${competency}-${n}`, revision: 1, createdAt: 0, updatedAt: 0, updatedBy: 'admin',
  moduleId, question: `Q ${n}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: '', image: '',
  competency, source: 'module', use: 'quiz', isActive: true, order: n,
});

const LEVEL1 = buildLevelConfig(1)!;
const bankItems = (['driver_legality', 'document_awareness'] as const).flatMap(c => [1, 2, 3, 4, 5].map(n => item(LEVEL1.moduleId, c, n)));

const setup = () => {
  const store = memoryStore();
  let t = 1000;
  let s = 7;
  const deps: CourseDeps = {
    course: store.repo,
    quizBank: { load: async () => ({ items: bankItems, settings: null }) },
    participantCode: 'P-0001',
    table: 'study',
    now: () => (t += 10),
    random: () => 0.01,
    newSeed: () => s++,
  };
  return { store, deps };
};

const resultFor = (levelId: number, logs: ActionLog[]): LevelResult => ({
  levelId, score: 0, stars: 0, completed: true, violations: 0, correctActions: logs.length, logs,
});

/** Plays the tutorial and Level 1's quiz with every answer right: the cursor at DRIVE(1). */
const toLevel1Drive = async ({ store, deps }: ReturnType<typeof setup>) => {
  let cursor = await markCourseLessonsRead(deps, 'u', await loadCourse(deps, 'u'));
  const tutorial = await planCourseDrive(deps, 'u', cursor);
  cursor = (await completeCourseDrive(deps, 'u', cursor, tutorial, resultFor(0, []))).cursor;
  cursor = await markCourseLessonsRead(deps, 'u', cursor);
  const quiz = await openCourseQuiz(deps, 'u', cursor, LEVEL1);
  cursor = (await submitCourseQuiz(deps, 'u', cursor, quiz.items, quiz.items.map(() => 0))).cursor;
  return { cursor, store };
};

describe('the course on its ports', () => {
  it('plays the tutorial, then gates Level 1 on its quiz, saving the quiz as evidence', async () => {
    const ctx = setup();
    const { cursor, store } = await toLevel1Drive(ctx);
    expect(cursor.phase).toEqual({ kind: 'DRIVE', level: 1 });
    expect(store.evidence.map(e => e.kind)).toEqual(['attempt', 'quiz']);
    expect(store.evidence[1].logs.every(log => log.source === 'quiz')).toBe(true);
  });

  it('asks 3 items per competency, and the same ones again on a reload', async () => {
    const { deps } = setup();
    let cursor = await markCourseLessonsRead(deps, 'u', await loadCourse(deps, 'u'));
    const tutorial = await planCourseDrive(deps, 'u', cursor);
    cursor = (await completeCourseDrive(deps, 'u', cursor, tutorial, resultFor(0, []))).cursor;
    cursor = await markCourseLessonsRead(deps, 'u', cursor);
    const first = await openCourseQuiz(deps, 'u', cursor, LEVEL1);
    const again = await openCourseQuiz(deps, 'u', cursor, LEVEL1);
    expect(first.items).toHaveLength(6);
    expect(again.items.map(i => i.id)).toEqual(first.items.map(i => i.id));
  });

  it('decides per competency after a drive, on the shared table, and logs every change', async () => {
    const ctx = setup();
    const { cursor } = await toLevel1Drive(ctx);
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const logs: ActionLog[] = run.composed!.items.map((it, i) => ({
      timestamp: 5000 + i, action: 'stop', result: 'correct', points: 10, competency: it.competency, scenarioId: it.scenarioId,
    }));
    const settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, resultFor(1, logs));
    expect(settled.verdicts.map(v => [v.competency, v.passed])).toEqual(
      expect.arrayContaining([['driver_legality', true], ['document_awareness', true]])
    );
    const visits = ctx.store.qLog.filter(e => e.kind === 'visit');
    expect(visits).toHaveLength(2);
    expect(visits.every(e => e.participantCode === 'P-0001')).toBe(true);
    expect(ctx.store.courseLog.at(-1)?.kind).toBe('drive');
  });

  it('refuses a step from a tab whose course has moved on', async () => {
    const { deps } = setup();
    const start = await loadCourse(deps, 'u');
    await markCourseLessonsRead(deps, 'u', start);
    await expect(markCourseLessonsRead(deps, 'u', start)).rejects.toBeInstanceOf(CourseConflictError);
  });

  it('seeds BKT from the pre-test, with no learning step, before every other answer', async () => {
    const { store, deps } = setup();
    expect(buildEvidenceBKTProfile(await loadCourseEvidence(deps, 'u')).parking).toBe(0.3);
    store.setSeed({ schemaVersion: 1, counts: { parking: { correct: 5, total: 5 } }, timestamp: 0 });
    const logs = await loadCourseEvidence(deps, 'u');
    expect(logs).toHaveLength(5);
    expect(logs.every(log => log.source === 'pre_test')).toBe(true);
    expect(buildEvidenceBKTProfile(logs).parking).toBeGreaterThan(0.95);
  });
});

describe('the course quiz draw', () => {
  const bank = [1, 2, 3, 4].map(n => item('m', 'parking', n));

  it('asks unseen items first, then the least recently seen', () => {
    const drawn = drawCourseQuiz(bank, ['parking'], ['parking-1', 'parking-2'], () => 0.5);
    expect(drawn.items.map(i => i.id).slice(0, 2).sort()).toEqual(['parking-3', 'parking-4']);
    expect(drawn.items[2].id).toBe('parking-1');
  });

  it('reports a competency the bank cannot give 3 items, and never serves a test or switched-off item', () => {
    const thin = [item('m', 'parking', 1), { ...item('m', 'parking', 2), use: 'test' as const }, { ...item('m', 'parking', 3), isActive: false }];
    const drawn = drawCourseQuiz(thin, ['parking'], [], () => 0.5);
    expect(drawn.items.map(i => i.id)).toEqual(['parking-1']);
    expect(drawn.shortfall).toEqual({ parking: 2 });
  });
});
