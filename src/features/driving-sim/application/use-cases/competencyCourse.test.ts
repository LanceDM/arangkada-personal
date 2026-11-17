import { describe, expect, it } from 'vitest';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { sameCursor, startingCourse, type CourseCursor, type PendingDecision } from '@/domain/competencyRouting/course';
import { COMPETENCIES } from '@/domain/learner/profile';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import { buildEvidenceBKTProfile } from '@/domain/learner/mastery/evidenceBKT';
import type { EvidenceRecord } from '@/domain/study/evidence';
import { applyQLog, learningItems, type QLogEntry } from '@/domain/study/qLog';
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
        items: learningItems(input.teachesTable, step.operations, step.decisions, step.rewards),
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
      if (step.log) courseLog.push({ ...step.log, decisions: step.decisions, rewards: step.rewards, tableAfter: table, ...(input.teachesTable ? {} : { teachesTable: false as const }) });
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
    setCursor: (c: CourseCursor) => { cursor = structuredClone(c); },
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

  it("lets an admin's course decide from the shared table and change nothing in it", async () => {
    const ctx = setup();
    ctx.deps.teachesTable = false;
    const { cursor } = await toLevel1Drive(ctx);
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const logs: ActionLog[] = run.composed!.items.map((it, i) => ({
      timestamp: 5000 + i, action: 'stop', result: 'correct', points: 10, competency: it.competency, scenarioId: it.scenarioId,
    }));
    await completeCourseDrive(ctx.deps, 'u', cursor, run, resultFor(1, logs));
    expect(ctx.store.qLog).toEqual([]);
    expect(ctx.store.table()).toEqual(emptyQTable());
    const entry = ctx.store.courseLog.at(-1)!;
    expect(entry.kind).toBe('drive');
    expect(entry.decisions.length).toBeGreaterThan(0);
    expect(entry.teachesTable).toBe(false);
  });

  it('refuses a step from a tab whose course has moved on', async () => {
    const { deps } = setup();
    const start = await loadCourse(deps, 'u');
    await markCourseLessonsRead(deps, 'u', start);
    await expect(markCourseLessonsRead(deps, 'u', start)).rejects.toBeInstanceOf(CourseConflictError);
  });

  it('seeds BKT from the pre-test, with no learning step, before every other answer', async () => {
    const { store, deps } = setup();
    expect(buildEvidenceBKTProfile(await loadCourseEvidence(deps, 'u')).parking).toBe(0.5);
    store.setSeed({ schemaVersion: 1, counts: { parking: { correct: 5, total: 5 } }, timestamp: 0 });
    const logs = await loadCourseEvidence(deps, 'u');
    expect(logs).toHaveLength(5);
    expect(logs.every(log => log.source === 'pre_test')).toBe(true);
    expect(buildEvidenceBKTProfile(logs).parking).toBeGreaterThan(0.95);
  });
});

/** Every counted scenario answered, right or wrong as `right` says. */
const answered = (run: Awaited<ReturnType<typeof planCourseDrive>>, right: (index: number) => boolean): ActionLog[] =>
  run.composed!.items.map((it, i) => ({
    timestamp: 5000 + i, action: 'x', result: right(i) ? 'correct' : 'violation', points: 0, competency: it.competency, scenarioId: it.scenarioId,
  }));

describe('the verdict is the course rule, never the points total', () => {
  it('passes every topic answered 3 of 3, though the score is under the old points pass mark', async () => {
    const ctx = setup();
    const { cursor } = await toLevel1Drive(ctx);
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, { ...resultFor(1, answered(run, () => true)), completed: false });
    expect(settled.verdicts.every(v => v.correct === 3 && v.passed)).toBe(true);
    expect(settled.passed).toBe(true);
    expect(ctx.store.courseLog.at(-1)?.verdicts.every(v => v.passed)).toBe(true);
  });

  it.each([
    ['a crash', { crashReason: 'Hit a parked car' }],
    ['a timeout', { timedOut: true as const }],
  ])('passes no topic on a drive that ended in %s', async (_, ending) => {
    const ctx = setup();
    const { cursor } = await toLevel1Drive(ctx);
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const result = { ...resultFor(1, answered(run, () => true)), completed: false, ...ending };
    const settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, result);
    expect(settled.verdicts.some(v => v.passed)).toBe(false);
    expect(settled.passed).toBe(false);
  });

  it('never reads a topic closed by the attempt cap as passed', async () => {
    const ctx = setup();
    let { cursor } = await toLevel1Drive(ctx);
    let settled;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const run = await planCourseDrive(ctx.deps, 'u', cursor);
      settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, resultFor(1, answered(run, () => false)));
      cursor = settled.cursor;
    }
    expect(ctx.store.courseLog.at(-1)?.endReason).toBe('cap_reached');
    expect(settled!.verdicts.some(v => v.passed)).toBe(false);
    expect(settled!.passed).toBe(false);
  });
});

