/**
 * What the car did, and what it was supposed to do, in words.
 *
 * Two questions the screen asks after every graded decision, and they need two
 * different grammars. What happened is reported in the past — "you kept going",
 * "you came to a full stop" — while what was wanted is reported as the thing
 * itself: "this one wanted a full stop". Running one list of past-tense phrases
 * through both is what produced "you should have came to a full stop" on the
 * mission panel and "Wrong Lane instead of Brake" on the result card.
 *
 * Kept here rather than in either component because both ask, and a second copy
 * is how the two would come to disagree about what `slow` is called.
 */
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

/**
 * Every graded action, as the past tense of what the driver did.
 *
 * The list has to cover the manoeuvre grades as well as the six pedals-and-
 * wheel ones, because the fallback is `action.replace(/_/g, ' ')` and that
 * turned "too_slow" into the sentence "You too slow". A verdict a player cannot
 * read is a verdict that teaches nothing.
 */
const HAPPENED: Record<string, string> = {
  brake: 'slowed down',
  stop: 'came to a full stop',
  accelerate: 'kept going',
  turn_left: 'steered left',
  turn_right: 'steered right',
  honk: 'used the horn',
  // What the telemetry grader names a driver who came off the power without
  // touching the brake — a real, separate action from braking.
  slow: 'eased off',
  // Merging.
  never_merged: 'stayed on the acceleration lane',
  too_slow: 'joined below the minimum speed',
  unsafe_gap: 'joined without a safe gap',
  // Overtaking.
  undertake: 'passed on the wrong side',
  no_overtake: 'never passed',
  cut_in: 'cut back in too soon',
  incomplete_overtake: 'pulled out without completing the pass',
  held_passing_lane: 'held the passing lane',
  // Following, steadiness, speed and lane.
  too_close: 'followed too closely',
  drifted: 'wandered across the lane',
  braked_hard: 'stood on the brake',
  too_fast: 'carried too much speed',
  wrong_lane: 'was in the wrong lane',
};

/**
 * What a scenario asked for, as a thing rather than as something that happened.
 *
 * Six entries and no more, because `expectedAction` is always the event's own
 * `correctAction` — the derived failure verbs above are things a driver can do,
 * never things a scenario can ask for.
 */
const WANTED: Record<ScenarioEvent['correctAction'], string> = {
  brake: 'you to slow down',
  stop: 'a full stop',
  accelerate: 'you to carry on',
  turn_left: 'a left turn',
  turn_right: 'a right turn',
  honk: 'the horn',
};

/** What the car did, in the past tense, for "You …". */
export const actionLabel = (action: string): string =>
  HAPPENED[action] ?? action.replace(/_/g, ' ');

/** What the scenario asked for, for "this one wanted …". */
export const expectedLabel = (action: string): string =>
  WANTED[action as ScenarioEvent['correctAction']] ?? actionLabel(action);
