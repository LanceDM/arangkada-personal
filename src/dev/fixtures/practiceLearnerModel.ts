// The simulated learner the practice policy is trained against, and the reward
// that scores a practice decision.
//
// Extracted from the training script so the reward is a testable artifact
// rather than a block of arithmetic buried in a one-shot job. Nothing here runs
// in production: this is the model of a learner, not a learner.
//
// The four ideas it encodes, and why each is here:
//
//  1. Desirable difficulty. An attempt teaches most when it is just within
//     reach. A trivially easy success confirms what is already known; an
//     impossible one yields no usable signal. Without this the model made
//     easier strictly better at everything, and the trained table collapsed to
//     a near-constant policy that never once chose a harder setting.
//  2. Scaffolding transfers imperfectly. A widened reaction window is help, and
//     skill built behind it is worth less at exam timing - which is the cost
//     that stops "always widen" from being free.
//  3. Competencies are not independent. Practising one lifts its curriculum
//     relatives a little, and anything left alone decays a little. These are
//     the two mechanisms `related` and `review` exist to exploit; without them
//     those actions had nothing to do and could never be worth choosing.
//  4. Support has two effects, kept apart. What the screen shows raises the
//     chance of a correct answer (an assumption about this game's own screens), and
//     it changes how much an attempt teaches, in opposite directions for a
//     novice and an expert - the expertise reversal effect, calibrated to a
//     published meta-analysis rather than chosen. The pre-registered experiment
//     protocol fixed all of this before any run.
import type { DrivingCompetency, SupportLevel } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { relatedCompetencies } from '@/domain/learner/adaptive/relatedness';
import type { LearnerProfile } from '@/domain/learner/competency';

/**
 * The expertise reversal effect the simulated learner is calibrated to
 * reproduce: the standardized difference in a learning outcome measured after
 * instruction, high-assistance minus low-assistance instruction.
 *
 * Tetzlaff, L., Simonsmeier, B. A., Peters, T., & Brod, G. (2025). A
 * cornerstone of adaptivity - A meta-analysis of the expertise reversal effect.
 * Learning and Instruction, 98, 102142. Section 7.2, p. 6:
 *   low prior knowledge   d =  0.505, 95% CI [0.260, 0.750], k = 88, j = 60
 *   high prior knowledge  d = -0.428, 95% CI [-0.647, -0.209], k = 88, j = 60
 */
export const PUBLISHED_EXPERTISE_REVERSAL = { dNovice: 0.505, dExpert: -0.428 } as const;

/**
 * An assumption: how often a learner who would fail unaided gets the answer
 * right because the screen showed them the move. `cue` shows where to look,
 * not the move, and is taken at half of `full`. Specific to this game's
 * screens; not a literature value.
 */
export const ASSIST_FULL = 0.5;

/**
 * The effect sizes the h and theta claims rest on - the ones the sensitivity
 * analysis halves and doubles, one at a time. Everything else in the model is
 * fixed.
 */
export interface EffectSizes {
  /** Expertise reversal, novices: high minus low assistance (published). */
  dNovice: number;
  /** Expertise reversal, experts: high minus low assistance (published). */
  dExpert: number;
  /** What `full` adds to a failing learner's chance; `cue` adds half. */
  assistFull: number;
  /** How much time pressure moves the chance of a correct answer. */
  timePressureChallenge: number;
  /** How much of a widened window's practice fails to transfer to baseline timing. */
  transferPenalty: number;
}

/**
 * How support scales what an attempt teaches: `k(s) = betaNovice*(1 - s) -
 * betaExpert*s`, positive for a novice (support helps) and negative for an
 * expert (it gets in the way). Not chosen: calibrated so the simulator
 * reproduces the effect sizes above (`calibrateSupportGain`, in the
 * simulation environment).
 */
export interface SupportGain {
  betaNovice: number;
  betaExpert: number;
}

/** One version of the simulated learner: its effect sizes, and the support gain calibrated to them. */
export interface LearnerModel {
  effects: EffectSizes;
  supportGain: SupportGain;
}

