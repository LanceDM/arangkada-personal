import { describe, expect, it } from 'vitest';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import type { DrivingCompetency } from '@/domain/learner/competency';
import {
  IllegalTransition,
  applyQOperations,
  driveCompetencies,
  driveCompleted,
  lessonsRead,
  postExamCompleted,
  quizMeasured,
  quizReviewDone,
  quizSubmitted,
  reviewShown,
  reviewsDue,
  startingCourse,
  type CompetencyMeasurement,
  type CourseCursor,
} from './course';
import { emptyQTable } from './qLearning';

const answers = (competency: DrivingCompetency, correct: number, attempt = 1) =>
  [0, 1, 2].map(i => ({ itemId: `${competency}-${attempt}-${i}`, competency, correct: i < correct }));

const measured = (competency: DrivingCompetency, correct: number, masteryP: number): CompetencyMeasurement => ({
  competency,
  accuracy: correct / 3,
  passed: correct >= 2,
  masteryP,
  driveEvidence: 6,
});

/** Through the tutorial into Level 1's quiz. */
const atLevel1Quiz = (): CourseCursor => {
  let cursor = lessonsRead(startingCourse());
  cursor = driveCompleted(cursor, { measurements: [], scenarioIds: [], table: emptyQTable(), rng: () => 0.5, now: 0 }).cursor;
  return lessonsRead(cursor);
};

