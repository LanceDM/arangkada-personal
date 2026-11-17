import { describe, expect, it } from 'vitest';
import type { DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';
import { courseLogRowOf, decisionRows, playerBkt, playerCourseRows, stateActionStats, type CourseLogRow } from './courseAdmin';

const decision = (over: Partial<DecisionRecord>): DecisionRecord => ({
  seq: 1, levelId: 1, phase: 'DRIVE(1)', competency: 'driver_legality', state: { mastery: 2, result: 'failed' }, masteryP: 0.6,
  legal: ['practice', 'review'], action: 'practice', source: 'explore_1', probability: 0.5, probabilities: { practice: 0.5, review: 0.5 },
  leader: null, selection: 'explore', draw: 0.2, snapshot: {}, timestamp: 1000, ...over,
});

const reward = (over: Partial<RewardRecord>): RewardRecord => ({
  decisionId: '1:driver_legality:1', competency: 'driver_legality', state: { mastery: 2, result: 'failed' }, action: 'practice',
  reward: 0.94, accuracy: 1, passed: true, addedDecisions: 3, next: null, measuredBy: 'drive', kind: 'terminal', timestamp: 2000, ...over,
});

const row = (over: Partial<CourseLogRow>): CourseLogRow => ({
  userId: 'u1', kind: 'drive', levelId: 1, phase: 'DRIVE(1)', verdicts: [], decisions: [], rewards: [], endReason: null, timestamp: 1000, ...over,
});

const label = (uid: string) => uid.toUpperCase();

describe('the course views over the course log', () => {
  const logs = [
    row({
      verdicts: [{ competency: 'driver_legality', total: 3, correct: 1, passed: false, masteryP: 0.6, driveEvidence: 3 }],
      decisions: [decision({})],
    }),
    row({
      phase: 'REPEAT(1)', timestamp: 2000,
      verdicts: [{ competency: 'driver_legality', total: 3, correct: 3, passed: true, masteryP: 0.85, driveEvidence: 6 }],
      decisions: [decision({ seq: 2, state: { mastery: 3, result: 'passed' }, legal: ['none', 'practice'], action: 'none', timestamp: 2000 })],
      rewards: [reward({})],
    }),
  ];

  it('reads a stored entry and refuses anything else', () => {
    const stored = { schemaVersion: 1, kind: 'quiz', levelId: 2, phase: 'QUIZ(2)', verdicts: [], decisions: [], rewards: [], tableAfter: {}, timestamp: 9 };
    expect(courseLogRowOf('u9', stored)).toMatchObject({ userId: 'u9', kind: 'quiz', levelId: 2, phase: 'QUIZ(2)', endReason: null });
    expect(courseLogRowOf('u9', { levelId: 2 })).toBeNull();
  });

  it('says where each participant is, and how each competency stands', () => {
    const [p] = playerCourseRows(logs, label);
    expect(p).toMatchObject({ label: 'U1', lastPhase: 'REPEAT(1)', decisions: 2, rewards: 1 });
    expect(p.standing).toEqual([{ competency: 'driver_legality', attempts: 2, lastAction: 'none', status: 'done', lastCorrect: 3, lastTotal: 3 }]);
  });

  it('counts each state-action and averages its rewards', () => {
    const cell = stateActionStats(logs).find(s => s.state === 'M2-failed' && s.action === 'practice')!;
    expect(cell).toMatchObject({ chosen: 1, explore: 1, rewarded: 1, steps: 0, terminal: 1, meanReward: 0.94, meanTerminalReward: 0.94, meanAccuracy: 1, meanAdded: 3 });
  });

  it('keeps Option 2 steps apart from terminal rewards: a step measures no outcome', () => {
    const step = reward({ decisionId: '1:driver_legality:9', reward: -0.06, accuracy: 0, passed: false, next: { mastery: 2, result: 'failed' }, kind: 'step' });
    // Saved before Option 2: no kind, read as terminal.
    const { kind: _unused, ...old } = reward({ decisionId: '1:driver_legality:8', reward: 0.5, accuracy: 0.5 });
    void _unused;
    const cell = stateActionStats([...logs, row({ rewards: [step, old as RewardRecord] })]).find(s => s.state === 'M2-failed' && s.action === 'practice')!;
    expect(cell).toMatchObject({ rewarded: 3, steps: 1, terminal: 2, meanAccuracy: 0.75 });
    expect(cell.meanTerminalReward).toBeCloseTo(0.72);
  });

  it('pairs each decision with its reward, newest first', () => {
    const rows = decisionRows(logs, label);
    expect(rows.map(r => r.seq)).toEqual([2, 1]);
    expect(rows[1].reward?.reward).toBe(0.94);
    expect(rows[0].reward).toBeNull();
  });
});

describe('BKT from the update log', () => {
  const entry = (userSeq: number, competency: string, source: string, correct: boolean, pAfter: number, levelAfter: number) => ({
    uid: 'u1', userSeq, competency, source, correct, pAfter, levelAfter, answeredAt: userSeq * 10,
  });

  it('takes P(L) and the level as the log wrote them, in the log order', () => {
    const [p] = playerBkt(
      [entry(3, 'driver_legality', 'drive', true, 0.81, 3), entry(1, 'driver_legality', 'pre_test', true, 0.5, 2), entry(2, 'driver_legality', 'quiz', false, 0.4, 1)],
      label,
      0.3
    );
    const c = p.competencies.driver_legality;
    expect(c).toMatchObject({ p: 0.81, level: 3, startP: 0.5, answers: { pre_test: 1, quiz: 1, drive: 1 }, correct: 2, trajectory: [0.5, 0.4, 0.81] });
    expect(p.answers).toBe(3);
    expect(p.lastAt).toBe(30);
    expect(p.competencies.road_signs).toMatchObject({ p: 0.3, startP: null, trajectory: [] });
  });

  it('leaves out an entry it cannot read', () => {
    expect(playerBkt([{ uid: 'u1', competency: 'driver_legality' }], label, 0.3)).toEqual([]);
  });
});
