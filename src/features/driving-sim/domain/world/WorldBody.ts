/**
 * A solid thing standing in the world, in the canvas-space coordinates the
 * whole simulation works in.
 *
 * A body is declared by the scene node it belongs to, never produced by the
 * drawing pass. The renderer paints that node and the collision pass tests the
 * bodies it declared, so the sprite and the thing you can hit are one decision
 * rather than two that have to agree.
 */
export interface WorldBody {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'vehicle' | 'pedestrian' | 'obstruction';
  /** Plain-language name used in the crash report. */
  label: string;
}

/** A body centred on a sprite's own origin. */
export const bodyAt = (
  x: number,
  y: number,
  width: number,
  height: number,
  kind: WorldBody['kind'],
  label: string
): WorldBody => ({ x: x - width / 2, y: y - height / 2, width, height, kind, label });

/** A body given by its top-left corner, for sprites drawn from a corner. */
export const bodyRect = (
  x: number,
  y: number,
  width: number,
  height: number,
  kind: WorldBody['kind'],
  label: string
): WorldBody => ({ x, y, width, height, kind, label });
