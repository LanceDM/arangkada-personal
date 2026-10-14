/**
 * The longitudinal line a scenario is driven along, and the stretch of road a
 * level paints it over.
 *
 * A line the driver may not cross is a rule only where the road carries it. A
 * level with fixed scenarios paints its lines in its `paint`, beside the slots
 * they belong to. Where the route is rolled, the line has to come with the
 * scenario: Level 4's markings, the lines Level 12 borrows, and a practice
 * item appended to another level (`withRemediation`). It is read from what
 * each scenario declares - a `marking` whose art is a line, or a `roadLine` -
 * and never from its id or its prose.
 */
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { ScenarioEvent } from './scenarioDefinition';
import type { LongitudinalArt, RoadMarkingArt, RoadPaintSpan } from './scenarioScene';

/**
 * The markings the carriageway itself carries, as opposed to the ones that sit
 * at a point on it. These are painted by the road renderer along the route,
 * not drawn as an event, which is what stops a stretch of double yellow from
 * appearing on top of the dashes that were already there.
 */
const LONGITUDINAL_ARTS: ReadonlySet<RoadMarkingArt> = new Set<LongitudinalArt>([
  'centre_line',
  'lane_line',
  'double_solid_yellow',
  'single_solid_yellow',
  'solid_yellow_broken_white',
  'broken_white_solid_yellow',
  'broken_yellow',
  'broken_and_solid_yellow',
  'edge_line',
  'cats_eye',
  'bus_puj_lane_line',
  'bus_lane',
  'bicycle_lane',
  'motorcycle_lane',
]);

export const isLongitudinal = (art: RoadMarkingArt): art is LongitudinalArt => LONGITUDINAL_ARTS.has(art);

/** The line a scenario declares the road carries through it, or null for none. */
export const declaredLine = (event: Pick<ScenarioEvent, 'marking' | 'roadLine'>): LongitudinalArt | null => {
  const art = event.marking?.art;
  if (art && isLongitudinal(art)) return art;
  return event.roadLine ?? null;
};

/**
 * How far before a scenario's graded stretch opens its line starts.
 *
 * The road leaves 26 units blank either side of a change of paint
 * (`roadRenderer`), so a line that started exactly where grading does would be
 * blank on the first frames graded. 40 is the margin Level 10 gives its own
 * double yellow for the same reason.
 */
const LINE_LEAD_IN = 40;

/** How far past the scenario's point the line runs on: Level 4's reach. */
const LINE_RUN_ON = 260;

/**
 * The spans a route's declared lines are painted over.
 *
 * Each one covers the whole stretch its scenario is graded on, because a
 * strict lane requirement fails a crossing on any frame of it: from the
 * scenario's authored lead (the graded zone is that lead, or shorter where the
 * road before it is short) back past the blank a change of paint leaves, to a
 * run-on past its point.
 */
export const declaredLineSpans = (events: readonly ScenarioEvent[]): RoadPaintSpan[] =>
  events.flatMap(event => {
    const art = declaredLine(event);
    if (!art) return [];
    const lead = event.warningDistance ?? WARNING_ZONE_ENTER;
    return [
      {
        from: event.triggerAtDistance - lead - LINE_LEAD_IN,
        to: event.triggerAtDistance + LINE_RUN_ON,
        art,
      },
    ];
  });
