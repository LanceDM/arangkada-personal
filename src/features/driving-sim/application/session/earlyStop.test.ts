import { describe, expect, it } from 'vitest';
import { singleScenarioDrive } from '@/features/driving-sim/domain/scenario/singleScenarioDrive';
import { driveScenario, type Driver } from './thetaDrives';

/** Brakes to rest well before the line - from 0.6 of the zone back - and stands there. */
const stopShort: Driver = ({ diff, zone }) => (diff >= -0.6 * zone ? { brake: true } : {});

describe('a full stop made a little early', () => {
  for (const id of ['level2.drive-out.dog-walker', 'level2.drive-out.neighbour', 'level4.traverse.stop-line']) {
    it(`is the stop on ${id}`, () => {
      const level = Number(id.match(/^level(\d+)/)![1]);
      const drive = singleScenarioDrive(level, id)!;
      const event = drive.level.events.find(e => e.id === id)!;
      const result = driveScenario(drive.level, event, 1, stopShort);
      expect(result.outcome).toBe('stop');
    });
  }
});
