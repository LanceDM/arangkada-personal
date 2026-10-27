// Tests for the simulated learner and the reward that scores a practice
// decision. These pin the properties the reward redesign depends on - the ones
// that decide whether `weakest`, `related`, and `review` each have a pathway to
// being the right answer.
import { describe, it, expect } from 'vitest';
import { COMPETENCIES, createLearnerProfile } from '@/domain/learner/profile';
import { relatedCompetencies } from '@/domain/learner/adaptive/relatedness';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { latencyBucket, NOMINAL_APPROACH_MS } from '@/domain/learner/adaptive/qLearningPolicy';
import { recentLatencies } from '@/domain/learner/adaptive/recentLatencies';
import { timeNeededFor, observedLatencyMs } from './practiceLearnerModel';
import { unaidedSuccess, observedSuccess, supportGainMultiplier, learningEfficiency, windowTransfer, timePressureOf, skillGain, applyPractice, meanTrueSkill, minBelievedMastery, minTrueSkill, readinessReward, REWARD_MODELS, COMMITTED_EFFECT_SIZES, OPTIMAL_SUCCESS, RELATED_TRANSFER, RETENTION_DECAY, RETENTION_WEIGHT, type LearnerModel, type SkillVector, } from './practiceLearnerModel';

const flatSkill = (value: number): SkillVector =>
  COMPETENCIES.reduce((s, c) => { s[c] = value; return s; }, {} as SkillVector);

/** Support that changes nothing about learning, so a test can look at the other terms alone. */
const NEUTRAL: LearnerModel = { effects: COMMITTED_EFFECT_SIZES, supportGain: { betaNovice: 0, betaExpert: 0 } };
/** A support gain of the shape calibration produces: helps the weak, gets in the way of the strong. */
const REVERSING = { betaNovice: 2, betaExpert: 2 };

describe('desirable difficulty', () => {
  it('peaks at the optimal success probability', () => {
    const peak = learningEfficiency(OPTIMAL_SUCCESS);
    expect(peak).toBeCloseTo(1, 6);
    expect(learningEfficiency(OPTIMAL_SUCCESS - 0.3)).toBeLessThan(peak);
    expect(learningEfficiency(OPTIMAL_SUCCESS + 0.2)).toBeLessThan(peak);
  });

  it('teaches little at both extremes, which is what stops "always easier"', () => {
    // A near-certain success and a near-hopeless attempt are both poor practice.
    expect(learningEfficiency(0.99)).toBeLessThan(0.5);
    expect(learningEfficiency(0.05)).toBeLessThan(0.1);
  });

  it('costs a learner short of time some of their unaided chance, and only then', () => {
    // A wider window only helps a learner who was actually short of time.
    expect(unaidedSuccess(0.5, timePressureOf(0, 0.75))).toBeLessThan(unaidedSuccess(0.5, timePressureOf(0, 1.5)));
    expect(unaidedSuccess(0.5, timePressureOf(1, 0.75))).toBe(unaidedSuccess(0.5, timePressureOf(1, 1.5)));
  });
});

describe('what the screen shows (an assumption about this game)', () => {
  it('raises the observed chance of a correct answer with more support, and none adds nothing', () => {
    const unaided = 0.3;
    expect(observedSuccess(unaided, 'none')).toBe(unaided);
    expect(observedSuccess(unaided, 'cue')).toBeGreaterThan(unaided);
    expect(observedSuccess(unaided, 'full')).toBeGreaterThan(observedSuccess(unaided, 'cue'));
  });

  it('makes up half of a failing chance at full, and a quarter at cue', () => {
    expect(observedSuccess(0.2, 'full')).toBeCloseTo(0.2 + 0.8 * 0.5, 12);
    expect(observedSuccess(0.2, 'cue')).toBeCloseTo(0.2 + 0.8 * 0.25, 12);
  });
});

