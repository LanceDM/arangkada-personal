/**
 * A sign stands on the verge of the road it is about — the whole road.
 *
 * On a route that opens a lane beside the through lanes, "the verge" is a lane
 * further out than it is anywhere else, and a sign placed from the through lanes
 * alone stands on tarmac. It is the same defect the crash barrier had, in the
 * one place a driver is most likely to be looking.
 */
import { describe, expect, it } from 'vitest';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SignPlate } from '@/features/driving-sim/domain/scenario/scenarioScene';
import type { EventPlacement } from '@/features/driving-sim/domain/world/eventPlacement';
import { LANE_WIDTH, ROAD_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { signSceneNodes } from './signScene';

const ROAD_X = 100;

const plate: SignPlate = {
  image: 'x.png',
  name: 'Merge Ahead',
  category: 'B. Warning Sign',
  meaning: 'The lane you are on ends ahead.',
  art: 'rect_instruction',
  glyph: 'MERGE',
};

const event = {
  id: 'test.merge',
  type: 'scenario_trigger',
  scene: 'route',
  description: 'A lane ends ahead.',
  correctAction: 'accelerate',
  points: 10,
  triggerAtDistance: 1000,
  warningDistance: 600,
  penaltyMessage: '-',
  rewardMessage: '+',
  duration: 100,
  competency: 'speed_control',
  severity: 'minor',
} as unknown as ScenarioEvent;

const placement = (): EventPlacement => ({
  event,
  index: 0,
  screenY: 300,
  roadX: ROAD_X,
  roadAt: () => ROAD_X,
  handled: false,
  runOn: false,
});

const signX = (auxiliaryWidth: number) => {
  const nodes = signSceneNodes(placement(), plate, 'route', 0, auxiliaryWidth, true);
  const sign = nodes.find((node): node is Extract<typeof node, { kind: 'sign' }> => node.kind === 'sign');
  expect(sign).toBeDefined();
  return sign!.x;
};

describe('a sign beside a route', () => {
  it('stands clear of the through lanes when that is all the road there is', () => {
    expect(signX(0)).toBeGreaterThan(ROAD_X + ROAD_WIDTH);
  });

  it('moves out by the auxiliary lane, so it is never standing on it', () => {
    const open = signX(LANE_WIDTH);
    expect(open).toBeGreaterThan(ROAD_X + ROAD_WIDTH + LANE_WIDTH);
    expect(open).toBeGreaterThan(signX(0));
  });

  it('moves back in as the lane tapers away', () => {
    expect(signX(LANE_WIDTH / 2)).toBeLessThan(signX(LANE_WIDTH));
    expect(signX(LANE_WIDTH / 2)).toBeGreaterThan(signX(0));
  });
});
