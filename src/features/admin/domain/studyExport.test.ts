import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { buildBKTProfile } from '@/domain/learner/mastery/buildBKTProfile';
import type { AttemptRow, CourseLogRow, SittingRow } from './adminReport';
import {
  buildBKTTrajectoryCSV,
  buildBackgroundCSV,
  buildDecisionsCSV,
  buildRewardsCSV,
  buildStudyExport,
  participantEvidence,
} from './studyExport';

const answer = (timestamp: number, correct: boolean, source: ActionLog['source'], competency: ActionLog['competency'] = 'parking'): ActionLog => ({
  timestamp,
  action: 'x',
  result: correct ? 'correct' : 'violation',
  points: 0,
  competency,
  source,
  itemId: `item-${timestamp}`,
});

const drive = (userId: string, levelId: number, timestamp: number, logs: ActionLog[]): AttemptRow => ({
  userId, levelId, timestamp, finalScore: 80, violations: 0, correctDecisions: logs.length, logs,
  session: { startedAt: timestamp - 1000, endedAt: timestamp, durationMs: 1000, pausedMs: 0, routeLength: 500, crashed: false, phase: 'DRIVE:6' },
});

const sitting = (userId: string, kind: SittingRow['kind'], answers: ActionLog[]): SittingRow => ({
  userId, kind, levelId: null, attempt: null, answers, timestamp: answers[0]?.timestamp ?? 0,
});

const logEntry = (userId: string): CourseLogRow => ({
  userId, kind: 'drive', levelId: 6, phase: 'DRIVE:6', attemptId: 'a1',
  verdicts: [],
  decisions: [{
    seq: 0, levelId: 6, phase: 'DRIVE:6', competency: 'parking', state: { mastery: 2, result: 'passed' }, masteryP: 0.6,
    legal: ['none', 'practice', 'review'], action: 'practice', source: 'explore_1', probability: 0.8, probabilities: { practice: 0.8 }, leader: null, timestamp: 5,
  }],
  rewards: [{
    decisionId: '5:parking:0', competency: 'parking', state: { mastery: 1, result: 'failed' }, action: 'none', reward: 1.1,
    accuracy: 0.67, passed: true, addedDecisions: 0, next: { mastery: 2, result: 'passed' }, measuredBy: 'quiz', timestamp: 5,
  }],
  tableAfter: {},
  timestamp: 5,
});

describe('the study data export', () => {
  const data = {
    attempts: [
      drive('u1', 0, 1, [answer(1, true, undefined)]), // the tutorial: not evidence
      drive('u1', 6, 4, [answer(4, false, undefined), answer(4.5, true, undefined)]),
      drive('other', 6, 9, [answer(9, true, undefined)]), // not a course participant
    ],
    courseLogs: [logEntry('u1')],
    sittings: [
      sitting('u1', 'diagnostic', [answer(2, true, 'diagnostic')]),
      sitting('u1', 'post_exam', [answer(20, true, 'post_exam')]),
      sitting('u2', 'diagnostic', [answer(3, false, 'diagnostic', 'road_signs')]),
    ],
    backgrounds: [{ userId: 'u2', formVersion: 1, answers: { gaming_frequency: 'Never', license: 'None' }, timestamp: 1 }],
    sharedQTable: { table: { 'M2-passed': { q: { practice: 0.4 }, n: { practice: 1 }, visits: { practice: 1 } } }, updates: 3, updatedAt: 10 },
  } as Parameters<typeof buildStudyExport>[0];

  const study = buildStudyExport(data, 100);

  it('replays BKT per participant from their own answers, tutorial left out, post-exam included', () => {
    expect(study.participants.map(p => p.userId)).toEqual(['u1', 'u2']);
    const u1 = study.participants[0];
    const evidence = participantEvidence(data.attempts.filter(a => a.userId === 'u1'), data.sittings.filter(s => s.userId === 'u1'));
    expect(evidence.map(l => l.timestamp)).toEqual([2, 4, 4.5, 20]);
    expect(u1.bkt.trajectory.map(s => s.source)).toEqual(['diagnostic', 'drive', 'drive', 'post_exam']);
    expect(u1.bkt.finalMastery.parking).toBeCloseTo(buildBKTProfile(evidence).parking, 12);
    // u2's road signs answer never touches u1's model.
    expect(u1.bkt.finalMastery.road_signs).toBe(0.3);
    expect(study.participants[1].bkt.finalMastery.road_signs).toBeLessThan(0.3);
    expect(u1.drives.map(d => d.session?.durationMs)).toEqual([1000, 1000]);
  });

  it('exports the one shared Q-table once, and each entry with its snapshot', () => {
    expect(study.sharedQTable?.updates).toBe(3);
    expect(study.participants[0].courseLog[0].tableAfter).toEqual({});
  });

  it('carries no IRT and no names', () => {
    // Everything but the notes, which name what is left out.
    const text = JSON.stringify({ ...study, notes: null });
    // "probability" (the decision log) is fine; a Rasch "ability" is not.
    expect(text).not.toMatch(/\bability\b|theta|difficulty/i);
    expect(text).not.toMatch(/email|username/);
    expect(study.notes.irt).toMatch(/Excluded/);
  });

  it('writes the long CSVs: one row per answer, decision, reward and background form', () => {
    const bkt = buildBKTTrajectoryCSV(study).split('\n');
    expect(bkt[0]).toBe('userId,step,timestamp,competency,source,itemId,scenarioId,correct,pBefore,predictedCorrect,pAfter');
    expect(bkt).toHaveLength(1 + 4 + 1);
    expect(buildDecisionsCSV(study).split('\n')[1]).toContain('"M2-passed"');
    expect(buildRewardsCSV(study).split('\n')[1]).toContain('"quiz"');
    const background = buildBackgroundCSV(study).split('\n');
    expect(background[0]).toBe('userId,formVersion,timestamp,gaming_frequency,license');
    expect(background[1]).toBe('"u2","1","1","Never","None"');
  });
});
