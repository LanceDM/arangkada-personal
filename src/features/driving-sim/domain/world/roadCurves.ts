import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { LANE_WIDTH, ROAD_EFFECT_SPAN, type CurveSpan } from './vehiclePhysics';

/**
 * A bend runs far longer than the sign that warns of it. At the sign's own span
 * the road swung a full lane across only a fifth of the screen, which read as a
 * kink in the tarmac rather than a curve, and moved sideways faster than the
 * wheel could answer. Stretched to about half a screen it sweeps, and its
 * sideways rate stays well inside what steering can hold.
 *
 * Kept short enough that a bend stays inside its own slot: level 3 spaces
 * events 750 apart, and this puts the whole bend within 640.
 */
const CURVE_SPAN_FACTOR = 4;

/**
 * How far the road swings at full strength: one lane width. Any more and the
 * sidewalk on the outside of the bend would run off the edge of the canvas.
 */
const FULL_SWING = LANE_WIDTH;

/**
 * The bends in a level, read off the same events that carry its signs — so a
 * bend warning always stands beside a road that genuinely bends, and never
 * beside one that does not.
 */
export const curvesForLevel = (level: LevelConfig): CurveSpan[] =>
  level.events
    .filter(event => event.effect?.curve)
    .map(event => ({
      at: event.triggerAtDistance,
      span: (event.effect!.span ?? ROAD_EFFECT_SPAN) * CURVE_SPAN_FACTOR,
      amount:
        FULL_SWING *
        (event.effect!.curveStrength ?? 0.9) *
        (event.effect!.curve === 'right' ? 1 : -1),
    }));
