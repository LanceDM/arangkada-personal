import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { pickForCoverage, plateName, type SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { buildEvents, filterByWeakCompetency } from '@/features/driving-sim/domain/scenario/pooling';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { LongitudinalArt } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { declaredLineSpans } from '@/features/driving-sim/domain/scenario/roadLine';
import { SLOTS } from './pools';

const levelModule = getLevelModule(4);

/**
 * A marking-reading drive, rebuilt on every attempt.
 *
 * Level 3 asks what is standing beside the road. This one asks what is painted
 * under the wheels, which is a different skill and a harder one: a sign is an
 * object you either saw or did not, while a marking is continuous, and reading
 * it correctly is inseparable from where you put the car.
 *
 * The route keeps the beats the module's own "Scenario" section describes — a
 * stop line with a pedestrian lane behind it, a yellow box, a bus lane, a bike
 * lane and a motorcycle lane — and widens each into a slot covering its whole
 * marking family, so every official category in the module has somewhere in the
 * drive it can appear. Each slot draws a different marking every run, so
 * replaying is a fresh reading test rather than a memorised key sequence. Pool
 * contents live in ./pools - this file is just how a roll becomes a playable
 * level.
 *
 * Every marking carries the module's own image, from the same folder and under
 * the same filename the module's reference tables use, so the plate a learner
 * revises from and the plate they are shown while driving are the same picture.
 * `MarkingPlateCard` still draws the marking from its `art` as a fallback, which
 * is what keeps a missing or renamed file from blanking the one thing the
 * question is about.
 */

/**
 * Slots sit at least 800 apart. A marking runs along the road rather than
 * standing at a point, so two of them any closer would be painted over each
 * other.
 */
export const SLOT_DISTANCES = [840, 1640, 2600, 3400, 4200];

/**
 * The carriageway Level 4 is driven on: four lanes, the left two carrying
 * opposing traffic.
 *
 * This is what makes the whole longitudinal family mean anything. A centre line
 * with nothing on the other side of it separates nobody, and "no overtaking"
 * on a one-way road forbids a manoeuvre that carries no risk. With opposing
 * lanes, passing a slow vehicle genuinely means crossing into traffic coming
 * the other way — which is the reason the line is painted the colour it is.
 *
 * An even two-by-two split, rather than the lopsided one-and-two this used to
 * be. On three lanes a two-way road can only ever give one side more room than
 * the other, and a driver cannot tell by looking which side is theirs; with the
 * split down the middle the centre line is where it looks like it should be.
 *
 * The left half is not yours. Nothing in this level may require it, which is
 * why every lane requirement here names `inner` or `curb` — roles that resolve
 * within your own half — rather than an absolute lane.
 */
const ONCOMING_LANES = 2;

/**
 * What the road carries where no marking governs it. A solid white centre line
 * is the neutral case the module describes — crossing it takes special care and
 * is discouraged — so every span the level paints is a visible departure from
 * it rather than more of the same.
 */
const BASE_PAINT: LongitudinalArt = 'centre_line';

/** Every marking this level can show, for measuring how much of it has been met. */
export const level4MarkingNames = (): string[] =>
  [...new Set(SLOTS.flat().map(plateName).filter((name): name is string => Boolean(name)))];

/**
 * Fixed parts of the drive. Every roll is worth 110 points: 20 each for the
 * longitudinal, lane-position and reserved-lane slots, and 25 each for the two
 * slots where a marking read wrongly puts the vehicle somewhere it physically
 * should not be — inside a junction it cannot clear, or past the point it
 * should already have stopped at.
 *
 * Unlike Level 3, the pass mark here cannot be set above a pure-braking ceiling,
 * because for a large family of markings slowing down genuinely is the right
 * answer — a rumble strip and a give-way line are not asking for anything else.
 * What holds the line instead is lane position: the lane-position slot always
 * rolls a variant carrying `requiredLane`, the reserved-lane slot always does
 * too, and the longitudinal slot does whenever it rolls one of the prohibitive
 * lines, so braking through the level from the wrong lane fails those slots
 * regardless of which key was pressed. Reading the marking and steering on it
 * are the same act here, which is the competency the level is for.
 */
const level4Base = {
  id: 4,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Five slots at least 800 apart, with a runway after the last one long
  // enough for its marking to fully clear before the road ends.
  roadLength: 4600,
  speedLimit: 50,
  requiredScore: 76,
  stars2: 91,
  stars3: 105,
} as const;

/**
 * Assembles a rolled route into a playable level, paint and all. Exported for
 * the dev tools that stage events by hand, so a staged route is painted the way
 * a roll of it would be.
 */
export const assembleLevel4 = (events: ScenarioEvent[]): LevelConfig => ({
  ...level4Base,
  events,
  paint: {
    oncomingLanes: ONCOMING_LANES,
    base: BASE_PAINT,
    // Derived from the events rather than authored separately, so the stretch
    // of double yellow and the question about it can never drift apart. Each
    // marking is painted from 40 before its graded zone opens (400 before its
    // point) to 260 past it, because a lane rule is graded on every frame of
    // the zone (`declaredLineSpans`). Slots 800 apart still leave 100 of the
    // base line between one marking and the next, so the road is seen to go
    // back to normal before it changes again.
    spans: declaredLineSpans(events),
  },
});

/**
 * A fresh roll of the drive: one marking from each slot's pool.
 *
 * Given a coverage record the slots are filled by what the learner still needs —
 * unseen markings first, then ones they have been getting wrong — so replaying
 * works through the syllabus instead of resampling the same handful. Without one
 * it falls back to an even random draw. A weakCompetency further narrows each
 * slot's pool to variants tagged with that competency before coverage picks
 * within it - a no-op for slots whose pool is entirely one competency.
 */
export const createLevel4 = (
  coverage?: SignCoverage,
  weakCompetency?: DrivingCompetency | null,
  rng: () => number = Math.random
): LevelConfig =>
  assembleLevel4(buildEvents(SLOTS, SLOT_DISTANCES, pool => {
    const scoped = filterByWeakCompetency(pool, weakCompetency ?? null);
    return coverage
      ? pickForCoverage(scoped, coverage, rng)
      : scoped[Math.floor(rng() * scoped.length)];
  }));

/**
 * Stable version of the level used for the level map, briefing and results,
 * where the metadata matters and the specific markings do not. The played drive
 * comes from `createLevel4()` instead.
 */
export const level4: LevelConfig = assembleLevel4(buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]));
