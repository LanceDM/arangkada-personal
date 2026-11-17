import { describe, it, expect } from 'vitest';
import { buildLevelResult } from './buildLevelResult';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { ActionLog, SignOutcome } from '@/domain/learner/attempt';

const level: LevelConfig = {
  id: 3,
  name: 'Test level',
  description: '',
  roadLength: 1000,
  roadClass: 'city_street',
  speedLimit: 40,
  events: [],
  requiredScore: 45,
  moduleId: 'm3',
};

const noLogs: ActionLog[] = [];

const log = (result: ActionLog['result'], extra: Partial<ActionLog> = {}): ActionLog =>
  ({ timestamp: 0, action: 'brake', result, points: 0, ...extra });
const wrong = (n: number, extra: Partial<ActionLog> = {}) => Array.from({ length: n }, () => log('violation', extra));

describe('stars, one rule for every level: passed, then counted in mistakes', () => {
  const stars = (logs: ActionLog[], score = 60) => buildLevelResult(level, { score, violations: 0, correctActions: 0, logs }).stars;

  it('gives 3 for none, 2 for 1 or 2, 1 for more, whatever the points', () => {
    expect(stars([log('correct')])).toBe(3);
    expect(stars(wrong(1))).toBe(2);
    expect(stars(wrong(2))).toBe(2);
    expect(stars(wrong(3))).toBe(1);
    expect(stars(wrong(9), 999)).toBe(1);
  });

  it('gives nothing below the pass mark, however few the mistakes', () => {
    expect(stars([], 44)).toBe(0);
    expect(stars([], 45)).toBe(3);
  });

  it('counts an unanswered question, but not a standing penalty or a practice item', () => {
    expect(stars(wrong(3, { unanswered: true }))).toBe(1);
    expect(stars(wrong(4, { standing: true }))).toBe(3);
    expect(stars(wrong(4, { remediation: true }))).toBe(3);
    expect(stars([log('neutral'), log('correct')])).toBe(3);
  });
});

describe('buildLevelResult', () => {
  it('grades a completed run', () => {
    const r = buildLevelResult(level, { score: 60, violations: 2, correctActions: 5, logs: wrong(2) });
    expect(r.levelId).toBe(3);
    expect(r.score).toBe(60);
    expect(r.stars).toBe(2);
    expect(r.completed).toBe(true);
    expect(r.violations).toBe(2);
    expect(r.correctActions).toBe(5);
    expect(r).not.toHaveProperty('crashReason');
    expect(r.competencyScores).toBeDefined();
    expect('weakestCompetency' in r).toBe(true);
  });

  it('marks a run incomplete when the score is below requiredScore', () => {
    const r = buildLevelResult(level, { score: 30, violations: 0, correctActions: 1, logs: noLogs });
    expect(r.stars).toBe(0);
    expect(r.completed).toBe(false);
  });

  it('forces stars 0, not-completed and a reason on a crash regardless of score', () => {
    const r = buildLevelResult(
      level,
      { score: 999, violations: 3, correctActions: 9, logs: noLogs },
      { kind: 'crash', reason: 'You drove into a pedestrian.' }
    );
    expect(r.stars).toBe(0);
    expect(r.completed).toBe(false);
    expect(r.crashReason).toBe('You drove into a pedestrian.');
  });

  it('forces stars 0 and not-completed on a timeout, and marks it, with no crash reason', () => {
    const r = buildLevelResult(level, { score: 999, violations: 0, correctActions: 9, logs: noLogs }, { kind: 'time_up' });
    expect(r.stars).toBe(0);
    expect(r.completed).toBe(false);
    expect(r.timedOut).toBe(true);
    expect('crashReason' in r).toBe(false);
    expect('timedOut' in buildLevelResult(level, { score: 999, violations: 0, correctActions: 9, logs: noLogs })).toBe(false);
  });

  it('passes violations through unchanged (the crash +1 is the caller’s job, not this helper’s)', () => {
    const r = buildLevelResult(level, { score: 10, violations: 7, correctActions: 0, logs: noLogs }, { kind: 'crash', reason: 'x' });
    expect(r.violations).toBe(7);
  });

  it('omits signOutcomes when none are given and carries them when present', () => {
    const without = buildLevelResult(level, { score: 10, violations: 0, correctActions: 0, logs: noLogs });
    expect('signOutcomes' in without).toBe(false);

    const outcomes: SignOutcome[] = [
      { name: 'Stop', category: 'regulatory', meaning: 'Come to a full stop', isCorrect: true, action: 'stop', expectedAction: 'stop', message: 'Correct.' },
    ];
    const withOutcomes = buildLevelResult(level, {
      score: 10, violations: 0, correctActions: 0, logs: noLogs, signOutcomes: outcomes,
    });
    expect(withOutcomes.signOutcomes).toEqual(outcomes);
  });
});