describe('what support does to learning (the expertise reversal effect)', () => {
  it('helps a novice learn from full support and gets in the way of an expert', () => {
    expect(supportGainMultiplier('full', 0.2, REVERSING)).toBeGreaterThan(supportGainMultiplier('none', 0.2, REVERSING));
    expect(supportGainMultiplier('full', 0.9, REVERSING)).toBeLessThan(supportGainMultiplier('none', 0.9, REVERSING));
  });

  it('leaves cue neutral and never teaches less than nothing', () => {
    for (const skill of [0, 0.3, 0.7, 1]) expect(supportGainMultiplier('cue', skill, REVERSING)).toBe(1);
    const steep = { betaNovice: 20, betaExpert: 20 };
    expect(supportGainMultiplier('none', 0, steep)).toBe(0);
    expect(supportGainMultiplier('full', 1, steep)).toBe(0);
  });

  it('carries the multiplier into what an attempt contributes', () => {
    const model: LearnerModel = { effects: COMMITTED_EFFECT_SIZES, supportGain: REVERSING };
    expect(skillGain(true, OPTIMAL_SUCCESS, 1, 'full', 0.2, model)).toBeGreaterThan(skillGain(true, OPTIMAL_SUCCESS, 1, 'none', 0.2, model));
    expect(skillGain(true, OPTIMAL_SUCCESS, 1, 'full', 0.9, model)).toBeLessThan(skillGain(true, OPTIMAL_SUCCESS, 1, 'none', 0.9, model));
  });
});

describe('scaffolding transfer penalty', () => {
  it('charges only for widening past baseline', () => {
    expect(windowTransfer(0.75)).toBe(1);
    expect(windowTransfer(1)).toBe(1);
    expect(windowTransfer(1.5)).toBeLessThan(1);
  });

  it('makes a widened window worth less than the same attempt at baseline', () => {
    // Same success probability, different amount of help behind it.
    expect(skillGain(true, OPTIMAL_SUCCESS, 1.5, 'cue', 0.5, NEUTRAL)).toBeLessThan(skillGain(true, OPTIMAL_SUCCESS, 1, 'cue', 0.5, NEUTRAL));
  });

  it('still values a correct answer above an incorrect one', () => {
    expect(skillGain(true, OPTIMAL_SUCCESS, 1, 'cue', 0.5, NEUTRAL)).toBeGreaterThan(skillGain(false, OPTIMAL_SUCCESS, 1, 'cue', 0.5, NEUTRAL));
  });
});

describe('practice spreads and unpractised skill decays', () => {
  // `lane_discipline` has curriculum relatives; picking one with edges is the
  // point of the test, so assert that up front rather than relying on it.
  const target: DrivingCompetency = 'lane_discipline';
  const relatives = relatedCompetencies(target);

  it('has a target with curriculum relatives to spread to', () => {
    expect(relatives.length).toBeGreaterThan(0);
  });

  it('raises the target most, its relatives less, and decays the rest', () => {
    const skill = flatSkill(0.5);
    applyPractice(skill, target, 0.2, 1);

    const untouched = COMPETENCIES.filter(c => c !== target && !relatives.includes(c));
    expect(skill[target]).toBeGreaterThan(0.5);
    for (const r of relatives) {
      expect(skill[r]).toBeGreaterThan(0.5);
      expect(skill[r]).toBeLessThan(skill[target]);
    }
    for (const c of untouched) expect(skill[c]).toBeCloseTo(0.5 * (1 - RETENTION_DECAY), 10);
  });

  it('spreads to relatives in proportion to RELATED_TRANSFER', () => {
    const skill = flatSkill(0.5);
    applyPractice(skill, target, 0.2, 1);
    const targetDelta = skill[target] - 0.5;
    const relativeDelta = skill[relatives[0]] - 0.5;
    expect(relativeDelta / targetDelta).toBeCloseTo(RELATED_TRANSFER, 6);
  });

  /** The mechanism `review` exists to counter: skill rots when left alone. */
  it('lets an unexercised competency decay toward nothing over many entries', () => {
    const skill = flatSkill(0.8);
    for (let i = 0; i < 40; i++) applyPractice(skill, target, 0.2, 1);
    const untouched = COMPETENCIES.find(c => c !== target && !relatives.includes(c))!;
    expect(skill[untouched]).toBeLessThan(0.8);
    // ...but not so fast that the world is decay-dominated. See the calibration
    // note on RETENTION_DECAY: at 0.02 mean skill fell under every policy.
    expect(skill[untouched]).toBeGreaterThan(0.5);
  });
});