/**
 * How much time pressure moves the demand of an attempt.
 *
 * This replaced a uniform `(1 - windowScale)` term, and the replacement was
 * forced by measurement rather than preference. Under the uniform term a wider
 * window helped every learner by the same amount, so one theta was best for the
 * whole population - and the baseline-vs-adaptive experiment duly found a
 * policy statistically indistinguishable from pinning theta at 1.5. A window is
 * only worth adapting if learners differ in how much they need it, so the
 * window's benefit is now a function of the learner's own reaction speed.
 */
export const TIME_PRESSURE_CHALLENGE = 0.6;

/**
 * How much approach time a learner needs, as a multiple of a standard approach.
 *
 * The range deliberately straddles theta's own range (0.75 to 1.5): a slow
 * learner needs more time than even the widest window gives, a fast one needs
 * less than the narrowest. That is the neutral choice - had the range sat
 * entirely inside theta's, every learner would be comfortable at every setting
 * and theta would not matter; had it sat entirely outside, theta would be
 * saturated for everyone. Straddling is what makes the choice real without
 * dictating which way it should go.
 */
export const SLOW_TIME_NEED = 1.6;
export const FAST_TIME_NEED = 0.6;
/** How strongly demand moves the chance of a correct answer. */
export const CHALLENGE_SUCCESS_SHIFT = 0.25;
/** The success probability at which an attempt teaches the most. */
export const OPTIMAL_SUCCESS = 0.75;
/** How sharply learning efficiency falls away from that optimum. */
export const LEARNING_SIGMA = 0.18;
/** How much of a widened window's practice fails to transfer to baseline timing. */
export const TRANSFER_PENALTY = 0.5;

/** The effect sizes as committed: the literature's for h, and the model's own for theta and the screen. */
export const COMMITTED_EFFECT_SIZES: EffectSizes = {
  ...PUBLISHED_EXPERTISE_REVERSAL,
  assistFull: ASSIST_FULL,
  timePressureChallenge: TIME_PRESSURE_CHALLENGE,
  transferPenalty: TRANSFER_PENALTY,
};

/**
 * How much of an attempt's gain spills to the practised competency's curriculum
 * relatives. The edges come from `relatedness.ts`, which is derived from
 * the curriculum's Traceability Matrix - a row assigning one LTO topic to two
 * levels is that document's own statement that the knowledge is reinforced in
 * both, so partial transfer is the curriculum's claim, not a new assumption.
 */
export const RELATED_TRANSFER = 0.35;
/**
 * How much unexercised skill is lost per level entry. Calibrated rather than
 * guessed: at 0.02 the world was decay-dominated (mean true skill *fell* over an
 * episode under every policy, so the simulation described forgetting faster than
 * learning, which is not a study period). At 0.005 a sensible policy ends above
 * where it started while forgetting still bites. Re-check it against the
 * experiment's true-skill outcomes, which are where each condition ends;
 * learners start at a mean of 25.
 */
export const RETENTION_DECAY = 0.005;
/**
 * How the reward weights true retention against believed mastery.
 *
 * Both terms are on the same 0-100 scale and both measure readiness, so they are
 * weighted equally: discounting real skill relative to believed skill would say
 * the belief matters more than the thing it is a belief about. It also matters
 * mechanically - curriculum transfer raises true skill without producing any BKT
 * observation, because nothing was tested, so a discounted retention term would
 * undervalue `related` for a measurement reason rather than a pedagogical one.
 */
export const RETENTION_WEIGHT = 1;

export type SkillVector = Record<DrivingCompetency, number>;

/** How much approach time this learner needs, from their latent reaction speed. */
export const timeNeededFor = (reactionSpeed: number): number =>
  SLOW_TIME_NEED - reactionSpeed * (SLOW_TIME_NEED - FAST_TIME_NEED);

/** How far short of what they need the window falls. Zero when there is enough time. */
export const timePressureOf = (reactionSpeed: number, windowScale: number): number =>
  Math.max(0, timeNeededFor(reactionSpeed) - windowScale);

/**
 * The chance of a correct answer from the learner's own knowledge: their skill,
 * less what being given too little time costs them. This is what the final exam
 * asks for - no support, theta 1 - and what an attempt's difficulty is read
 * from.
 */