describe('the per-competency routing FSM', () => {
  it('runs the tutorial with no quiz and no decisions', () => {
    let cursor = lessonsRead(startingCourse());
    expect(cursor.phase).toEqual({ kind: 'DRIVE', level: 0 });
    const outcome = driveCompleted(cursor, { measurements: [], scenarioIds: ['t1'], table: emptyQTable(), rng: () => 0.5, now: 0 });
    cursor = outcome.cursor;
    expect(cursor.phase).toEqual({ kind: 'MODULE', level: 1 });
    expect(outcome.decisions).toEqual([]);
  });

  it('opens the drive only when every competency passes the quiz at 2 of 3', () => {
    let cursor = atLevel1Quiz();
    expect(cursor.phase).toEqual({ kind: 'QUIZ', level: 1 });
    cursor = quizSubmitted(cursor, [...answers('driver_legality', 3), ...answers('document_awareness', 1)]);
    expect(cursor.phase.kind).toBe('QUIZ');
    expect(cursor.quiz).toMatchObject({ attempt: 2, remaining: ['document_awareness'], passed: ['driver_legality'] });
    cursor = quizSubmitted(cursor, answers('document_awareness', 2, 2));
    expect(cursor.phase).toEqual({ kind: 'DRIVE', level: 1 });
  });

  it('sends the learner to review the module after a third failed quiz attempt, then to the drive', () => {
    let cursor = atLevel1Quiz();
    for (let attempt = 1; attempt <= 3; attempt++) {
      cursor = quizSubmitted(cursor, [...answers('driver_legality', 3, attempt), ...answers('document_awareness', 0, attempt)]);
    }
    expect(cursor.phase).toEqual({ kind: 'QUIZ_REVIEW', level: 1, competencies: ['document_awareness'] });
    expect(quizReviewDone(cursor).phase).toEqual({ kind: 'DRIVE', level: 1 });
  });

  it('refuses a move its state does not allow', () => {
    expect(() => quizSubmitted(startingCourse(), [])).toThrow(IllegalTransition);
  });

  it('works the worked example: A passes and is done, B fails and repeats alone', () => {
    let cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    // rng 0.99 in Explore I picks the second of the actions still needing visits.
    const outcome = driveCompleted(cursor, {
      measurements: [measured('driver_legality', 3, 0.86), measured('document_awareness', 1, 0.55)],
      scenarioIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      table: emptyQTable(),
      rng: () => 0.01,
      now: 1,
    });
    cursor = outcome.cursor;
    const a = outcome.decisions.find(d => d.competency === 'driver_legality')!;
    const b = outcome.decisions.find(d => d.competency === 'document_awareness')!;
    expect(a.legal).toEqual(['none', 'practice']);
    expect(b.legal).toEqual(['practice', 'review']);
    expect(a.source).toBe('explore_1');
    // rng 0.01 draws the first legal action: none for A, practice for B.
    expect(a.action).toBe('none');
    expect(b.action).toBe('practice');
    expect(cursor.phase).toEqual({ kind: 'REPEAT', level: 1 });
    expect(driveCompetencies(cursor)).toEqual(['document_awareness']);
    expect(cursor.seen).toMatchObject({ a: 0, f: 0 });
    expect(cursor.pending).toHaveLength(2);
  });

  it('rewards a pending decision at the competency\'s next measurement', () => {
    let cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    let table = emptyQTable();
    const first = driveCompleted(cursor, {
      measurements: [measured('driver_legality', 3, 0.86), measured('document_awareness', 1, 0.55)],
      scenarioIds: [], table, rng: () => 0.01, now: 1,
    });
    cursor = first.cursor;
    table = first.table;
    const second = driveCompleted(cursor, {
      measurements: [measured('document_awareness', 2, 0.82)],
      scenarioIds: [], table, rng: () => 0.01, now: 2,
    });
    const rewarded = second.rewards.find(r => r.competency === 'document_awareness')!;
    expect(rewarded.action).toBe('practice');
    // A_next 2/3, passed, practice added 3 decisions.
    expect(rewarded.reward).toBeCloseTo(2 / 3 + 0.5 - 0.06, 10);
    expect(rewarded.next).toEqual({ mastery: 3, result: 'passed' });
    // The none taken for driver_legality waits for its next measurement.
    expect(second.cursor.pending.some(p => p.competency === 'driver_legality')).toBe(true);
  });

  it('ends a competency after 3 attempts and flags it when none was not legal', () => {
    let cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    let table = emptyQTable();
    const drive = (measurements: CompetencyMeasurement[], rng = () => 0.99) => {
      const outcome = driveCompleted(cursor, { measurements, scenarioIds: [], table, rng, now: 0 });
      cursor = outcome.cursor;
      table = outcome.table;
      return outcome;
    };
    drive([measured('driver_legality', 3, 0.9), measured('document_awareness', 0, 0.2)], () => 0.01);
    expect(cursor.stage.driver_legality?.done).toBe(true);
    drive([measured('document_awareness', 0, 0.2)]);
    const last = drive([measured('document_awareness', 1, 0.3)]);
    expect(last.decisions[0].source).toBe('cap');
    expect(cursor.flagged).toEqual([{ levelId: 1, competency: 'document_awareness' }]);
    expect(cursor.phase).toEqual({ kind: 'MODULE', level: 2 });
  });

  it('shows the module section before a repeat drive after review', () => {
    let cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    // rng 0.99 draws the last legal action: review after a fail.
    const outcome = driveCompleted(cursor, {
      measurements: [measured('driver_legality', 3, 0.9), measured('document_awareness', 0, 0.2)],
      scenarioIds: [], table: emptyQTable(), rng: () => 0.99, now: 0,
    });
    cursor = outcome.cursor;
    expect(reviewsDue(cursor)).toEqual(['document_awareness']);
    expect(reviewsDue(reviewShown(cursor))).toEqual([]);
  });

  it('rewards what is still pending on the post-exam, with no next state', () => {
    let cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    const outcome = driveCompleted(cursor, {
      measurements: [measured('driver_legality', 3, 0.9), measured('document_awareness', 3, 0.9)],
      scenarioIds: [], table: emptyQTable(), rng: () => 0.01, now: 0,
    });
    cursor = outcome.cursor;
    const exam = postExamCompleted(cursor, { driver_legality: { accuracy: 0.8, passed: true } }, outcome.table, 9);
    expect(exam.rewards.map(r => r.competency)).toEqual(['driver_legality']);
    expect(exam.rewards[0].next).toBeNull();
    expect(exam.unrewarded.map(p => p.competency)).toEqual(['document_awareness']);
  });

  it('rewards a pending decision at the next quiz that measures its competency (Tentative)', () => {
    const cursor: CourseCursor = {
      ...startingCourse(),
      phase: { kind: 'DRIVE', level: 2 },
      pending: [
        { id: '1:document_awareness:0', competency: 'document_awareness', levelId: 1, state: { mastery: 3, result: 'passed' }, action: 'none', addedDecisions: 0, decidedAt: 0 },
        { id: '1:driver_legality:1', competency: 'driver_legality', levelId: 1, state: { mastery: 3, result: 'passed' }, action: 'none', addedDecisions: 0, decidedAt: 0 },
      ],
    };
    const out = quizMeasured(cursor, [measured('document_awareness', 2, 0.85)], emptyQTable(), 5);
    expect(out.rewards).toHaveLength(1);
    expect(out.rewards[0]).toMatchObject({ competency: 'document_awareness', measuredBy: 'quiz', next: { mastery: 3, result: 'passed' } });
    expect(out.rewards[0].reward).toBeCloseTo(2 / 3 + 0.5, 10);
    // Driver legality is not in Level 2's quiz: it keeps waiting.
    expect(out.cursor.pending.map(p => p.competency)).toEqual(['driver_legality']);
    expect(applyQOperations(emptyQTable(), out.operations)).toEqual(out.table);
  });

  it('applies the same operations to the stored table as it applied locally', () => {
    const cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    const outcome = driveCompleted(cursor, {
      measurements: [measured('driver_legality', 3, 0.9), measured('document_awareness', 1, 0.6)],
      scenarioIds: [], table: emptyQTable(), rng: () => 0.3, now: 0,
    });
    expect(applyQOperations(emptyQTable(), outcome.operations)).toEqual(outcome.table);
  });

  it('reaches the final exam after Level 11, once every competency is done', () => {
    let cursor: CourseCursor = { ...startingCourse(), phase: { kind: 'DRIVE', level: 11 }, stage: {} };
    let table = emptyQTable();
    for (let drive = 0; drive < 5 && cursor.phase.kind !== 'FINAL'; drive++) {
      const competencies = drive === 0 ? [...STAGE_COMPETENCIES[11]] : driveCompetencies(cursor);
      const outcome = driveCompleted(cursor, {
        measurements: competencies.map(c => measured(c, 3, 0.9)), scenarioIds: [], table, rng: () => 0.01, now: drive,
      });
      cursor = outcome.cursor;
      table = outcome.table;
    }
    expect(cursor.phase).toEqual({ kind: 'FINAL' });
  });
});
