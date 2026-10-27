/**
 * A pass gate is a progression guard, and it has to mean the same for a
 * learner who was given a practice item as for one who was not.
 *
 * The property, over every level a practice item can join and many rolls of
 * each: play the level's own decisions the same way with and without an
 * appended item, whatever the item's answer, and the pass or fail - indeed the
 * score - is the same under `neutral`. Under `upside-only`, the rule the
 * game-level simulation ran under, there are rolls where it is not: a right answer to the item
 * carries a learner over the bar the level's own decisions left them under.
 */
import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { createRng } from '@/shared/lib/rng';
import { adaptsLevel } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { attemptStream } from '@/features/driving-sim/domain/scenario/attemptSeed';
import { LEVELS, buildLevelConfig, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { evaluatePlayerAction, garageHotspotToEvent } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import { buildLevelResult } from './buildLevelResult';
import { START_SCORE, scoreDecision, type PracticeItemScoring } from './scoreDecision';

/** An act the rule engine grades wrong: the first offered choice that is, else accelerating or stopping. */
const wrongActionFor = (event: ScenarioEvent): string =>
  event.choices?.find(choice => !evaluateWeightedRule(event, choice.action, 0).isCorrect)?.action ??
  ['accelerate', 'stop'].find(action => !evaluateWeightedRule(event, action, 0).isCorrect)!;

/**
 * Plays every graded decision of `level` in the order the game meets them -
 * the garage, the road by distance, the aftermath - answering each as
 * `answers` says, and returns what the pass rule makes of it.
 */
const play = (level: LevelConfig, answers: (event: ScenarioEvent) => boolean, scoring: PracticeItemScoring) => {
  let running = START_SCORE;
  const decide = (event: ScenarioEvent) => {
    const right = event.neutral || answers(event);
    const result = evaluatePlayerAction(event, right ? event.correctAction : wrongActionFor(event), running.streak);
    running = scoreDecision(running, event, result, scoring);
  };
  for (const hotspot of level.garage?.hotspots ?? []) decide(garageHotspotToEvent(hotspot));
  for (const event of [...level.events].sort((a, b) => a.triggerAtDistance - b.triggerAtDistance)) decide(event);
  for (const hotspot of level.aftermath?.hotspots ?? []) decide(garageHotspotToEvent(hotspot));
  const result = buildLevelResult(level, { score: running.score, violations: 0, correctActions: 0, logs: [] });
  return { score: running.score, passed: result.completed };
};

const ROLLS_PER_LEVEL = 12;
const ANSWER_PATTERNS = 3;

/** Every (roll, item, answers) the property is checked over: each level that adapts, and each item it can place. */
const cases = function* () {
  for (const { id: levelId } of LEVELS.filter(level => adaptsLevel(level.id))) {
    for (let seed = 0; seed < ROLLS_PER_LEVEL; seed++) {
      const weak = seed % 2 === 0 ? null : COMPETENCIES[seed % COMPETENCIES.length];
      const rolled = buildLevelConfig(levelId, undefined, weak, attemptStream(seed, 'roll'))!;
      const onRoute = new Set(rolled.events.map(event => event.id));
      const items = COMPETENCIES.flatMap(c => remediationCandidates(c, levelId)).filter(
        candidate => !onRoute.has(candidate.variant.id)
      );
      for (const candidate of items) {
        const withItem = withRemediation(rolled, { ...candidate.variant, remediation: true, remediationSourceLevelId: candidate.levelId });
        for (let pattern = 0; pattern < ANSWER_PATTERNS; pattern++) {
          // The level's own decisions are answered alike on both routes: one
          // draw per scenario id, from a stream of the case's own.
          const rng = createRng(seed * 7919 + pattern * 104729 + levelId);
          const drawn = new Map<string, boolean>();
          const answer = (event: ScenarioEvent) => {
            if (!drawn.has(event.id)) drawn.set(event.id, rng() < 0.6);
            return drawn.get(event.id)!;
          };
          yield { levelId, rolled, withItem, answer, itemId: candidate.variant.id };
        }
      }
    }
  }
};

describe('an appended practice item and the pass mark', () => {
  it('leaves pass or fail, and the score, exactly as without it under neutral, whatever the item is answered', () => {
    let checked = 0;
    const levels = new Set<number>();
    for (const { levelId, rolled, withItem, answer, itemId } of cases()) {
      const without = play(rolled, answer, 'neutral');
      for (const itemRight of [true, false]) {
        const answered = (event: ScenarioEvent) => (event.id === itemId && event.remediation ? itemRight : answer(event));
        const played = play(withItem, answered, 'neutral');
        const where = `level ${levelId}, item ${itemId} answered ${itemRight ? 'right' : 'wrong'}`;
        expect(played.passed, where).toBe(without.passed);
        expect(played.score, where).toBe(without.score);
        checked += 1;
      }
      levels.add(levelId);
    }
    expect(checked).toBeGreaterThan(1000);
    expect(levels.size).toBeGreaterThanOrEqual(10);
  }, 60_000);

  it('can change pass or fail under upside-only, the legacy rule', () => {
    let changed = 0;
    let loweredTheBar = 0;
    for (const { rolled, withItem, answer, itemId } of cases()) {
      const without = play(rolled, answer, 'upside-only');
      for (const itemRight of [true, false]) {
        const answered = (event: ScenarioEvent) => (event.id === itemId && event.remediation ? itemRight : answer(event));
        const played = play(withItem, answered, 'upside-only');
        if (played.passed !== without.passed) changed += 1;
        if (played.passed && !without.passed) loweredTheBar += 1;
      }
    }
    expect(changed).toBeGreaterThan(0);
    expect(loweredTheBar).toBeGreaterThan(0);
  }, 60_000);
});

describe('one decision', () => {
  const item = { remediation: true as const };
  const authored = {};

  it('scores an authored decision the same under either rule', () => {
    for (const scoring of ['upside-only', 'neutral'] as const) {
      expect(scoreDecision({ score: 40, streak: 1 }, authored, { isCorrect: true, points: 15 }, scoring)).toEqual({ score: 55, streak: 0, delta: 15 });
      expect(scoreDecision({ score: 40, streak: 1 }, authored, { isCorrect: false, points: -12 }, scoring)).toEqual({ score: 28, streak: 2, delta: -12 });
      expect(scoreDecision({ score: 5, streak: 0 }, authored, { isCorrect: false, points: -12 }, scoring)).toEqual({ score: 0, streak: 1, delta: -12 });
    }
  });

  it('counts a right practice item and moves the streak on a wrong one under upside-only', () => {
    expect(scoreDecision({ score: 40, streak: 1 }, item, { isCorrect: true, points: 15 }, 'upside-only')).toEqual({ score: 55, streak: 0, delta: 15 });
    expect(scoreDecision({ score: 40, streak: 1 }, item, { isCorrect: false, points: -12 }, 'upside-only')).toEqual({ score: 40, streak: 2, delta: 0 });
  });

  it('counts a practice item for nothing, and leaves the streak where it stood, under neutral', () => {
    for (const verdict of [{ isCorrect: true, points: 15 }, { isCorrect: false, points: -12 }]) {
      expect(scoreDecision({ score: 40, streak: 1 }, item, verdict, 'neutral')).toEqual({ score: 40, streak: 1, delta: 0 });
    }
  });

  it('does not advance the streak on a standing penalty', () => {
    expect(scoreDecision({ score: 40, streak: 2 }, authored, { isCorrect: false, points: -3 }, 'neutral', true)).toEqual({ score: 37, streak: 2, delta: -3 });
  });
});