describe('the reward measures overall readiness, not the chosen competency', () => {
  it('responds to improvement anywhere in the syllabus', () => {
    // Both terms move even though nothing is said about which competency it was.
    expect(readinessReward({ believedBefore: 40, believedAfter: 45, trueBefore: 30, trueAfter: 30 }))
      .toBeGreaterThan(0);
    expect(readinessReward({ believedBefore: 40, believedAfter: 40, trueBefore: 30, trueAfter: 35 }))
      .toBeGreaterThan(0);
  });

  /**
   * The `related` pathway: curriculum transfer raises true skill without
   * producing any BKT observation, because nothing was tested. A reward that
   * only read believed mastery would score this as worthless.
   */
  it('credits unobserved skill gained through transfer', () => {
    const reward = readinessReward({ believedBefore: 50, believedAfter: 50, trueBefore: 40, trueAfter: 44 });
    expect(reward).toBeCloseTo(4 * RETENTION_WEIGHT, 6);
    expect(reward).toBeGreaterThan(0);
  });

  /**
   * The `review` pathway: reviewing a decayed competency reveals the rot, so
   * believed mastery *falls* even as real skill is restored. Under a
   * belief-only reward this is punished; the retention term is what lets it pay.
   */
  it('can reward a decision that lowers believed mastery but restores real skill', () => {
    const beliefOnly = 45 - 50; // BKT drops when the rot is revealed
    expect(beliefOnly).toBeLessThan(0);
    const reward = readinessReward({ believedBefore: 50, believedAfter: 45, trueBefore: 30, trueAfter: 40 });
    expect(reward).toBeGreaterThan(0);
  });

  it('weights believed and true readiness on the same scale', () => {
    expect(meanTrueSkill(flatSkill(0.6))).toBeCloseTo(60, 6);
  });
});

/**
 * The second study's repair: the policy is judged on weakest-competency
 * readiness, so it is trained on the weakest competency. Only the aggregator
 * changes - both terms, both scales and the whole-syllabus scope are the
 * mean reward's.
 */
