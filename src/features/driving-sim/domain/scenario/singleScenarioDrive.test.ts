import { describe, expect, it } from 'vitest';
import { scenarioConfigRows } from './scenarioCatalog';
import { singleScenarioDrive } from './singleScenarioDrive';

describe('one scenario, alone, for the admin to play', () => {
  const rows = scenarioConfigRows();

  it('can place every scenario the admin list shows', () => {
    const missing = rows.filter(row => !singleScenarioDrive(row.levelId, row.id)).map(row => `L${row.levelId} ${row.id}`);
    expect(missing).toEqual([]);
  });

  it('puts a road scenario on the road and starts the car before it', () => {
    for (const row of rows.filter(r => r.place === 'road')) {
      const drive = singleScenarioDrive(row.levelId, row.id)!;
      const event = drive.level.events.find(e => e.id === row.id);
      expect(event, `L${row.levelId} ${row.id}`).toBeDefined();
      expect(drive.initialDistance).toBeLessThan(event!.triggerAtDistance);
    }
  });

  it('plays a garage check with only that point at the garage', () => {
    const row = rows.find(r => r.place === 'garage' && r.levelId === 2)!;
    const drive = singleScenarioDrive(row.levelId, row.id)!;
    expect(drive.where).toBe('garage');
    expect(drive.level.garage?.hotspots).toHaveLength(1);
    // Nothing to drive after it: the check ends a short way out of the garage.
    expect(drive.level.events).toEqual([]);
    expect(drive.level.roadLength).toBeLessThan(1000);
  });
});