describe('the final exam', () => {
  const atFinal = () => {
    const ctx = setup();
    ctx.store.setCursor({ ...startingCourse(), phase: { kind: 'FINAL' } });
    return ctx;
  };

  it('certifies at 70% of its scenarios right, though wrong answers took the points under the pass mark', async () => {
    const ctx = atFinal();
    const cursor = await loadCourse(ctx.deps, 'u');
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const n = run.composed!.items.length;
    const needed = Math.ceil(n * 0.7);
    const settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, { ...resultFor(12, answered(run, i => i < needed)), completed: false });
    expect(settled.cursor.phase).toEqual({ kind: 'CERTIFIED' });
    expect(settled.passed).toBe(true);
    // Episodes still open at the end close unrewarded, and the final's log names them.
    const entry = ctx.store.courseLog.at(-1)!;
    expect(entry.endReason).toBe('certified');
    expect(entry.unrewarded).toEqual(settled.cursor.pending.map(p => p.id));
  });

  it('fails one right answer short of 70%, or on a crash', async () => {
    for (const [right, ending] of [[-1, {}], [0, { crashReason: 'Hit a parked car' }]] as const) {
      const ctx = atFinal();
      const cursor = await loadCourse(ctx.deps, 'u');
      const run = await planCourseDrive(ctx.deps, 'u', cursor);
      const needed = Math.ceil(run.composed!.items.length * 0.7) + right;
      const result = { ...resultFor(12, answered(run, i => i < needed)), completed: true, ...ending };
      const settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, result);
      expect(settled.cursor.phase).toEqual({ kind: 'FINAL' });
      expect(settled.passed).toBe(false);
    }
  });
});

/** A practice decision from Level 5 on every competency, waiting for its next measurement. */
const waitingFromLevel5 = (): PendingDecision[] =>
  COMPETENCIES.map((competency, i) => ({
    id: `5:${competency}:${i}`, competency, levelId: 5, state: { mastery: 1, result: 'failed' }, action: 'practice',
    addedDecisions: 3, decidedAt: 0, awaitsOutcome: true,
  }));

describe('a drive that ended early rewards only the topics it asked (team decision, pending the adviser)', () => {
  it('a crashed final rewards the answered topics; the rest stay open and settle once, at the next sitting', async () => {
    const ctx = setup();
    ctx.store.setCursor({ ...startingCourse(), phase: { kind: 'FINAL' }, pending: waitingFromLevel5() });
    let cursor = await loadCourse(ctx.deps, 'u');
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const asked = run.composed!.items.slice(0, 3);
    const logs: ActionLog[] = asked.map((it, i) => ({
      timestamp: 5000 + i, action: 'x', result: 'correct', points: 0, competency: it.competency, scenarioId: it.scenarioId,
    }));
    const crashed = await completeCourseDrive(ctx.deps, 'u', cursor, run, { ...resultFor(12, logs), completed: false, crashReason: 'Hit an ambulance' });
    const askedTopics = asked.map(it => it.competency).sort();
    const first = ctx.store.courseLog.at(-1)!.rewards;
    expect(first.map(r => r.competency).sort()).toEqual(askedTopics);
    expect(first.every(r => r.kind === 'terminal')).toBe(true);
    expect(crashed.cursor.pending.map(p => p.competency).sort()).toEqual(COMPETENCIES.filter(c => !askedTopics.includes(c)).sort());
    expect(crashed.cursor.phase).toEqual({ kind: 'FINAL' });

    cursor = crashed.cursor;
    const again = await planCourseDrive(ctx.deps, 'u', cursor);
    const settled = await completeCourseDrive(ctx.deps, 'u', cursor, again, resultFor(12, answered(again, () => true)));
    const second = ctx.store.courseLog.at(-1)!.rewards;
    expect(second.map(r => r.competency).sort()).toEqual(COMPETENCIES.filter(c => !askedTopics.includes(c)).sort());
    expect(settled.cursor.pending).toEqual([]);
    const rewarded = ctx.store.courseLog.flatMap(entry => entry.rewards).map(r => r.decisionId);
    expect(new Set(rewarded).size).toBe(rewarded.length);
    expect(rewarded.sort()).toEqual(waitingFromLevel5().map(p => p.id).sort());
  });

  it('a crashed stage drive decides only on the topics it asked, and the repeat asks the rest', async () => {
    const ctx = setup();
    const { cursor } = await toLevel1Drive(ctx);
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const first = run.composed!.items[0];
    const logs: ActionLog[] = [{ timestamp: 5000, action: 'x', result: 'correct', points: 0, competency: first.competency, scenarioId: first.scenarioId }];
    const settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, { ...resultFor(1, logs), completed: false, crashReason: 'Hit a parked car' });
    expect(ctx.store.courseLog.at(-1)!.decisions.map(d => d.competency)).toEqual([first.competency]);
    expect(settled.cursor.phase).toEqual({ kind: 'REPEAT', level: 1 });
    const unasked = run.composed!.items.map(it => it.competency).find(c => c !== first.competency)!;
    expect(settled.cursor.stage[unasked]).toMatchObject({ attempts: 0, done: false });
  });
});

describe('Level 7 counts every topic it teaches', () => {
  it('gives each topic 3 scenarios on the expressway, grades it and decides on it', async () => {
    const ctx = setup();
    ctx.store.setCursor({ ...startingCourse(), phase: { kind: 'DRIVE', level: 7 } });
    const cursor = await loadCourse(ctx.deps, 'u');
    const run = await planCourseDrive(ctx.deps, 'u', cursor);
    const counts = new Map<DrivingCompetency, number>();
    for (const it of run.composed!.items) counts.set(it.competency, (counts.get(it.competency) ?? 0) + 1);
    expect([...counts.values()].every(n => n === 3)).toBe(true);
    expect(counts.size).toBe(6);
    const settled = await completeCourseDrive(ctx.deps, 'u', cursor, run, resultFor(7, answered(run, () => true)));
    expect(settled.verdicts.every(v => v.passed)).toBe(true);
    expect(ctx.store.courseLog.at(-1)!.decisions.map(d => d.competency).sort()).toEqual([...counts.keys()].sort());
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
