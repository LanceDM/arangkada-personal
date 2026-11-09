import { describe, expect, it } from 'vitest';
import { linePath, nearestIndex, scale, spreadLabels, wrightBins } from './irtChartGeometry';

describe('the IRT figures’ geometry', () => {
  it('puts people and items in half-logit rows, keeping anything past the axis in its end row', () => {
    const bins = wrightBins([-0.2, 0.1, 0.3, 9], [{ id: 'b', b: 0.4 }, { id: 'a', b: 0.2 }, { id: 'z', b: -7 }]);
    expect(bins).toHaveLength(16);
    const zero = bins.find(b => b.from === 0)!;
    expect(zero.persons).toBe(2);
    expect(zero.items.map(i => i.id)).toEqual(['a', 'b']);
    expect(bins[15].persons).toBe(1);
    expect(bins[0].items.map(i => i.id)).toEqual(['z']);
    expect(bins.reduce((s, b) => s + b.persons, 0)).toBe(4);
  });

  it('scales, clamps, finds the nearest grid point and draws a path', () => {
    expect(scale(0, [-4, 4], [0, 800])).toBe(400);
    expect(scale(10, [-4, 4], [0, 800])).toBe(800);
    expect(scale(2, [0, 4], [100, 0])).toBe(50);
    expect(nearestIndex([-1, 0, 1], 0.4)).toBe(1);
    expect(linePath([[0, 1], [2, 3]])).toBe('M0.0,1.0L2.0,3.0');
  });

  it('spreads end labels apart, in their order, centred on their marks', () => {
    const out = spreadLabels([100, 101, 50, 102], 12);
    const sorted = [...out].sort((a, b) => a - b);
    expect(sorted.every((y, k) => k === 0 || y - sorted[k - 1] >= 12 - 1e-9)).toBe(true);
    expect(out[2]).toBeLessThan(out[0]);
    expect(spreadLabels([10, 50], 12)).toEqual([10, 50]);
  });
});
