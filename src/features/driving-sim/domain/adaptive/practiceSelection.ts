// The adaptive selector: given everything the learner has ever done, decide
// what single extra scenario (if any) the level they are about to play should
// carry, how much of the answer its scenarios show, and how much room the
// machine gives them.
//
// Three decisions, one policy. BKT still answers "is this learner weak at
// anything" (the gate below); once that's yes, the learner policy's trained
// Q-table answers "what should they practise" (their weakest competency, a
// curriculum-related one, or a review of something they've already mastered),
// "how much support should the level show" (h, what the machine outputs while
// a scenario is presented) and "how early may the approach open" (the window
// shift that becomes the FSM's theta) as one joint decision, rather than
// independent rules that can't see each other. h and theta are both
// level-wide: they govern every scenario in the level, not only the injected
// one.
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency, LearnerProfile, SupportLevel } from '@/domain/learner/competency';
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { LEVELS, level12 } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { TUTORIAL_LEVEL_ID } from '@/features/driving-sim/domain/systems/tutorial';
import { remediationCandidates, type RemediationCandidate } from '@/features/driving-sim/domain/scenario/remediationPool';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { getLowestScoringCompetency, type WeakestTieBreak } from '@/domain/learner/profile';
import { resolveTarget } from '@/domain/learner/adaptive/resolveTarget';
import { relatedCompetencies } from '@/domain/learner/adaptive/relatedness';
import { recentLatencies } from '@/domain/learner/adaptive/recentLatencies';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { lookupPolicy, masteryBucket, performanceBucket, latencyBucket, actionKey, WINDOW_SCALE, type PolicyLookup, type QAction, type QState, } from '@/domain/learner/adaptive/qLearningPolicy';
import { DEFAULT_TRANSITION_PARAMS, type TransitionParams } from '@/features/driving-sim/domain/fsm/fsmTypes';

/**
 * tau: the BKT score below which a competency still counts as weak - the gate
 * on adapting a level at all, the line `review` counts as mastered, the
 * pre-level weak-area hint and the live re-roll.
 *
 * 85, by the pre-registered rule of the latest tau sweep, which is the same
 * rule that earlier moved it from the hand-picked 70 to 50. Read what this
 * result means before moving it again.
 *
 * Under the retrained policy the gate never closes: no simulated learner
 * reached tau at any value in 50-90, so tau no longer decides how much of a
 * learner's history is adapted, as it once did. What the sweep measured is which policy the
 * training happened to land on at each tau - 85 and 75 found a policy that
 * spreads practice across the syllabus, and the other seven found one that
 * concentrates it. 85 won by that accident, not by being a better threshold.
 *
 * It is also 85 in a game where the adaptive policy lost to no adaptation at
 * all, on the outcome both experiments declared primary, under every seed. At
 * 85 almost every competency counts as weak, so the weak-area hint and the
 * live re-roll now fire for nearly every learner. Both facts are synthetic,
 * and neither is evidence about real players. Whether the runtime should keep
 * the adaptive policy at all is the developers' open decision; tau
 * belongs with it.
 */
export const MASTERY_THRESHOLD = 85;

/**
 * The final exam. Nothing about it adapts - not what it shows, not when its
 * approaches open, not what is appended to it - because it is the same test
 * for every learner. Read off the level itself, so the two cannot
 * drift apart.
 */
export const FINAL_EXAM_LEVEL_ID = level12.id;

/** Graded (correct/violation) attempts at one competency, oldest first. */
const gradedAttempts = (logs: readonly ActionLog[], competency: DrivingCompetency): ActionLog[] =>
  logs.filter(log => log.competency === competency && (log.result === 'correct' || log.result === 'violation'));

const RECENT_WINDOW = 3;

export interface PracticeChoice {
  /** Ready to place: carries `remediation: true` and the level it was borrowed from, still needs a distance. */
  variant: SlotVariant;
  /** The competency actually being practised - may differ from the weakest one (a related stand-in, or a review pick). */
  competency: DrivingCompetency;
  weakestCompetency: DrivingCompetency;
  /**
   * The support level h this decision selected - the half of the policy's
   * action that sets what the machine shows while a scenario is presented. It
   * governs every scenario in the level, not just the injected one; read it
   * through `levelSupport`, which holds the levels that never adapt.
   */
  support: SupportLevel;
  /** Which level this scenario was originally written for. */
  sourceLevelId: number;
  /**
   * The FSM transition-guard parameters this decision selected - the half of
   * the policy's action that reaches the machine itself rather than the
   * content. Applied via `DrivingFSM.setTransitionParams` for the whole level,
   * so it governs when every event's approach and reaction transitions fire,
   * not just the injected practice scenario's.
   */
  transitionParams: TransitionParams;
  /** The policy's raw decision, kept for dev visibility and logging. */
  action: QAction;
  state: QState;
  reason: string;
}

