import { describe, expect, it } from 'vitest';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import type { DrivingCompetency } from '@/domain/learner/competency';
import {
  IllegalTransition,
  applyQOperations,
  driveCompetencies,
  driveCompleted,
  finalCompleted,
  finishWithoutCertificate,
  lessonsRead,
  unrewardedAtEnd,
  quizMeasured,
  finalMeasured,
  quizReviewDone,
  quizSubmitted,
  reviewShown,
  reviewsDue,
  startingCourse,
  type CompetencyMeasurement,
  type CourseCursor,
} from './course';
import { emptyQTable } from './qLearning';

describe('the end path', () => {
  it('counts failed finals, and finishes without the certificate only after three or at the deadline', () => {
    let cursor: CourseCursor = { ...startingCourse(), phase: { kind: 'FINAL' } };
    for (let i = 0; i < 2; i++) cursor = finalCompleted(cursor, false, []);
    expect(cursor.finalFailures).toBe(2);
    expect(() => finishWithoutCertificate(cursor, 'final_attempts')).toThrow(IllegalTransition);
    cursor = finalCompleted(cursor, false, []);
    expect(finishWithoutCertificate(cursor, 'final_attempts').phase).toEqual({ kind: 'FINISHED', reason: 'final_attempts' });
    expect(finishWithoutCertificate({ ...startingCourse(), phase: { kind: 'DRIVE', level: 4 } }, 'deadline').phase).toEqual({ kind: 'FINISHED', reason: 'deadline' });
    expect(() => finishWithoutCertificate({ ...startingCourse(), phase: { kind: 'CERTIFIED' } }, 'deadline')).toThrow(IllegalTransition);
  });
});

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

describe('a competency the road can host no scenario for', () => {
  it('is closed for the stage with no decision, so the stage can end', () => {
    const cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    const outcome = driveCompleted(cursor, {
      measurements: [measured('driver_legality', 3, 0.9)],
      scenarioIds: [], table: emptyQTable(), rng: () => 0.01, now: 0,
      unmeasurable: ['document_awareness'],
    });
    expect(outcome.decisions.map(d => d.competency)).toEqual(['driver_legality']);
    expect(outcome.cursor.stage.document_awareness?.done ?? true).toBe(true);
  });
});

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
    // Option 2: a practice followed by another decision in the level is a step, its cost only.
    expect(rewarded.kind).toBe('step');
    expect(rewarded.reward).toBeCloseTo(-0.06, 10);
    expect(rewarded.next).toEqual({ mastery: 3, result: 'passed' });
    // The none taken for driver_legality waits for its next measurement.
    expect(second.cursor.pending.some(p => p.competency === 'driver_legality')).toBe(true);
  });

  it('holds a practice the cap closes for the next measurement after the level, then rewards it terminally', () => {
    let cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    let table = emptyQTable();
    const drive = (measurements: CompetencyMeasurement[]) => {
      const outcome = driveCompleted(cursor, { measurements, scenarioIds: [], table, rng: () => 0.01, now: 0 });
      cursor = outcome.cursor;
      table = outcome.table;
      return outcome;
    };
    drive([measured('driver_legality', 3, 0.86), measured('document_awareness', 0, 0.2)]);
    drive([measured('document_awareness', 0, 0.1)]);
    const capped = drive([measured('document_awareness', 0, 0.05)]);
    // The third attempt is the cap: the second decision is not rewarded at this drive.
    expect(capped.rewards.filter(r => r.competency === 'document_awareness')).toHaveLength(0);
    const waiting = cursor.pending.filter(p => p.competency === 'document_awareness');
    expect(waiting).toHaveLength(1);
    expect(waiting[0].awaitsOutcome).toBe(true);
    const later = quizMeasured({ ...cursor, phase: { kind: 'DRIVE', level: 2 } }, [measured('document_awareness', 2, 0.6)], table, 9);
    const terminal = later.rewards.find(r => r.competency === 'document_awareness')!;
    expect(terminal).toMatchObject({ kind: 'terminal', next: null });
    expect(terminal.reward).toBeCloseTo(2 / 3 - 0.06, 10);
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

  it('leaves what is still pending unrewarded at the end: the post-test rewards nothing', () => {
    let cursor = quizSubmitted(atLevel1Quiz(), [...answers('driver_legality', 3), ...answers('document_awareness', 3)]);
    const outcome = driveCompleted(cursor, {
      measurements: [measured('driver_legality', 3, 0.9), measured('document_awareness', 3, 0.9)],
      scenarioIds: [], table: emptyQTable(), rng: () => 0.01, now: 0,
    });
    cursor = outcome.cursor;
    expect(unrewardedAtEnd(cursor).map(p => p.competency).sort()).toEqual(['document_awareness', 'driver_legality']);
  });

  it('rewards a pending decision at the next quiz that measures its competency, terminally', () => {
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
    // Option 2: the quiz opens a later level, so the episode's reward is terminal: r = A.
    expect(out.rewards[0]).toMatchObject({ competency: 'document_awareness', measuredBy: 'quiz', kind: 'terminal', next: null });
    expect(out.rewards[0].reward).toBeCloseTo(2 / 3, 10);
    // Driver legality is not in Level 2's quiz: it keeps waiting.
    expect(out.cursor.pending.map(p => p.competency)).toEqual(['driver_legality']);
    expect(applyQOperations(emptyQTable(), out.operations)).toEqual(out.table);
  });

  it('rewards pending decisions at the final exam, terminally', () => {
    const cursor: CourseCursor = {
      ...startingCourse(),
      phase: { kind: 'FINAL' },
      pending: [
        { id: '11:parking:9', competency: 'parking', levelId: 11, state: { mastery: 2, result: 'passed' }, action: 'none', addedDecisions: 0, decidedAt: 0 },
      ],
    };
    const out = finalMeasured(cursor, [{ competency: 'parking', accuracy: 1, passed: true, masteryP: 0.9, driveEvidence: 9 }], emptyQTable(), 3);
    expect(out.rewards).toHaveLength(1);
    expect(out.rewards[0]).toMatchObject({ measuredBy: 'final', next: null, reward: 1, kind: 'terminal' });
    expect(out.cursor.pending).toEqual([]);
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
