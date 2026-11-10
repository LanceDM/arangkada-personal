/**
 * Where the IRT section's two figures put things. Plain arithmetic on the
 * published numbers: a logit axis, the Wright map's bins, the curves' paths.
 */

/** The logit axis both figures share: the report's curve grid is −4 to 4. */
export const LOGIT_RANGE: readonly [number, number] = [-4, 4];

/** A value's place on a pixel span, clamped to the span. */
export const scale = (value: number, [d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]): number => {
  const t = (Math.min(Math.max(value, Math.min(d0, d1)), Math.max(d0, d1)) - d0) / (d1 - d0);
  return r0 + t * (r1 - r0);
};

export interface WrightBin {
  /** The bin's lower edge, in logits. */
  readonly from: number;
  readonly to: number;
  readonly persons: number;
  /** The items whose difficulty falls in the bin, easiest first. */
  readonly items: readonly { id: string; b: number }[];
}

/**
 * A Wright map's rows: people by θ and items by b, on one axis, in bins of
 * `width` logits from the range's bottom. Anything beyond the range is put in
 * its end bin, so no person or item is dropped from the picture.
 */
export const wrightBins = (
  thetas: readonly number[],
  items: readonly { id: string; b: number }[],
  width = 0.5,
  range: readonly [number, number] = LOGIT_RANGE,
): WrightBin[] => {
  const count = Math.round((range[1] - range[0]) / width);
  const binOf = (x: number) => Math.min(count - 1, Math.max(0, Math.floor((x - range[0]) / width)));
  const bins = Array.from({ length: count }, (_, i) => ({
    from: range[0] + i * width,
    to: range[0] + (i + 1) * width,
    persons: 0,
    items: [] as { id: string; b: number }[],
  }));
  for (const theta of thetas) bins[binOf(theta)].persons += 1;
  for (const item of items) bins[binOf(item.b)].items.push(item);
  for (const bin of bins) bin.items.sort((a, b) => a.b - b.b);
  return bins;
};

/** An SVG path through the points, in order. */
export const linePath = (points: readonly (readonly [number, number])[]): string =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('');

/** The index of the grid point nearest to `value`. */
export const nearestIndex = (grid: readonly number[], value: number): number =>
  grid.reduce((best, x, i) => (Math.abs(x - value) < Math.abs(grid[best] - value) ? i : best), 0);

/**
 * Label positions at least `gap` apart, each as near its own mark as that
 * allows, in the input's order: direct labels at the curves' ends that never
 * sit on one another.
 */
export const spreadLabels = (ys: readonly number[], gap: number): number[] => {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  // Pull the run back up so it centres on the marks rather than drifting down.
  const shift = (order.reduce((s, o) => s + o.y, 0) - ys.reduce((s, y) => s + y, 0)) / order.length;
  const out: number[] = [];
  for (const o of order) out[o.i] = o.y - shift;
  return out;
};
