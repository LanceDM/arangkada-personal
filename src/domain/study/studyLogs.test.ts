import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { buildBKTProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { applyQOperations, type DecisionRecord, type QOperation, type RewardRecord } from '@/domain/competencyRouting/course';
import { chooseAction, emptyQTable, recordVisit, statePhase, type QState } from '@/domain/competencyRouting/qLearning';
import { buildBKTLog, type EvidenceOrigin } from './bktLog';
import { applyQLog, pairQOperations, replayQLog, sameTable } from './qLog';
import type { StudyEnvelope } from './studyEvent';

const envelope = (i: number): StudyEnvelope => ({
  schemaVersion: 1, eventId: `e${i}`, uid: 'u', at: i, sessionId: 's', appBuild: 'b', configVersion: 'c',
});

describe('exploration and exploitation tags', () => {
  const failed: QState = { mastery: 2, result: 'failed' };
  const passedLow: QState = { mastery: 1, result: 'passed' };

  it('tags a decision with only one legal action as forced, with no draw', () => {
    const d = chooseAction(emptyQTable(), passedLow, { state: passedLow, masteryP: 0.3, failedBefore: false }, () => 0.5);
    expect(d.selection).toBe('forced');
    expect(d.draw).toBeNull();
    expect(statePhase(emptyQTable(), passedLow).tag).toBe('no_choice');
  });

  it('explores in Explore I, and logs the random number drawn', () => {
    const d = chooseAction(emptyQTable(), failed, { state: failed, masteryP: 0.6, failedBefore: false }, () => 0.7);
    expect(d.phase).toBe('explore_1');
    expect(d.selection).toBe('explore');
    expect(d.draw).toBe(0.7);
    expect(d.snapshot).toEqual({ practice: { q: 0, visits: 0 }, review: { q: 0, visits: 0 } });
    expect(statePhase(emptyQTable(), failed).tag).toBe('exploring');
  });

  it('exploits when the commit phase takes the leader, explores when the floor picks another', () => {
    let table = emptyQTable();
    for (let i = 0; i < 2; i++) {
      table = recordVisit(table, failed, 'practice');
      table = recordVisit(table, failed, 'review');
    }
    expect(statePhase(table, failed)).toMatchObject({ phase: 'commit_1', tag: 'exploiting' });
    const ctx = { state: failed, masteryP: 0.6, failedBefore: false };
    const leaderPick = chooseAction(table, failed, ctx, () => 0.05);
    expect(leaderPick.selection).toBe('exploit');
    expect(leaderPick.action).toBe(leaderPick.leader);
    const floorPick = chooseAction(table, failed, ctx, () => 0.99);
    expect(floorPick.selection).toBe('explore');
    expect(floorPick.action).not.toBe(floorPick.leader);
  });
});

describe('the Q-table update log', () => {
  const state: QState = { mastery: 3, result: 'passed' };
  const decision = (seq: number): DecisionRecord => ({
    seq, levelId: 2, phase: 'DRIVE(2)', competency: 'parking', state, masteryP: 0.85, legal: ['none', 'practice'],
    action: 'practice', source: 'explore_1', probability: 0.5, probabilities: { none: 0.5, practice: 0.5 }, leader: null,
    selection: 'explore', draw: 0.6, snapshot: {}, timestamp: 1,
  });
  const reward: RewardRecord = {
    decisionId: '2:parking:0', competency: 'parking', state, action: 'practice', reward: 1.2, accuracy: 0.76, passed: true,
    addedDecisions: 3, next: { mastery: 4, result: 'passed' }, measuredBy: 'quiz', timestamp: 2,
  };
  const operations: QOperation[] = [
    { kind: 'update', state, action: 'practice', reward: 1.2, next: { mastery: 4, result: 'passed' }, gamma: 0.9 },
    { kind: 'visit', state, action: 'practice' },
  ];

  it('pairs operations with their records and ends on the same table as applyQOperations', () => {
    const items = pairQOperations(operations, [decision(1)], [reward]);
    const { table, entries } = applyQLog({ table: emptyQTable(), items, firstGlobalSeq: 7, context: { participantCode: 'P01', levelId: 2, phase: 'DRIVE(2)', attemptId: 'a' }, envelope });
    expect(table).toEqual(applyQOperations(emptyQTable(), operations));
    expect(entries.map(e => [e.globalSeq, e.kind])).toEqual([[7, 'learn'], [8, 'visit']]);
    expect(entries[0].learning).toMatchObject({ qBefore: 0, qAfter: 1.2, alpha: 1, target: 1.2, nBefore: 0, nAfter: 1, measuredBy: 'quiz', nextStateKey: 'M4-passed' });
    expect(entries[1].decision).toMatchObject({ selection: 'explore', draw: 0.6, visitsBefore: 0, visitsAfter: 1 });
    expect(entries[1].decisionId).toBe('2:parking:1');
    expect(entries[1].tableAfter).toEqual(table);
    expect(entries[1].statesAfter['M3-passed'].tag).toBe('exploring');
  });

  it('replays a sound log to the same table, and finds a lost entry or an altered value', () => {
    const items = pairQOperations(operations, [decision(1)], [reward]);
    const { table, entries } = applyQLog({ table: emptyQTable(), items, firstGlobalSeq: 1, context: { participantCode: null, levelId: 2, phase: 'DRIVE(2)', attemptId: 'a' }, envelope });
    const sound = replayQLog(entries);
    expect(sound.problems).toEqual([]);
    expect(sameTable(sound.table, table)).toBe(true);

    // An entry lost: the numbering has a gap and the next snapshot no longer follows.
    expect(replayQLog([entries[1]]).problems.join('\n')).toMatch(/expected globalSeq 1/);
    // A reward that does not follow from its parts, and a Q value that does not follow from the update.
    const tampered = structuredClone(entries);
    tampered[0].learning!.reward = 5;
    tampered[0].learning!.qAfter = 5;
    const found = replayQLog(tampered).problems.join('\n');
    expect(found).toMatch(/reward 5, its parts give/);
    expect(found).toMatch(/tableAfter differs/);
  });
});

describe('the BKT log', () => {
  const log = (t: number, correct: boolean, extra: Partial<ActionLog> = {}): ActionLog => ({
    timestamp: t, action: correct ? 'brake' : 'go', result: correct ? 'correct' : 'violation', points: 0, competency: 'parking', ...extra,
  });
  const logs = [
    log(1, true, { source: 'diagnostic', itemId: 'q1', reactionTime: 900 }),
    log(2, false, { scenarioId: 's1', reactionTime: 1200 }),
    log(3, true, { scenarioId: 's2', expectedAction: 'brake' }),
  ];
  const origins: EvidenceOrigin[] = [
    { kind: 'diagnostic', levelId: null, ref: null, attempt: null },
    { kind: 'attempt', levelId: 6, ref: null, attempt: null },
    { kind: 'attempt', levelId: 6, ref: null, attempt: null },
  ];

  it('writes one entry per answer with the raw answer and every computed value, and a matching profile', () => {
    const { profile, entries } = buildBKTLog({ uid: 'u', logs, origins, alreadyLogged: 0, envelope, now: 10, configVersion: 'c' });
    expect(entries.map(e => e.userSeq)).toEqual([1, 2, 3]);
    expect(entries[0]).toMatchObject({ source: 'diagnostic', itemId: 'q1', responseMs: 900, pInit: 0.3, levelBefore: 1 });
    expect(entries[0].params.pTransit).toBe(0);
    expect(entries[1]).toMatchObject({ scenarioId: 's1', correct: false, action: 'go', origin: { levelId: 6 }, pInit: null });
    expect(entries[1].pBefore).toBe(entries[0].pAfter);
    expect(profile.competencies.parking.p).toBeCloseTo(buildBKTProfile(logs).parking, 12);
    expect(profile.competencies.parking.startP).toBe(entries[0].pAfter);
    expect(profile.competencies.parking.answers).toEqual({ drive: 2, quiz: 0, diagnostic: 1, post_exam: 0 });
    expect(profile.updates).toBe(3);
  });

  it('writes only the answers not yet logged', () => {
    const { entries } = buildBKTLog({ uid: 'u', logs, origins, alreadyLogged: 2, envelope, now: 10, configVersion: 'c' });
    expect(entries.map(e => e.userSeq)).toEqual([3]);
  });
});
