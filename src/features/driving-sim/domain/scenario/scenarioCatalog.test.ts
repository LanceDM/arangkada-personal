import { describe, expect, it } from 'vitest';
import { levelConfigRows, scenarioConfigRows } from './scenarioCatalog';

describe('the scenario catalogue', () => {
  const rows = scenarioConfigRows();

  it('lists every level with its road, limit and time limit', () => {
    const levels = levelConfigRows();
    expect(levels.map(l => l.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const level of levels) {
      expect(level.speedLimit).toBeGreaterThan(0);
      expect(level.roadLengthM).toBeGreaterThan(0);
    }
  });

  it('lists every scenario once per level, with a source', () => {
    for (const levelId of new Set(rows.map(r => r.levelId))) {
      const ids = rows.filter(r => r.levelId === levelId).map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(rows.every(r => r.source.length > 0)).toBe(true);
    expect(rows.length).toBeGreaterThan(200);
  });

  it('names a number for every slow-down scenario: the panel asked by how much', () => {
    const slow = rows.filter(r => r.answeredBy === 'driving' && r.correctAction === 'brake');
    const silent = slow.filter(r => r.targets.length === 0 && !/\d|two|three|four|five|six|full stop/i.test(r.instruction));
    expect(silent.map(r => r.id)).toEqual([]);
  });

  it('shows the targets in the instruction the player reads', () => {
    for (const row of rows.filter(r => r.targets.length > 0)) {
      for (const target of row.targets) expect(row.instruction).toContain(target);
    }
  });
});