/**
 * What the policy decided for a learner with this history, before any content
 * is looked for: the state it read and the action it chose. Null when there is
 * no history, or nothing is below the mastery threshold - no state is read at
 * all then.
 *
 * Kept apart from finding content because the two can disagree: the policy can
 * choose, and the level still be played on the baseline machine because
 * nothing portable was found. The level entry records the decision either way.
 */
export interface PracticeDecision {
  profile: LearnerProfile;
  weakest: DrivingCompetency;
  weakestScore: number;
  state: QState;
  lookup: PolicyLookup;
}

/**
 * The Q-state read for a learner whose weakest competency is `weakest`: its
 * mastery bucket, the learner's recent form on it, and their response latency
 * over `logs`, the chronological history `profile` was built from.
 *
 * Exported for the offline simulation, which folds BKT rather than replaying
 * it and reads the state through this
 * for any tie-break but the one its folded observer applies.
 */
export const practiceState = (
  profile: LearnerProfile,
  logs: readonly ActionLog[],
  weakest: DrivingCompetency
): QState => {
  const recent = gradedAttempts(logs, weakest).slice(-RECENT_WINDOW).map(log => log.result === 'correct');
  return `${masteryBucket(profile[weakest].score)}:${performanceBucket(recent)}:${latencyBucket(recentLatencies(logs))}`;
};

/**
 * `tieBreak` decides the weakest competency among tied scores. Omitted, it is
 * `list-order`, the rule the earlier studies ran under; the game passes
 * `GAME_OPTIONS.weakestTieBreak` (adaptiveOptions.ts).
 */
export const decidePractice = (
  logs: ActionLog[],
  tieBreak: WeakestTieBreak = 'list-order'
): PracticeDecision | null => {
  if (logs.length === 0) return null;

  const profile = buildBKTLearnerProfile(logs);
  const weakest = getLowestScoringCompetency(profile, tieBreak);
  const weakestScore = profile[weakest].score;
  if (weakestScore >= MASTERY_THRESHOLD) return null;

  const state = practiceState(profile, logs, weakest);
  return { profile, weakest, weakestScore, state, lookup: lookupPolicy(state) };
};

/**
 * The one practice scenario to add to this level's run, or `null` when
 * nothing is currently below the mastery threshold - a level played exactly
 * as authored, which is the right outcome for a learner not currently weak at
 * anything.
 *
 * Asked about any level, the final exam included: the post-level suggestion
 * after Level 12 is still worth making. What stops the exam itself adapting is
 * `adaptsLevel`, at the level entry.
 *
 * `onRoute` defaults to empty - "this level is asking nothing yet" - which is
 * right for the post-level suggestion, which only reads which competency came
 * back. A caller that is about to append to a rolled route passes that route's
 * ids, and `buildAdaptivePlan` is the one that does.
 */
export const selectPractice = (
  logs: ActionLog[],
  currentLevelId: number,
  rng: () => number = Math.random,
  onRoute: ReadonlySet<string> = new Set(),
  tieBreak: WeakestTieBreak = 'list-order'
): PracticeChoice | null => practiceFor(decidePractice(logs, tieBreak), currentLevelId, rng, onRoute);

/**
 * One portable scenario teaching `competency` that a route at `levelId` holding
 * `onRoute` can take, or null where there is none - in which case no number is
 * drawn. `practiceFor` makes this draw for each competency of its chain in
 * turn, and the routing FSM's `+ practice(c)` makes it for c alone
 * (`routingContent.ts`), so one rule places every practice item.
 *
 * Drawn as if the route were not consulted, and drawn again only when the draw
 * lands on something already being driven. Both draws come from the attempt's
 * practice stream, and the result is still uniform over what can be placed -
 * 1/n + (m/n)(1/(n-m)) = 1/(n-m) - so the rule costs an attempt whose pick was
 * placeable nothing: it keeps the scenario its seed already gave it, and only
 * the attempts that were appending nothing move.
 */
export const drawPractice = (
  competency: DrivingCompetency,
  levelId: number,
  rng: () => number,
  onRoute: ReadonlySet<string>
): RemediationCandidate | null => {
  const candidates = remediationCandidates(competency, levelId);
  if (candidates.length === 0) return null;

  const placeable = candidates.filter(candidate => !onRoute.has(candidate.variant.id));
  if (placeable.length === 0) return null;

  const drawn = candidates[Math.floor(rng() * candidates.length)];
  return onRoute.has(drawn.variant.id) ? placeable[Math.floor(rng() * placeable.length)] : drawn;
};

/** A drawn candidate marked as the appended practice item it becomes, carrying the level it was borrowed from. */
export const asPracticeItem = (candidate: RemediationCandidate): SlotVariant => ({
  ...candidate.variant,
  remediation: true,
  remediationSourceLevelId: candidate.levelId,
});

