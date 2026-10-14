import { describe, it, expect } from 'vitest';
import { firstCarCollision, CAR_WIDTH, type CarState } from './vehiclePhysics';

const carAt = (x: number, y: number): CarState => ({ x, y, speed: 0, lane: 1, distance: 0, heading: 0 });

describe('firstCarCollision', () => {
  it('returns undefined when nothing overlaps the car footprint', () => {
    const car = carAt(200, 500);
    const boxes = [{ x: 0, y: 0, width: 10, height: 10, id: 'far' }];
    expect(firstCarCollision(car, boxes)).toBeUndefined();
  });

  it('detects an overlapping box and returns it with its own extra fields intact', () => {
    const car = carAt(200, 500);
    const boxes = [{ x: 195, y: 495, width: 10, height: 10, kind: 'pedestrian', label: 'a child' }];
    const hit = firstCarCollision(car, boxes);
    expect(hit).toBeDefined();
    expect(hit?.kind).toBe('pedestrian');
    expect(hit?.label).toBe('a child');
  });

  it('returns the first overlapping box in array order', () => {
    const car = carAt(100, 100);
    const boxes = [
      { x: 90, y: 90, width: 20, height: 20, id: 'first' },
      { x: 95, y: 95, width: 20, height: 20, id: 'second' },
    ];
    expect(firstCarCollision(car, boxes)?.id).toBe('first');
  });

  it('treats an exactly-touching edge as non-overlap (strict inequality)', () => {
    const car = carAt(100, 100);
    // Box whose right edge lands exactly on the car's left edge: touching, not overlapping.
    const boxes = [{ x: 100 - CAR_WIDTH / 2 - 10, y: 100, width: 10, height: 10, id: 'touch' }];
    expect(firstCarCollision(car, boxes)).toBeUndefined();
  });
});
