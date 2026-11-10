import { describe, expect, it } from 'vitest';
import type { DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';
import type { CourseLogRow } from './adminReport';
import { decisionRows, playerCourseRows, stateActionStats } from './courseAdmin';

const decision = (over: Partial<DecisionRecord>): DecisionRecord => ({
  seq: 1, levelId: 1, phase: 'DRIVE(1)', competency: 'driver_legality', state: { mastery: 2, result: 'failed' }, masteryP: 0.6,
  legal: ['practice', 'review'], action: 'practice', source: 'explore_1', probability: 0.5, probabilities: { practice: 0.5, review: 0.5 },
  leader: null, selection: 'explore', draw: 0.2, snapshot: {} as DecisionRecord['snapshot'], timestamp: 1000, ...over,
});

const reward = (over: Partial<RewardRecord>): RewardRecord => ({
  decisionId: '1:driver_legality:1', competency: 'driver_legality', state: { mastery: 2, result: 'failed' }, action: 'practice',
  reward: 1.44, accuracy: 1, passed: true, addedDecisions: 3, next: { mastery: 3, result: 'passed' }, measuredBy: 'drive', timestamp: 2000, ...over,
});

const row = (over: Partial<CourseLogRow>): CourseLogRow => ({
  userId: 'u1', kind: 'drive', levelId: 1, phase: 'DRIVE(1)', attemptId: 'a1', verdicts: [], decisions: [], rewards: [], tableAfter: {}, timestamp: 1000, ...over,
});

const logs: CourseLogRow[] = [
  row({
    verdicts: [
      { competency: 'driver_legality', total: 3, correct: 1, passed: false, masteryP: 0.6, driveEvidence: 3 },
      { competency: 'document_awareness', total: 3, correct: 3, passed: true, masteryP: 0.9, driveEvidence: 3 },
    ],
    decisions: [
      decision({}),
      decision({ seq: 2, competency: 'document_awareness', state: { mastery: 3, result: 'passed' }, legal: ['none', 'practice'], action: 'none', source: 'explore_1' }),
    ],
  }),
  row({
    phase: 'REPEAT(1)', timestamp: 3000,
    verdicts: [{ competency: 'driver_legality', total: 3, correct: 3, passed: true, masteryP: 0.85, driveEvidence: 6 }],
    decisions: [decision({ seq: 3, phase: 'REPEAT(1)', state: { mastery: 3, result: 'passed' }, legal: ['none', 'practice'], action: 'none', source: 'commit_1', selection: 'exploit', timestamp: 3000 })],
    rewards: [reward({})],
  }),
];

describe("the admin's course views", () => {
  it('shows where each player is, and how the newest stage left each competency', () => {
    const [player] = playerCourseRows(logs, new Map([['u1', 'U-1']]), []);
    expect(player).toMatchObject({ label: 'U-1', lastPhase: 'REPEAT(1)', decisions: 3, rewards: 1 });
    expect(player.standing.find(s => s.competency === 'driver_legality')).toMatchObject({ attempts: 2, status: 'done', lastCorrect: 3 });
    expect(player.standing.find(s => s.competency === 'document_awareness')).toMatchObject({ attempts: 1, status: 'done' });
  });

  it('sums what each state and action has earned, with its parts', () => {
    const practice = stateActionStats(logs).find(s => s.state === 'M2-failed' && s.action === 'practice')!;
    expect(practice).toMatchObject({ chosen: 1, explore: 1, rewarded: 1, meanReward: 1.44, meanAccuracy: 1, passShare: 1, meanAdded: 3 });
    expect(stateActionStats(logs).find(s => s.state === 'M3-passed' && s.action === 'none')).toMatchObject({ chosen: 2, explore: 1, exploit: 1, rewarded: 0, meanReward: null });
  });

  it('pairs each decision with its reward, newest first', () => {
    const rows = decisionRows(logs, new Map(), [{ id: 'u1', username: 'juan', email: '', createdAt: 0, totalScore: 0, longestStreak: 0, bestExamScore: 0 }]);
    expect(rows[0]).toMatchObject({ seq: 3, label: 'juan', reward: null });
    expect(rows.find(r => r.seq === 1)!.reward?.reward).toBe(1.44);
  });
});