/**
 * The content a decision resolves to at this level, or null where nothing
 * portable exists.
 *
 * `onRoute` is what this attempt is already driving. A candidate whose id is
 * on it is not practice: `withRemediation` refuses to place a scenario the
 * route already holds, so picking one appended nothing while the level was
 * still played at the policy's h and theta, and the attempt's record named an
 * injected scenario that never existed. A competency whose every
 * candidate is already on the route is therefore passed over exactly as an
 * empty one is, and the chain falls through to the next.
 */
export const practiceFor = (
  decision: PracticeDecision | null,
  currentLevelId: number,
  rng: () => number,
  onRoute: ReadonlySet<string>
): PracticeChoice | null => {
  if (!decision) return null;
  const { profile, weakest, weakestScore, state } = decision;
  const { action } = decision.lookup;

  const primary = resolveTarget(action.target, weakest, profile, MASTERY_THRESHOLD);
  // Always fall through to the weakest competency and its curriculum
  // relatives so a learner still gets *something* even when the policy's
  // preferred target has no portable content at this level - the same
  // reliability guarantee the first selector made.
  const chain = [primary, weakest, ...relatedCompetencies(weakest)].filter(
    (competency, index, all) => all.indexOf(competency) === index
  );

  for (const competency of chain) {
    const picked = drawPractice(competency, currentLevelId, rng, onRoute);
    if (!picked) continue;
    const isStandIn = competency !== weakest;

    return {
      variant: asPracticeItem(picked),
      competency,
      weakestCompetency: weakest,
      support: action.support,
      transitionParams: { ...DEFAULT_TRANSITION_PARAMS, approachScale: WINDOW_SCALE[action.window] },
      sourceLevelId: picked.levelId,
      action,
      state,
      reason: isStandIn
        ? `Q-learning chose ${actionKey(action)} for state ${state}; ${weakest} (${weakestScore}) has no portable content left to place here, so ${competency} was used as a curriculum-related stand-in. Support ${action.support}, approach window x${WINDOW_SCALE[action.window]}.`
        : `Q-learning chose ${actionKey(action)} for state ${state}; practising ${weakest} at ${weakestScore}, support ${action.support}, approach window x${WINDOW_SCALE[action.window]}.`,
    };
  }

  return null;
};

/**
 * Whether the adaptive layer may act on an entry into this level at all. The
 * final exam is the one level it may not: no practice appended, theta at its
 * baseline, and a fixed support level (`levelSupport`).
 */
export const adaptsLevel = (levelId: number): boolean => levelId !== FINAL_EXAM_LEVEL_ID;

/**
 * The support level h a level entry is played at.
 *
 * - The tutorial always shows the move: its instructor panel is the lesson.
 * - The final exam never does, for every learner.
 * - Otherwise it is the policy's choice. Where the policy chose nothing - no
 *   history yet, nothing below the mastery threshold, or no portable practice
 *   content - the level is played on the baseline machine, full support at
 *   theta 1, exactly as `transitionParams` falls back to its default.
 */
export const levelSupport = (levelId: number, choice: PracticeChoice | null): SupportLevel => {
  if (levelId === TUTORIAL_LEVEL_ID) return 'full';
  if (levelId === FINAL_EXAM_LEVEL_ID) return 'none';
  return choice?.support ?? 'full';
};

/**
 * Which competencies a level's events actually exercise, resolved the same
 * way the rule engine resolves them at play time. Used only to point a
 * post-level "practice this" suggestion at a level that genuinely teaches the
 * target competency, rather than guessing from a level's name or prose.
 *
 * Exported for the offline simulation, whose test holds the competencies it
 * plays to this resolution.
 */
export const levelCompetencies =(level: LevelConfig): Set<DrivingCompetency> => {
  const competencies = new Set<DrivingCompetency>();
  for (const event of level.events) {
    competencies.add(evaluateWeightedRule(event, event.correctAction, 0).trace.competency);
  }
  return competencies;
};

export interface LevelRecommendation {
  action: 'advance' | 'practice';
  recommendedLevelId: number | null;
  competency?: DrivingCompetency;
  reason: string;
}

/**
 * Turns a player's full cross-level history into a post-level suggestion.
 * Suggest-only: the player always keeps Next/Retry as their own choice.
 * Reuses `selectPractice` rather than a separate rule, so there is exactly
 * one place that decides "does this learner need practice, and on what".
 */
export const getLevelRecommendation = (
  allLogs: ActionLog[],
  currentLevelId: number,
  tieBreak: WeakestTieBreak = 'list-order'
): LevelRecommendation => {
  const choice = selectPractice(allLogs, currentLevelId, Math.random, new Set(), tieBreak);
  if (!choice) {
    return { action: 'advance', recommendedLevelId: null, reason: 'No competency currently below the mastery threshold.' };
  }

  const match = LEVELS.find(level => levelCompetencies(level).has(choice.competency));
  if (!match) {
    return { action: 'advance', recommendedLevelId: null, reason: 'No dedicated practice level found; continuing the curriculum.' };
  }

  return { action: 'practice', recommendedLevelId: match.id, competency: choice.competency, reason: choice.reason };
};
