import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { createDrivingSession } from './DrivingSession';
import { snapshotChanged, type DrivingSnapshot } from './DrivingSnapshot';

const base = (): DrivingSnapshot =>
  createDrivingSession({ level: LEVELS.find(level => level.id === 1)!, fsm: new DrivingFSM(), signCoverage: {} }).getSnapshot();

describe('whether the screen has anything new to show', () => {
  const a = base();

  it('ignores a speed change the dial and the merge readout cannot show', () => {
    expect(snapshotChanged({ ...a, speed: 40.1 }, { ...a, speed: 40.3 })).toBe(false);
    expect(snapshotChanged({ ...a, targetSpeed: 50.1 }, { ...a, targetSpeed: 50.4 })).toBe(false);
  });

  it('re-renders where the dial rounds to a new number', () => {
    expect(snapshotChanged({ ...a, speed: 40.4 }, { ...a, speed: 40.6 })).toBe(true);
  });

  it('re-renders where a whole-number threshold such as a merge minimum is crossed', () => {
    expect(snapshotChanged({ ...a, speed: 59.9 }, { ...a, speed: 60.05 })).toBe(true);
  });

  it('ignores progress and approach too small to move a percentage', () => {
    expect(snapshotChanged({ ...a, progress: 0.3001 }, { ...a, progress: 0.3004 })).toBe(false);
    expect(snapshotChanged({ ...a, eventApproach: 0.5001 }, { ...a, eventApproach: 0.5004 })).toBe(false);
  });

  it('re-renders where a shown percentage moves, and where the approach reaches "Here"', () => {
    expect(snapshotChanged({ ...a, progress: 0.304 }, { ...a, progress: 0.306 })).toBe(true);
    expect(snapshotChanged({ ...a, eventApproach: 0.0201 }, { ...a, eventApproach: 0.0199 })).toBe(true);
  });

  it('still sees every discrete change', () => {
    expect(snapshotChanged(a, { ...a, lane: a.lane + 1 })).toBe(true);
    expect(snapshotChanged(a, { ...a, crashed: true })).toBe(true);
    expect(snapshotChanged(a, { ...a, requiredLanes: [2] })).toBe(true);
    expect(snapshotChanged(a, { ...a })).toBe(false);
  });
});
