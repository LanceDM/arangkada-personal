// Every scenario variant in the game, indexed by competency, filtered down to
// the ones that can safely be played somewhere other than where they were
// written.
//
// This is what makes cross-level remediation possible without authoring a
// single new scenario: all thirteen level files already export `SLOTS` in the
// same shape, and every event in them already carries a `competency` tag, so
// "give this learner more pedestrian practice" is a query over content that
// exists rather than a commission for content that does not.
//
// The filter below is the whole risk surface. A level's events are written
// against that level's road, and some of them cannot be lifted off it.

import type { DrivingCompetency } from '@/domain/learner/competency';
import type { SlotVariant } from './pooling';
import { SLOTS as level1Slots } from '@/features/driving-sim/domain/scenario/content/levels/level1';
import { SLOTS as level2Slots } from '@/features/driving-sim/domain/scenario/content/levels/level2';
import { SLOTS as level3Slots } from '@/features/driving-sim/domain/scenario/content/levels/level3/pools';
import { SLOTS as level4Slots } from '@/features/driving-sim/domain/scenario/content/levels/level4/pools';
import { SLOTS as level5Slots } from '@/features/driving-sim/domain/scenario/content/levels/level5';
import { SLOTS as level6Slots } from '@/features/driving-sim/domain/scenario/content/levels/level6';
import { SLOTS as level7Slots } from '@/features/driving-sim/domain/scenario/content/levels/level7';
import { SLOTS as level8Slots } from '@/features/driving-sim/domain/scenario/content/levels/level8';
import { SLOTS as level9Slots } from '@/features/driving-sim/domain/scenario/content/levels/level9';
import { SLOTS as level10Slots } from '@/features/driving-sim/domain/scenario/content/levels/level10';
import { SLOTS as level11Slots } from '@/features/driving-sim/domain/scenario/content/levels/level11';

/**
 * Level 0 is deliberately absent. The tutorial's events are graded by their own
 * path in the drive loop (`getTutorialCompletedAction`, `isTutorialLevel`) and
 * score against teaching the controls rather than against a driving competency,
 * so one of them dropped into a real level would be graded by rules that do not
 * apply to it.
 *
 * Level 12 is absent for a different reason: it is the final assessment, and it
 * now assembles its own route by drawing from this index (see `level12.ts`).
 * Listing it here would be circular in both senses - a literal import cycle,
 * and pedagogically, since the content a learner meets *as the exam* is not the
 * practice you hand them beforehand.
 */
const LEVEL_SLOTS: Record<number, SlotVariant[][]> = {
  1: level1Slots,
  2: level2Slots,
  3: level3Slots,
  4: level4Slots,
  5: level5Slots,
  6: level6Slots,
  7: level7Slots,
  8: level8Slots,
  9: level9Slots,
  10: level10Slots,
  11: level11Slots,
};

