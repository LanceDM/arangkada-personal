/**
 * The final exam never puts a vehicle into a driver who is answering it
 * correctly (T-0001's first final, 2026-11-17: "the ambulance hit me
 * instantly", just after the flagged-down traffic stop).
 *
 * - An ambulance closing from behind comes up the lane it asks the driver to
 *   leave, never the lane the scenario asks the driver to move into, even when
 *   the car is already in that lane at the lock (`chaseLaneFor`).
 * - Over many seeds, neither the final exam's roll nor the course's draw of it
 *   is crashed by the reference driver, which answers every scenario correctly.
 */
import { describe, expect, it } from 'vitest';
import { chaseLaneFor } from '@/features/driving-sim/domain/systems/driveVehicle';
import { resolveLaneRole } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { SLOTS } from '@/features/driving-sim/domain/scenario/content/levels/level12';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { courseDriveFor, rollFor } from './timeLimitMeasurement';
import { driveReference } from './referenceDrive';

const ONCOMING = 2;
const CURB = resolveLaneRole('curb', ONCOMING);
const INNER = resolveLaneRole('inner', ONCOMING);
const ambulances = SLOTS.flat().filter(variant => variant.npc?.path === 'closing_from_behind') as ScenarioEvent[];

describe("the final exam's ambulance", () => {
  it('is one the exam can roll', () => {
    expect(ambulances.map(variant => variant.id)).toContain('level5.emergency-yield.ambulance-behind');
  });

  it('never comes up the lane the scenario asks the driver to move into', () => {
    for (const event of ambulances) {
      const wanted = event.requiredLane ? resolveLaneRole(event.requiredLane.lane, ONCOMING) : null;
      for (const carLane of [INNER, CURB]) {
        const lane = chaseLaneFor(event, carLane, ONCOMING);
        if (wanted !== null) expect(lane, `${event.id} from lane ${carLane}`).not.toBe(wanted);
        else expect(lane, `${event.id} from lane ${carLane}`).toBe(carLane);
      }
    }
  });

  it('still comes up the lane the car is in when that is the lane to leave', () => {
    const behind = ambulances.find(variant => variant.id === 'level5.emergency-yield.ambulance-behind')!;
    expect(chaseLaneFor(behind, INNER, ONCOMING)).toBe(INNER);
  });
});

describe('the final exam, driven correctly', () => {
  it('ends in no collision on any of 60 rolls or 60 course draws', () => {
    const crashed: string[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      for (const [kind, level] of [['roll', rollFor(12, seed)], ['course', courseDriveFor(12, seed)!]] as const) {
        const result = driveReference(level);
        if (result.crash || !result.finished) crashed.push(`${kind} ${seed}: ${result.crash ?? 'did not finish'}`);
      }
    }
    expect(crashed).toEqual([]);
  }, 600_000);
});
