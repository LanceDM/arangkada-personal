// Unit tests for evaluatePlayerAction.
// No React, no canvas - this exercises the same evaluateWeightedRule path
// (domain/evaluation/evaluatePlayerAction.ts) that every in-game action goes through.
import { describe, it, expect } from 'vitest';
import { evaluatePlayerAction } from './evaluatePlayerAction';
import { buildLevelConfig, level0 } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { selectPractice } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { createRng } from '@/shared/lib/rng';

// A real event from an existing level, rather than a hand-built sparse fake -
// so this reflects what ruleEngine.buildRule actually sees in play (a
// `type`/`competency`/`severity` combination that already exists in the
// roster, not an invented shape that happens to satisfy the type checker).
const stopEvent = level0.events.find(e => e.id === 'level0.full-stop-checkpoint')!;

describe('evaluatePlayerAction', () => {
  it('scores a matching action as correct and awards its points', () => {
    const result = evaluatePlayerAction(stopEvent, stopEvent.correctAction, 0);

    expect(result.isCorrect).toBe(true);
    expect(result.points).toBe(stopEvent.points);
    expect(result.message).toBe(stopEvent.rewardMessage);
    expect(result.log.result).toBe('correct');
    expect(result.log.expectedAction).toBe(stopEvent.correctAction);
  });

  it('scores a mismatched action as incorrect and penalizes it', () => {
    const wrongAction = 'accelerate';
    expect(wrongAction).not.toBe(stopEvent.correctAction);

    const result = evaluatePlayerAction(stopEvent, wrongAction, 0);

    expect(result.isCorrect).toBe(false);
    expect(result.points).toBeLessThan(0);
    expect(result.log.result).toBe('violation');
    expect(result.log.expectedAction).toBe(stopEvent.correctAction);
  });

  it('scales the penalty up with an existing violation streak', () => {
    const noStreak = evaluatePlayerAction(stopEvent, 'accelerate', 0);
    const withStreak = evaluatePlayerAction(stopEvent, 'accelerate', 3);

    // Points are negative for a violation, so a heavier penalty is more negative.
    expect(withStreak.points).toBeLessThan(noStreak.points);
  });
});

// Provenance: which log entries came from the adaptive layer's intervention
// rather than from the level's own authored curriculum. Without this the log
// is a flat stream of graded decisions and a mastery change cannot be
// attributed to the scenario that caused it.
describe('evaluatePlayerAction remediation provenance', () => {
  it('leaves a level\'s own event completely unmarked', () => {
    const { log } = evaluatePlayerAction(stopEvent, stopEvent.correctAction, 0);

    // Absent, not `undefined`: these entries are written straight to
    // Firestore, which rejects undefined field values outright.
    expect('remediation' in log).toBe(false);
    expect('mode' in log).toBe(false);
    expect('sourceLevelId' in log).toBe(false);
    expect('support' in log).toBe(false);
    expect(Object.values(log).every(value => value !== undefined)).toBe(true);
  });

  it('records the marker and the source level for an injected event', () => {
    const injected = { ...stopEvent, remediation: true as const, remediationSourceLevelId: 3 };
    const { log } = evaluatePlayerAction(injected, 'accelerate', 0);

    expect(log.remediation).toBe(true);
    expect(log.sourceLevelId).toBe(3);
    // The timing mode is gone: nothing new ever writes it.
    expect('mode' in log).toBe(false);
    // Still graded exactly as before - provenance is recorded alongside the
    // verdict, it does not change it.
    expect(log.result).toBe('violation');
    expect(Object.values(log).every(value => value !== undefined)).toBe(true);
  });

  it('claims no source level for injected content that was not stamped with one', () => {
    const { log } = evaluatePlayerAction({ ...stopEvent, remediation: true }, stopEvent.correctAction, 0);
    // No source level was stamped, so none is claimed - rather than a wrong one.
    expect('sourceLevelId' in log).toBe(false);
  });
});

// The support level a scenario was presented at, recorded with its decision so
// the evidence can be read against how much of the answer was on screen.
describe('evaluatePlayerAction records the support level, and grades without it', () => {
  it('records the level it is given, and nothing when it is given none', () => {
    for (const support of ['full', 'cue', 'none'] as const) {
      expect(evaluatePlayerAction(stopEvent, stopEvent.correctAction, 0, undefined, support).log.support).toBe(support);
    }
    expect('support' in evaluatePlayerAction(stopEvent, stopEvent.correctAction, 0).log).toBe(false);
  });

  it('gives the same verdict, points and message at every level', () => {
    for (const action of ['stop', 'accelerate']) {
      // Everything but the recorded level itself, and the clock.
      const graded = (support: 'full' | 'cue' | 'none') => {
        const result = evaluatePlayerAction(stopEvent, action, 0, undefined, support);
        return { ...result, log: { ...result.log, support: undefined, timestamp: 0 } };
      };
      expect(graded('cue')).toEqual(graded('full'));
      expect(graded('none')).toEqual(graded('full'));
    }
  });
});

// The whole path the prerequisite exists to make legible, with nothing faked
// in the middle: a weak learner's history -> selectPractice's choice ->
// buildLevelConfig's appended event -> the graded ActionLog. Each half is
// already covered on its own; the point here is that the choice's metadata
// survives the hand-off into the log, which is where it used to be dropped.
describe('an adaptive choice survives into the log it produces', () => {
  const gradedLog = (competency: DrivingCompetency, result: ActionLog['result']): ActionLog => ({
    timestamp: 0,
    action: 'brake',
    result,
    points: result === 'correct' ? 10 : -10,
    competency,
  });

  it('carries competency and source level from PracticeChoice into ActionLog', () => {
    const history = [
      ...COMPETENCIES.filter(c => c !== 'road_signs').flatMap(c => [gradedLog(c, 'correct'), gradedLog(c, 'correct')]),
      gradedLog('road_signs', 'violation'),
      gradedLog('road_signs', 'violation'),
    ];

    const choice = selectPractice(history, 8, createRng(1))!;
    expect(choice).not.toBeNull();

    const level = buildLevelConfig(8, undefined, null, undefined, choice.variant)!;
    const appended = level.events.at(-1)!;
    expect(appended.id).toBe(choice.variant.id);

    const { log } = evaluatePlayerAction(appended, appended.correctAction, 0);

    expect(log.remediation).toBe(true);
    expect(log.competency).toBe(choice.competency);
    expect(log.sourceLevelId).toBe(choice.sourceLevelId);
    // The level it was played in is not the level it came from - which is the
    // entire distinction the inspector reads back.
    expect(log.sourceLevelId).not.toBe(8);
  });

  it('marks only the injected event, not the level\'s own events around it', () => {
    const history = [
      ...COMPETENCIES.filter(c => c !== 'road_signs').flatMap(c => [gradedLog(c, 'correct'), gradedLog(c, 'correct')]),
      gradedLog('road_signs', 'violation'),
      gradedLog('road_signs', 'violation'),
    ];
    const choice = selectPractice(history, 8, createRng(1))!;
    const level = buildLevelConfig(8, undefined, null, undefined, choice.variant)!;

    const marked = level.events
      .map(event => evaluatePlayerAction(event, event.correctAction, 0).log)
      .filter(log => log.remediation);

    expect(marked).toHaveLength(1);
  });
});