export const unaidedSuccess = (
  skill: number,
  timePressure: number,
  effects: EffectSizes = COMMITTED_EFFECT_SIZES
): number =>
  Math.max(0.02, Math.min(0.98, skill - timePressure * effects.timePressureChallenge * CHALLENGE_SUCCESS_SHIFT));

/** How much of the rest the screen makes up at each support level. */
export const assistOf = (support: SupportLevel, effects: EffectSizes = COMMITTED_EFFECT_SIZES): number =>
  support === 'full' ? effects.assistFull : support === 'cue' ? effects.assistFull / 2 : 0;

/** The chance of a correct answer as the game observes it, with what the screen showed. */
export const observedSuccess = (
  unaided: number,
  support: SupportLevel,
  effects: EffectSizes = COMMITTED_EFFECT_SIZES
): number => unaided + (1 - unaided) * assistOf(support, effects);

/**
 * How support scales what an attempt teaches a learner at `skill` in the
 * practised competency (the model's assumptions): `full` by `1 + k`, `none` by
 * `1 - k`, `cue` not at all, never below nothing. k is linear in skill and
 * crosses zero where support stops helping.
 */
export const supportGainMultiplier = (support: SupportLevel, skill: number, gain: SupportGain): number => {
  const k = gain.betaNovice * (1 - skill) - gain.betaExpert * skill;
  return support === 'full' ? Math.max(0, 1 + k) : support === 'none' ? Math.max(0, 1 - k) : 1;
};

/**
 * What the game would record about this decision's response speed: the time
 * the learner took, or `null` when the window closed before they responded.
 *
 * Mirrors the game's censoring. A response is timed when it comes;
 * a window that closes first records no time, and the decision is stored as
 * censored, which the latency bucket reads as slow. Timing the window's own
 * edge instead - as this model once did, and the game with it - made a slow
 * learner given a narrow window look merely average.
 */
export const observedLatencyMs = (
  reactionSpeed: number,
  windowScale: number,
  nominalApproachMs: number,
  jitter = 1
): number | null => {
  const needed = timeNeededFor(reactionSpeed);
  return needed > windowScale ? null : needed * nominalApproachMs * jitter;
};

/** Peaks at OPTIMAL_SUCCESS: both "too easy" and "too hard" teach little. */
export const learningEfficiency = (successProb: number): number =>
  Math.exp(-((successProb - OPTIMAL_SUCCESS) ** 2) / (2 * LEARNING_SIGMA ** 2));

/** Scaffolded practice transfers imperfectly; a window at or below baseline is free. */
export const windowTransfer = (windowScale: number, effects: EffectSizes = COMMITTED_EFFECT_SIZES): number =>
  windowScale <= 1 ? 1 : Math.max(0, 1 - (windowScale - 1) * effects.transferPenalty);

/**
 * What one attempt contributes, before the learner's own learning rate.
 *
 * Its difficulty is read from the unaided chance - desirable difficulty is
 * about the learner's own effort, not about how much the screen gave away -
 * while a correct answer, however it came, is still the better feedback.
 * `skill` is the practised competency's, before the attempt.
 */
export const skillGain = (
  correct: boolean,
  unaided: number,
  windowScale: number,
  support: SupportLevel,
  skill: number,
  model: LearnerModel
): number =>
  (correct ? 1 : 0.3) *
  learningEfficiency(unaided) *
  windowTransfer(windowScale, model.effects) *
  supportGainMultiplier(support, skill, model.supportGain);

/**
 * Applies one practice attempt in place: the target improves, its curriculum
 * relatives improve less, and everything untouched decays.
 */
/** One competency's skill after an attempt that contributed `gain`: it closes part of the gap to 1. */
export const learnedFrom = (skill: number, learningRate: number, gain: number): number =>
  skill + learningRate * (1 - skill) * gain;