describe('the weakest-link reward', () => {
  const profileWith = (scores: Partial<Record<DrivingCompetency, number>>) => {
    const profile = createLearnerProfile();
    for (const competency of COMPETENCIES) profile[competency].score = scores[competency] ?? 60;
    return profile;
  };
  const floor = COMPETENCIES[3];
  const other = COMPETENCIES[7];

  it('reads the lowest believed score, and the lowest true skill on the same scale', () => {
    expect(minBelievedMastery(profileWith({ [floor]: 20 }))).toBe(20);
    const skill = flatSkill(0.6);
    skill[floor] = 0.15;
    expect(minTrueSkill(skill)).toBeCloseTo(15, 6);
  });

  it('is the mean reward with one term swapped, and nothing else', () => {
    const mean = REWARD_MODELS['mean-readiness'];
    const weakest = REWARD_MODELS['weakest-link'];
    const flat = flatSkill(0.5);
    // Where every competency is level, the floor and the mean are the same
    // number, so the two rewards can only differ through the aggregator.
    expect(weakest.trueSkill(flat)).toBeCloseTo(mean.trueSkill(flat), 10);
    expect(weakest.believed(profileWith({}))).toBe(mean.believed(profileWith({})));
  });

  it('ignores a gain that leaves the floor where it was, which the mean reward pays for', () => {
    const before = flatSkill(0.5);
    before[floor] = 0.1;
    const after = { ...before, [other]: 0.9 };
    const mean = REWARD_MODELS['mean-readiness'];
    const weakest = REWARD_MODELS['weakest-link'];

    expect(mean.trueSkill(after) - mean.trueSkill(before)).toBeGreaterThan(0);
    expect(weakest.trueSkill(after) - weakest.trueSkill(before)).toBe(0);
  });

  it('pays for raising the floor, and for stopping it from falling', () => {
    const before = flatSkill(0.5);
    before[floor] = 0.1;
    const weakest = REWARD_MODELS['weakest-link'];

    const raised = { ...before, [floor]: 0.2 };
    expect(weakest.trueSkill(raised) - weakest.trueSkill(before)).toBeCloseTo(10, 6);

    // Decay elsewhere is invisible until it reaches the floor - which is the
    // limitation the experiment records, not a defect of the arithmetic.
    const decayed = { ...before, [other]: 0.5 * (1 - RETENTION_DECAY) };
    expect(weakest.trueSkill(decayed) - weakest.trueSkill(before)).toBe(0);
    const decayedFloor = { ...before, [floor]: 0.1 * (1 - RETENTION_DECAY) };
    expect(weakest.trueSkill(decayedFloor) - weakest.trueSkill(before)).toBeLessThan(0);
  });
});

describe('the learner model makes a window worth adapting', () => {
  it('has a slower learner need more approach time', () => {
    expect(timeNeededFor(0)).toBeGreaterThan(timeNeededFor(1));
  });

  it('leaves a fast learner under no pressure at any window in range', () => {
    for (const scale of [0.75, 1, 1.5]) expect(timePressureOf(1, scale)).toBe(0);
  });

  it('relieves a slow learner as the window widens', () => {
    expect(timePressureOf(0, 1.5)).toBeLessThan(timePressureOf(0, 1));
    expect(timePressureOf(0, 1)).toBeLessThan(timePressureOf(0, 0.75));
  });

  it('makes widening help a slow learner more than a fast one', () => {
    // Without this asymmetry one theta is best for everyone, which is exactly
    // what the first experiment measured.
    const slowGain = unaidedSuccess(0.5, timePressureOf(0, 1.5)) - unaidedSuccess(0.5, timePressureOf(0, 1));
    const fastGain = unaidedSuccess(0.5, timePressureOf(1, 1.5)) - unaidedSuccess(0.5, timePressureOf(1, 1));
    expect(slowGain).toBeGreaterThan(fastGain);
    expect(fastGain).toBe(0);
  });

  it('records no time when the window closes first, as the game does', () => {
    // The slowest learner needs 1.6 standard approaches: no window the policy
    // offers is enough, so nothing is ever timed for them - and the game reads
    // that as slow rather than as the window's edge, which looked average.
    expect(observedLatencyMs(0, 0.75, NOMINAL_APPROACH_MS)).toBeNull();
    expect(observedLatencyMs(0, 1.5, NOMINAL_APPROACH_MS)).toBeNull();
    expect(latencyBucket(recentLatencies([{ timestamp: 0, action: 'sim', result: 'violation', points: 0, reactionCensored: true }]))).toBe('slow');
  });

  it('times a learner the window was long enough for, at their own pace', () => {
    // The fastest learner needs 0.6 of a standard approach, so any window does.
    const narrow = observedLatencyMs(1, 0.75, NOMINAL_APPROACH_MS);
    const wide = observedLatencyMs(1, 1.5, NOMINAL_APPROACH_MS);
    expect(narrow).toBeCloseTo(0.6 * NOMINAL_APPROACH_MS, 6);
    expect(wide).toBe(narrow);
    expect(latencyBucket([narrow as number])).toBe('steady');
  });
});
