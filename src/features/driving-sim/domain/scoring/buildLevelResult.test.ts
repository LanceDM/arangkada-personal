import { describe, it, expect } from 'vitest';
import { buildLevelResult, starsFor } from './buildLevelResult';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { ActionLog, SignOutcome } from '@/domain/learner/attempt';

const level: LevelConfig = {
  id: 3,
  name: 'Test level',
  description: '',
  roadLength: 1000,
  speedLimit: 40,
  events: [],
  requiredScore: 45,
  stars2: 55,
  stars3: 65,
  moduleId: 'm3',
};

const noLogs: ActionLog[] = [];

describe('starsFor', () => {
  it('bands a score by the level thresholds', () => {
    expect(starsFor(level, 44)).toBe(0);
    expect(starsFor(level, 45)).toBe(1);
    expect(starsFor(level, 54)).toBe(1);
    expect(starsFor(level, 55)).toBe(2);
    expect(starsFor(level, 65)).toBe(3);
    expect(starsFor(level, 999)).toBe(3);
  });
});

describe('buildLevelResult', () => {
  it('grades a completed run by the level thresholds', () => {
    const r = buildLevelResult(level, { score: 60, violations: 2, correctActions: 5, logs: noLogs });
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
      'You drove into a pedestrian.'
    );
    expect(r.stars).toBe(0);
    expect(r.completed).toBe(false);
    expect(r.crashReason).toBe('You drove into a pedestrian.');
  });

  it('passes violations through unchanged (the crash +1 is the caller’s job, not this helper’s)', () => {
    const r = buildLevelResult(level, { score: 10, violations: 7, correctActions: 0, logs: noLogs }, 'x');
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
