// Inserting a stretch of road into a level, for a composed drive that has to
// place scenarios on a part of the road the authored level keeps short.
//
// Everything strictly beyond `at` moves on by `by`: the events and the route
// distance an exit commits at, the route's segment ends, separators and
// fixtures, the painted spans and the road's length. Nothing at or before
// `at` moves, so a segment that spans `at` grows by `by` and keeps its kind.
// With `by` 0 the level comes back unchanged.
import type { LevelConfig, ScenarioEvent } from './scenarioDefinition';
import type { RouteLayout } from './scenarioScene';

const past = (at: number, by: number) => (distance: number): number => (distance > at ? distance + by : distance);

export const stretchEvent = (event: ScenarioEvent, at: number, by: number): ScenarioEvent => {
  const move = past(at, by);
  return {
    ...event,
    triggerAtDistance: move(event.triggerAtDistance),
    ...(event.maneuver?.commitAt !== undefined ? { maneuver: { ...event.maneuver, commitAt: move(event.maneuver.commitAt) } } : {}),
  };
};

const stretchRoute = (route: RouteLayout, at: number, by: number): RouteLayout => {
  const move = past(at, by);
  return {
    ...route,
    segments: route.segments.map(segment => ({
      ...segment,
      from: move(segment.from),
      to: move(segment.to),
      ...(segment.auxiliary
        ? {
            auxiliary: {
              ...segment.auxiliary,
              ...(segment.auxiliary.separator
                ? { separator: { ...segment.auxiliary.separator, from: move(segment.auxiliary.separator.from), to: move(segment.auxiliary.separator.to) } }
                : {}),
            },
          }
        : {}),
    })),
    ...(route.fixtures ? { fixtures: route.fixtures.map(fixture => ({ ...fixture, at: move(fixture.at) })) } : {}),
  };
};

export const stretchLevel = (level: LevelConfig, at: number, by: number): LevelConfig => {
  if (by === 0) return level;
  const move = past(at, by);
  return {
    ...level,
    events: level.events.map(event => stretchEvent(event, at, by)),
    roadLength: move(level.roadLength),
    ...(level.route ? { route: stretchRoute(level.route, at, by) } : {}),
    ...(level.paint ? { paint: { ...level.paint, spans: level.paint.spans.map(span => ({ ...span, from: move(span.from), to: move(span.to) })) } } : {}),
  };
};
