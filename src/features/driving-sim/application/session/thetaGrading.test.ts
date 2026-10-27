/**
 * Theta changes the time a driver is given, never the grade.
 *
 * What the car did at a scenario used to be
 * recorded from the frame its approach opened, and theta moves that frame, so
 * the same driving could pass at one theta and fail at another: a car that came
 * to rest 347 units short of Level 4's stop line had stopped *at* it at theta 1
 * and 1.5, and had not at 0.75, whose announcement came after the stop.
 *
 * Now the zone a scenario is graded over is fixed on the road at its baseline
 * lead and measured whether or not the approach has opened; theta moves only
 * the pause and the reaction clock. Where narrowing an approach would still
 * change what a driver can be graded on, the world reports a floor that stops
 * theta narrowing it (`computeApproachFloors`).
 *
 * Proven the only way it can be: the same driving, at every theta, earns the
 * same verdict. The drivers are functions of where the car is, never of when,
 * and each one does something before a narrowed announcement, before any but a
 * widened one, or nothing out of the ordinary at all.
 */
import { describe, expect, it } from 'vitest';
import {
  THETAS,
  cruise,
  driveScenario,
  everyScenario,
  swerveAndStopAt,
  type Driver,
} from './thetaDrives';

const DRIVERS: Array<[string, () => Driver]> = [
  ['cruising', () => cruise],
  ['swerving and stopping before a narrowed announcement', () => swerveAndStopAt(0.9)],
  ['swerving and stopping before any announcement but a widened one', () => swerveAndStopAt(1.2)],
];

describe('the same driving, at every theta', () => {
  it('earns the same verdict in every scenario the game can roll', () => {
    const differing: string[] = [];
    for (const { level, event } of everyScenario()) {
      // A jammed throttle is the one scenario whose failure is itself scoped to
      // the announcement - it starts the moment the scenario is explained, so
      // the failure and its explanation are one moment (see driveVehicle). For
      // it, theta moving the announcement *is* moving the time to recover: the
      // time given, which is what theta is for. Every other scenario is held to
      // the same verdict.
      if (event.effect?.stuckThrottle) continue;
      for (const [name, driverFor] of DRIVERS) {
        // The verdict, and every standing penalty charged on the way to it:
        // both are scored and both reach the learner model.
        const verdicts = THETAS.map(theta => {
          const drive = driveScenario(level, event, theta, driverFor());
          return [drive.outcome, ...drive.penalties].join(' + ');
        });
        if (new Set(verdicts).size > 1) {
          differing.push(`level ${level.id} ${event.id}, ${name}: ${verdicts.join(' / ')}`);
        }
      }
    }
    expect(differing).toEqual([]);
  }, 180_000);

  it('counts a stop short of the line the same whether or not it came before the announcement', () => {
    const stopLine = everyScenario().find(({ event }) => event.id === 'level4.traverse.stop-line')!;
    // Comes to rest a little inside the zone - before the 0.75 announcement,
    // after the 1 and 1.5 ones - and then drives through without stopping again.
    const stopShort = (): Driver => {
      let rested = false;
      return ({ diff, speed }) => {
        if (rested || diff < -360) return {};
        if (speed <= 0) rested = true;
        return { brake: true };
      };
    };
    const verdicts = [0.75, 1, 1.5].map(theta =>
      driveScenario(stopLine.level, stopLine.event, theta, stopShort()).outcome
    );
    expect(verdicts).toEqual(['stop', 'stop', 'stop']);
  });
});
