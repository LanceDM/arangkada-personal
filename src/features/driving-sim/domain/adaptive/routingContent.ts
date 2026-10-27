// The routing FSM's binding to Story's content.
//
// The machine in src/domain/routing may not import this feature, so what it
// knows about the levels is measured here and handed to it as data: which
// competencies can take a practice item at the level a learner is sent to,
// against the route rolled for it, and what one play of each level is certain
// to present. The item a `+ practice(c)` transition places is drawn here too,
// by the rule every practice item is drawn by (`drawPractice`).
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import type { Outcome, PracticeAvailability, ReviewLevel, RoutingContext } from '@/domain/routing/routingTypes';
import { REVIEW_LEVELS } from '@/domain/routing/routingTypes';
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { LEVELS, getRerollableSlots } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { garageHotspotToEvent } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import { asPracticeItem, drawPractice } from './practiceSelection';

/** The competency the rule engine grades a scenario under: the one the game logs. */
const gradedCompetency = (event: Omit<ScenarioEvent, 'triggerAtDistance'>): DrivingCompetency =>
  evaluateWeightedRule({ ...event, triggerAtDistance: 0 }, event.correctAction, 0).trace.competency;

/** A level's garage and aftermath questions: asked on every play of it, whatever its roll. */
const hotspotEvents = (level: LevelConfig): ScenarioEvent[] =>
  [...(level.garage?.hotspots ?? []), ...(level.aftermath?.hotspots ?? [])].map(garageHotspotToEvent);

const idsOn = (route: LevelConfig): ReadonlySet<string> => new Set(route.events.map(event => event.id));

/**
 * The ids of `remediationCandidates(c, levelId)` for every competency. The
 * pool is static content, so each level's is read once: a simulation asks
 * after every entry.
 */
const candidateIds = new Map<number, Record<DrivingCompetency, readonly string[]>>();
const candidateIdsAt = (levelId: number): Record<DrivingCompetency, readonly string[]> => {
  let ids = candidateIds.get(levelId);
  if (!ids) {
    ids = Object.fromEntries(
      COMPETENCIES.map(c => [c, remediationCandidates(c, levelId).map(candidate => candidate.variant.id)])
    ) as Record<DrivingCompetency, string[]>;
    candidateIds.set(levelId, ids);
  }
  return ids;
};

/**
 * What practice each competency has at `levelId`, against the route rolled
 * for it: `none` where no portable scenario exists at or before the level,
 * `on-route` where every one is already on the route, else `placeable`. The
 * same test `drawPractice` makes, so a competency is placeable exactly where
 * `practiceItem` finds something.
 */
export const practiceAvailability = (
  levelId: number,
  route: LevelConfig
): Record<DrivingCompetency, PracticeAvailability> => {
  const onRoute = idsOn(route);
  const candidates = candidateIdsAt(levelId);
  return Object.fromEntries(
    COMPETENCIES.map(competency => {
      const ids = candidates[competency];
      const availability: PracticeAvailability =
        ids.length === 0 ? 'none' : ids.every(id => onRoute.has(id)) ? 'on-route' : 'placeable';
      return [competency, availability];
    })
  ) as Record<DrivingCompetency, PracticeAvailability>;
};

/**
 * The competencies one play of `levelId` is certain to present, in
 * `COMPETENCIES` order: its garage and aftermath questions, and every slot all
 * of whose variants are graded on the same competency. A level rolls one
 * variant per slot (`buildEvents`), so nothing else is certain; a level that
 * does not roll has one variant per slot, and so presents all of it.
 */
const certainlyPresented = (levelId: ReviewLevel): DrivingCompetency[] => {
  const level = LEVELS.find(candidate => candidate.id === levelId)!;
  const certain = new Set(hotspotEvents(level).map(gradedCompetency));
  const slots = getRerollableSlots(levelId)?.slots;
  if (slots) {
    for (const slot of slots) {
      const graded = new Set(slot.map(gradedCompetency));
      if (graded.size === 1) certain.add([...graded][0]);
    }
  } else {
    for (const event of level.events) certain.add(gradedCompetency(event));
  }
  return COMPETENCIES.filter(competency => certain.has(competency));
};

/** Per review level, what a review of it is certain to present: `ContentAvailability.teaches`. */
export const REVIEW_TEACHES: Readonly<Record<ReviewLevel, readonly DrivingCompetency[]>> = Object.fromEntries(
  REVIEW_LEVELS.map(level => [level, certainlyPresented(level)])
) as Record<ReviewLevel, DrivingCompetency[]>;

const NOTHING_TO_PLACE = Object.fromEntries(COMPETENCIES.map(c => [c, 'none'])) as Record<
  DrivingCompetency,
  PracticeAvailability
>;

/**
 * What the routing FSM is told after an entry: the entry's verdict, and the
 * content at the level the pass guard sends the learner to, measured against
 * the route rolled there (`destinationOf`; the roll comes first). `destination` is
 * null where the course is over and nothing is measured.
 */
export const routingContext = (
  outcome: Outcome,
  destination: { levelId: number; route: LevelConfig } | null
): RoutingContext => ({
  outcome,
  practice: destination ? practiceAvailability(destination.levelId, destination.route) : NOTHING_TO_PLACE,
  teaches: REVIEW_TEACHES,
});

/**
 * The scenario `+ practice(competency)` appends to `route` at `levelId`,
 * marked as a practice item, or null where the competency is not placeable
 * there. Drawn from the attempt's practice stream by `drawPractice`, so the
 * same competency on the same roll gets the same scenario in every arm.
 */
export const practiceItem = (
  competency: DrivingCompetency,
  levelId: number,
  route: LevelConfig,
  rng: () => number
): SlotVariant | null => {
  const picked = drawPractice(competency, levelId, rng, idsOn(route));
  return picked && asPracticeItem(picked);
};
