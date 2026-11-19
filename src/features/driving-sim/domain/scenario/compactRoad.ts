/**
 * A course drive's road, closed up round the scenarios it was given
 * (2026-11-16).
 *
 * A stage's road is authored with a slot every so often, and a course drive
 * stands a scenario in only the slots its competencies need. The rest used to
 * stay on the road as empty stretches: 30 to 50 seconds of driving with
 * nothing to do between two scenarios. The drive is decided before it starts,
 * so the road can be cut to fit it: each stretch an unused slot leaves is cut
 * out, and everything past it (scenarios, paint, roadside, fixtures, the road's
 * end) moves back by the length cut. What is left between two scenarios is the
 * stage's own closest authored spacing.
 */
import type { LevelConfig } from './scenarioDefinition';
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';

/** A stretch of road taken out: `length` units from `from`. */
export interface RoadCut {
  from: number;
  length: number;
}

/** Where a point of the old road lands on the cut one. A point inside a cut lands where the cut began. */
export const afterCuts = (cuts: readonly RoadCut[], distance: number): number => {
  let removed = 0;
  for (const cut of cuts) {
    if (distance <= cut.from) break;
    if (distance < cut.from + cut.length) return cut.from - removed;
    removed += cut.length;
  }
  return distance - removed;
};

/**
 * The cuts that close up a road whose slots stand at `distances` when only
 * the slots in `used` hold a scenario: between two used slots with unused ones
 * between them, before the first used slot, and after the last. Each cut sits
 * in the middle of its stretch, so the scenarios either side keep their
 * approach and their run-out.
 */
export const cutsFor = (distances: readonly number[], used: ReadonlySet<number>): RoadCut[] => {
  const sorted = distances.map((at, slot) => ({ at, slot })).sort((a, b) => a.at - b.at);
  const gaps = sorted.slice(1).map((entry, i) => entry.at - sorted[i].at);
  if (gaps.length === 0) return [];
  const spacing = Math.min(...gaps);
  const chosen = sorted.filter(entry => used.has(entry.slot));
  if (chosen.length === 0) return [];
  const cuts: RoadCut[] = [];

  // Before the first: it stands where the first slot did.
  const lead = chosen[0].at - sorted[0].at;
  if (lead > 0) cuts.push({ from: chosen[0].at - spacing / 2 - lead, length: lead });

  // Between two scenarios with unused slots between them. A long gap between
  // two neighbouring slots is the road's own (an exit ramp, a toll approach)
  // and stays: only the stretch the unused slots took is cut, down to the
  // spacing the road already had either side of them.
  for (let i = 1; i < chosen.length; i++) {
    const unused = sorted.filter(entry => entry.at > chosen[i - 1].at && entry.at < chosen[i].at);
    if (unused.length === 0) continue;
    const stops = [chosen[i - 1], ...unused, chosen[i]];
    const own = Math.min(...stops.slice(1).map((entry, k) => entry.at - stops[k].at));
    const gap = chosen[i].at - chosen[i - 1].at;
    const length = gap - Math.max(spacing, own);
    if (length > 0) cuts.push({ from: (chosen[i - 1].at + chosen[i].at) / 2 - length / 2, length });
  }

  // After the last: the road ends as far past it as it did past the last slot.
  const trail = sorted[sorted.length - 1].at - chosen[chosen.length - 1].at;
  if (trail > 0) cuts.push({ from: chosen[chosen.length - 1].at + spacing / 2, length: trail });

  return cuts.filter(cut => cut.from >= 0).sort((a, b) => a.from - b.from);
};

/**
 * The cuts that leave every scenario on the road whole: a cut is shortened to
 * end before the next scenario is announced, and dropped if nothing is left of
 * it. Only empty road goes.
 */
export const safeCuts = (level: LevelConfig, cuts: readonly RoadCut[]): RoadCut[] =>
  cuts
    .map(cut => {
      const end = level.events
        .filter(event => event.triggerAtDistance > cut.from)
        .reduce(
          (soonest, event) => Math.min(soonest, event.triggerAtDistance - (event.warningDistance ?? WARNING_ZONE_ENTER)),
          cut.from + cut.length
        );
      return { from: cut.from, length: end - cut.from };
    })
    .filter(cut => cut.length >= MIN_CUT);

/** A cut shorter than this is not worth moving the road for. */
const MIN_CUT = 50;

/** The level with `cuts` taken out of its road. */
export const withCuts = (level: LevelConfig, cuts: readonly RoadCut[]): LevelConfig => {
  if (cuts.length === 0) return level;
  const at = (distance: number) => afterCuts(cuts, distance);
  const span = <T extends { from: number; to: number }>(s: T): T => ({ ...s, from: at(s.from), to: at(s.to) });
  return {
    ...level,
    roadLength: at(level.roadLength),
    // An expressway exit names the road point it is committed at: it moves with the road.
    events: level.events.map(event => ({
      ...event,
      triggerAtDistance: at(event.triggerAtDistance),
      ...(event.maneuver?.commitAt !== undefined ? { maneuver: { ...event.maneuver, commitAt: at(event.maneuver.commitAt) } } : {}),
    })),
    ...(level.paint ? { paint: { ...level.paint, spans: level.paint.spans.map(span).filter(s => s.to > s.from) } } : {}),
    ...(level.route
      ? {
          route: {
            ...level.route,
            segments: level.route.segments
              .map(segment => {
                const moved = span(segment);
                const separator = segment.auxiliary?.separator;
                return separator && moved.auxiliary
                  ? { ...moved, auxiliary: { ...moved.auxiliary, separator: span(separator) } }
                  : moved;
              })
              .filter(segment => segment.to > segment.from),
            ...(level.route.fixtures ? { fixtures: level.route.fixtures.map(fixture => ({ ...fixture, at: at(fixture.at) })) } : {}),
          },
        }
      : {}),
  };
};