/**
 * Whether this variant can be played in a level other than its own.
 *
 * Everything excluded here is excluded because the event depends on something
 * the host level does not necessarily have, not because it is bad content:
 *
 * - `maneuver` hands the road over. Completing a turn rewrites `car.distance`
 *   to the junction's exit and regenerates the roadside, and which lane the
 *   turn may be taken from is resolved against the *host* level's `paint`. Drop
 *   one into a level with a different carriageway layout and the turn can
 *   become impossible to position for, failing a learner for the level's
 *   geometry rather than for their driving.
 * - `bay` / `parkingCutscene` need a marked bay in the curb line, and the
 *   parking manoeuvre plays out against the bay's own side and distance.
 * - `cutscene` / `emergency` freeze the simulation and hand over to a
 *   full-screen prompt drawn for one specific situation - a crossroads diagram
 *   or a named mechanical failure. Neither is a scene the host level is
 *   guaranteed to make sense of.
 * - `neutral` is never graded wrong, so it always returns "correct" to the
 *   learner model whatever the driver did. Injecting one to gather evidence
 *   would gather evidence that is true by construction.
 * - `overtake` is a manoeuvre rather than a reading: pulling out, drawing
 *   level, getting clear and coming back takes about a thousand units of road,
 *   and a remediation event is placed at the host level's own spacing - 550 on
 *   Level 2. A pass the road is too short to complete would fail the learner
 *   for the geometry of the level it was injected into. Same argument as
 *   `maneuver`, one step further along.
 * - `scene: 'route'` stands on its own level's `RouteLayout`, which is
 *   declared on that level's config and does not travel with the variant.
 *   Appended elsewhere, the acceleration lane, the lane gantry and
 *   the toll plaza it is graded against are simply not there - and a merge
 *   with no auxiliary lane to leave is graded correct by construction, which
 *   is `neutral`'s argument.
 * - A graded `middle` lane only exists where the driver's side has three or
 *   more lanes. Wherever it has two - every level from 8 to 11 - it collapses
 *   onto `inner` (`resolveLaneRole`). "Cruise in the lane for cars" then
 *   requires the lane nearest the centre line; "keep out of the overtaking
 *   lane" then accepts it, while a vehicle that declares `inner` comes up in
 *   exactly that lane. (An NPC placed in `middle` is not a grade, and is fine.)
 * - An `avoid` that forbids only a turn, on a variant with no `maneuver`. A
 *   turn is committed only for the active event's own `maneuver`
 *   (`scanEvents`), so without one the forbidden turn cannot be taken and the
 *   prohibition is passed by construction: `neutral`'s argument again. This
 *   holds on the variant's own level too; refusing it here only keeps it from
 *   travelling.
 *
 * What is left - roadside signs, pavement markings, hazards in the carriageway,
 * checkpoint inspections, speed and following-distance judgments - is graded
 * from speed, lane and whether the vehicle stopped, all of which the telemetry
 * grader measures on any road. Each of the route-bound cases was driven on
 * the levels they were being appended to.
 */
const TURNS: ReadonlyArray<SlotVariant['correctAction']> = ['turn_left', 'turn_right'];

/** Every act it forbids is a turn, and it offers no turn that could be taken. */
const forbidsOnlyAnUnofferedTurn = (variant: SlotVariant): boolean =>
  !variant.maneuver &&
  (variant.avoid?.length ?? 0) > 0 &&
  variant.avoid!.every(action => TURNS.includes(action));

export const isPortableRemediation = (variant: SlotVariant): boolean =>
  !forbidsOnlyAnUnofferedTurn(variant) &&
  !variant.maneuver &&
  !variant.bay &&
  !variant.parkingCutscene &&
  !variant.cutscene &&
  !variant.emergency &&
  !variant.overtake &&
  !variant.neutral &&
  variant.scene !== 'route' &&
  variant.requiredLane?.lane !== 'middle';

export interface RemediationCandidate {
  /** The level this variant was written for, which is what gates its use. */
  levelId: number;
  variant: SlotVariant;
}

/**
 * Portable variants teaching `competency`, drawn from any level at or before
 * `maxLevelId`.
 *
 * The level ceiling is the curriculum's own progression rule turned into a
 * query: a learner playing Level 8 has been taught everything up to Level 8, so
 * pulling practice forward from Level 3 revisits something they have already
 * met, while pulling it back from Level 11 would test them on a module they
 * have not been given yet.
 */
export const remediationCandidates = (
  competency: DrivingCompetency,
  maxLevelId: number
): RemediationCandidate[] =>
  Object.entries(LEVEL_SLOTS)
    .map(([levelId, slots]) => ({ levelId: Number(levelId), slots }))
    .filter(({ levelId }) => levelId <= maxLevelId)
    .flatMap(({ levelId, slots }) =>
      slots
        .flat()
        .filter(variant => variant.competency === competency)
        .filter(isPortableRemediation)
        .map(variant => ({ levelId, variant }))
    );