export const applyPractice = (
  skill: SkillVector,
  target: DrivingCompetency,
  learningRate: number,
  gain: number
): void => {
  skill[target] = learnedFrom(skill[target], learningRate, gain);

  const relatives = relatedCompetencies(target);
  for (const relative of relatives) {
    skill[relative] = learnedFrom(skill[relative], learningRate, gain * RELATED_TRANSFER);
  }

  const exercised = new Set<DrivingCompetency>([target, ...relatives]);
  for (const competency of COMPETENCIES) {
    if (exercised.has(competency)) continue;
    skill[competency] *= 1 - RETENTION_DECAY;
  }
};

/** Believed mastery, averaged over the whole syllabus - what the game acts on. */
export const meanBelievedMastery = (profile: LearnerProfile): number =>
  COMPETENCIES.reduce((sum, c) => sum + profile[c].score, 0) / COMPETENCIES.length;

/** True retained skill, averaged and put on the same 0-100 scale as BKT. */
export const meanTrueSkill = (skill: SkillVector): number =>
  (COMPETENCIES.reduce((sum, c) => sum + skill[c], 0) / COMPETENCIES.length) * 100;

/**
 * The weakest competency's believed mastery: the floor of the syllabus, as the
 * observer sees it. This is the quantity the practice gate and the Q-state's
 * mastery bucket already read.
 */
export const minBelievedMastery = (profile: LearnerProfile): number =>
  COMPETENCIES.reduce((lowest, c) => Math.min(lowest, profile[c].score), Infinity);

/**
 * The floor of true retained skill, on the same 0-100 scale as BKT.
 *
 * Not the primary outcome itself. The outcome is
 * `100*clamp(skill - pressure*0.15, 0.02, 0.98)` at theta 1, with `pressure` a
 * constant of the learner, so the two move together wherever the clamp is
 * slack - and the clamp binds for exactly the learners whose floor is lowest,
 * where a reward read off it would be silent. The reward reads the unclamped
 * floor; the outcome keeps the clamp.
 */
export const minTrueSkill = (skill: SkillVector): number =>
  COMPETENCIES.reduce((lowest, c) => Math.min(lowest, skill[c]), Infinity) * 100;

/**
 * What a practice decision was worth: what the learner gained in believed
 * readiness, plus what they gained in real retained skill.
 *
 * Always scoped to the whole syllabus rather than to the competency that
 * happened to be chosen, because a target-scoped reward is structurally biased
 * - BKT headroom is largest where mastery is lowest, so `weakest` won
 * mechanically and the other targets were unreachable whatever they did. Which
 * *aggregator* reads the syllabus is the protocol's choice, below.
 *
 * The retention term is what makes forgetting visible at all: BKT is a belief
 * updated only by observation, so it cannot see decay in a competency nobody is
 * practising. Under a BKT-only reward, preventing forgetting is unobservable -
 * reviewing a decayed competency in fact scores *negative* believed-mastery
 * change, because it reveals the rot.
 */
export const readinessReward = (args: {
  believedBefore: number;
  believedAfter: number;
  trueBefore: number;
  trueAfter: number;
}): number =>
  (args.believedAfter - args.believedBefore) +
  RETENTION_WEIGHT * (args.trueAfter - args.trueBefore);

/**
 * Which reward a training run uses.
 *
 * `mean-readiness` is the first study's, kept so it stays runnable exactly as
 * it was published. `weakest-link` is the second's: the same two terms over
 * the same syllabus, aggregated by the minimum instead of the mean, so the
 * policy is trained on the quantity the experiment judges it by -
 * weakest-competency readiness. The first study trained on the mean and judged
 * the floor, and reported the mismatch as a limitation; that is the defect the
 * second repairs.
 */
export type RewardKind = 'mean-readiness' | 'weakest-link';

/** How one reward reads the syllabus: the two terms `readinessReward` combines. */
export interface RewardModel {
  believed: (profile: LearnerProfile) => number;
  trueSkill: (skill: SkillVector) => number;
}

export const REWARD_MODELS: Record<RewardKind, RewardModel> = {
  'mean-readiness': { believed: meanBelievedMastery, trueSkill: meanTrueSkill },
  'weakest-link': { believed: minBelievedMastery, trueSkill: minTrueSkill },
};
