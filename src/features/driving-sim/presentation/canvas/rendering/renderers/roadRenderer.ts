import { CANVAS_WIDTH, CANVAS_HEIGHT, ROAD_WIDTH, LANE_WIDTH, CAR_WIDTH, CAR_HEIGHT, MAX_SPEED, CarState, distanceToScreenY, laneEdges, roadXAt, screenYToDistance, type CurveSpan, } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { LongitudinalArt, RoadPaint, RouteLayout } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { auxiliaryAt } from '@/features/driving-sim/domain/world/routeGeometry';
import type { EnvObject } from '@/features/driving-sim/domain/world/roadsideScenery';


/**
 * Screen rows the road is built from, each carrying the road's own left edge at
 * the point of the route that row is showing, and the point of the route it is
 * showing. Every band, line and dash is drawn along these, which is what lets
 * the carriageway bend — and what lets its paint change as you drive.
 */
const roadRows = (distance: number, curves: CurveSpan[]) => {
  const rows: RoadRow[] = [];
  for (let y = -24; y <= CANVAS_HEIGHT + 24; y += 6) {
    const d = screenYToDistance(y, distance);
    rows.push({ y, x: roadXAt(d, curves), d });
  }
  return rows;
};

interface RoadRow {
  y: number;
  x: number;
  /** Point along the route this row is showing. */
  d: number;
}

/** Fills a band running the length of the road, between two offsets from its left edge. */
const fillAlongRoad = (
  ctx: CanvasRenderingContext2D,
  rows: RoadRow[],
  from: number,
  to: number,
  fill: string
) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  rows.forEach((row, i) => (i === 0 ? ctx.moveTo(row.x + from, row.y) : ctx.lineTo(row.x + from, row.y)));
  for (let i = rows.length - 1; i >= 0; i--) ctx.lineTo(rows[i].x + to, rows[i].y);
  ctx.closePath();
  ctx.fill();
};

/** Strokes a line running the length of the road at a fixed offset from its left edge. */
const strokeAlongRoad = (
  ctx: CanvasRenderingContext2D,
  rows: RoadRow[],
  offset: number
) => {
  ctx.beginPath();
  rows.forEach((row, i) => (i === 0 ? ctx.moveTo(row.x + offset, row.y) : ctx.lineTo(row.x + offset, row.y)));
  ctx.stroke();
};

/* ------------------------------------------------------------------------- *
 * Road paint
 *
 * A level that declares `paint` has its longitudinal markings drawn from the
 * route rather than from a constant, so the line down the middle changes as you
 * drive into a stretch and changes back as you leave it. Nothing is overlaid:
 * at any point of the road exactly one centre treatment is painted, which is
 * why a double yellow no longer appears on top of the dashes that were already
 * there.
 *
 * Levels that declare nothing keep the road exactly as it has always been.
 * ------------------------------------------------------------------------- */

/** Road left blank either side of a paint change, so the change is legible. */
const TRANSITION_GAP = 26;

const WHITE = '#f8fafc';
const YELLOW = '#eab308';

interface LineSpec {
  /** Offset from the road's left edge. */
  offset: number;
  color: string;
  width: number;
  dash?: [number, number];
}

/** Everything one longitudinal marking puts on the carriageway. */
interface PaintSpec {
  lines: LineSpec[];
  /** Reflective studs instead of paint, at these offsets. */
  studs?: number[];
  /** A tinted strip reserving part of the road, as [from, to] offsets. */
  band?: { from: number; to: number; fill: string; label: string };
}

/**
 * What each longitudinal marking puts on a carriageway whose opposing traffic
 * occupies `oncomingLanes` lanes at the left.
 *
 * The centre treatment is drawn at the boundary between the opposing lanes and
 * yours, which is the only place a centre line means anything. The divider
 * between your own lanes stays a broken white line throughout, because that is
 * what it is — the markings this level teaches are about the centre, the edges
 * and the reserved lanes, not about re-labelling every line at once.
 */
const paintSpecFor = (art: LongitudinalArt, oncomingLanes: number): PaintSpec => {
  const centre = LANE_WIDTH * oncomingLanes;
  const edges = laneEdges(0);
  // Lane divisions that are not the centre line — the ones between your own
  // lanes, and the ones between theirs. Taken from every interior edge rather
  // than a hardcoded pair, so a four-lane carriageway gets all three of its
  // divisions and not just the two a three-lane road happened to have.
  const dividers = edges.slice(1, -1).filter(x => Math.abs(x - centre) > 1);
  const divider = (offset: number): LineSpec => ({
    offset,
    color: 'rgba(255,255,255,0.6)',
    width: 2,
    dash: [40, 30],
  });
  const edgeLines = (width: number): LineSpec[] => [
    { offset: 2, color: WHITE, width },
    { offset: ROAD_WIDTH - 2, color: WHITE, width },
  ];
  const withRest = (centreLines: LineSpec[], edgeWidth = 3): PaintSpec => ({
    lines: [...centreLines, ...dividers.map(divider), ...edgeLines(edgeWidth)],
  });
  const reserved = (fill: string, label: string, boundary: string): PaintSpec => ({
    lines: [
      { offset: centre, color: WHITE, width: 4 },
      ...dividers
        .filter(x => x < ROAD_WIDTH - LANE_WIDTH - 1)
        .map(divider),
      { offset: ROAD_WIDTH - LANE_WIDTH, color: boundary, width: 5 },
      ...edgeLines(3),
    ],
    band: { from: ROAD_WIDTH - LANE_WIDTH, to: ROAD_WIDTH, fill, label },
  });

  switch (art) {
    case 'centre_line':
      return withRest([{ offset: centre, color: WHITE, width: 4 }]);
    case 'lane_line':
      return withRest([{ offset: centre, color: WHITE, width: 3, dash: [16, 12] }]);
    case 'double_solid_yellow':
      return withRest([
        { offset: centre - 4, color: YELLOW, width: 4 },
        { offset: centre + 4, color: YELLOW, width: 4 },
      ]);
    case 'single_solid_yellow':
      return withRest([{ offset: centre, color: YELLOW, width: 5 }]);
    case 'solid_yellow_broken_white':
      // Solid on the oncoming side, broken on yours: the broken line is the
      // one that governs you, so the pass is legal from here.
      return withRest([
        { offset: centre - 5, color: YELLOW, width: 4 },
        { offset: centre + 7, color: WHITE, width: 3, dash: [16, 12] },
      ]);
    case 'broken_white_solid_yellow':
      // The same pair, mirrored: solid on your side this time, which is what
      // makes the pass illegal from here instead.
      return withRest([
        { offset: centre - 7, color: WHITE, width: 3, dash: [16, 12] },
        { offset: centre + 5, color: YELLOW, width: 4 },
      ]);
    case 'broken_yellow':
      return withRest([{ offset: centre, color: YELLOW, width: 5, dash: [18, 14] }]);
    case 'broken_and_solid_yellow':
      // Solid on your side is what forbids the pass; the oncoming side gets
      // the broken half, which speaks to their approach, not yours.
      return withRest([
        { offset: centre - 5, color: YELLOW, width: 4, dash: [18, 14] },
        { offset: centre + 5, color: YELLOW, width: 4 },
      ]);
    case 'edge_line':
      // The edge is the marking here, so it is painted heavy enough to read.
      return withRest([{ offset: centre, color: WHITE, width: 4 }], 6);
    case 'cats_eye':
      // Studs stand in for the painted lines, so the paint itself comes off.
      return {
        lines: edgeLines(3),
        studs: [centre, ...dividers],
      };
    case 'bus_puj_lane_line':
      return reserved('rgba(234,179,8,0.18)', 'PUJ LANE', YELLOW);
    case 'bus_lane':
      return reserved('rgba(234,179,8,0.18)', 'BUS LANE', YELLOW);
    case 'bicycle_lane':
      return reserved('rgba(34,197,94,0.2)', 'BIKE LANE', WHITE);
    case 'motorcycle_lane':
      return reserved('rgba(59,130,246,0.22)', 'MC LANE', WHITE);
  }
};

/**
 * Which marking the road carries at a point of the route, or `null` inside the
 * blank gap that separates one from the next.
 *
 * Exported for the test that holds a graded line painted where it is graded.
 */
export const paintAt = (d: number, paint: RoadPaint): LongitudinalArt | null => {
  for (const span of paint.spans) {
    if (d < span.from || d > span.to) continue;
    // Blank either side of the changeover, so a driver sees the old marking
    // stop before the new one starts rather than one becoming the other.
    if (d < span.from + TRANSITION_GAP || d > span.to - TRANSITION_GAP) return null;
    return span.art;
  }
  const nearBoundary = paint.spans.some(
    span =>
      (d > span.from - TRANSITION_GAP && d < span.from) ||
      (d > span.to && d < span.to + TRANSITION_GAP)
  );
  return nearBoundary ? null : paint.base;
};

/** Runs of consecutive rows that carry the same marking. */
const paintRuns = (rows: RoadRow[], paint: RoadPaint) => {
  const runs: { art: LongitudinalArt | null; rows: RoadRow[] }[] = [];
  for (const row of rows) {
    const art = paintAt(row.d, paint);
    const last = runs[runs.length - 1];
    if (last && last.art === art) last.rows.push(row);
    else runs.push({ art, rows: [row] });
  }
  // A run of one row has no length to draw along, so it is joined to its
  // neighbour rather than left as a dot on the road.
  return runs.filter(run => run.rows.length > 1 || runs.length === 1);
};

const drawDeclaredPaint = (
  ctx: CanvasRenderingContext2D,
  rows: RoadRow[],
  roadOffset: number,
  paint: RoadPaint
) => {
  // Dashes scroll with the road so they read as passing under the car rather
  // than crawling; the offset is shared by every dashed line on the surface.
  const dashOffset = -(roadOffset % 70);

  for (const run of paintRuns(rows, paint)) {
    if (!run.art) continue;
    const spec = paintSpecFor(run.art, paint.oncomingLanes);

    if (spec.band) {
      fillAlongRoad(ctx, run.rows, spec.band.from, spec.band.to, spec.band.fill);
    }

    for (const line of spec.lines) {
      ctx.save();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      if (line.dash) {
        ctx.setLineDash(line.dash);
        ctx.lineDashOffset = dashOffset;
      }
      strokeAlongRoad(ctx, run.rows, line.offset);
      ctx.restore();
    }

    if (spec.studs) {
      ctx.save();
      for (const row of run.rows) {
        // One stud every third row, which at 6px rows is a realistic spacing.
        if (Math.round(row.y / 6) % 3 !== 0) continue;
        for (const offset of spec.studs) {
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.roundRect(row.x + offset - 4, row.y - 2.5, 8, 5, 1.5);
          ctx.fill();
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.roundRect(row.x + offset - 2.5, row.y - 1.5, 5, 3, 1);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    if (spec.band) {
      // Named on the surface, once per run, so a reserved lane says what it is
      // wherever the driver happens to meet it.
      const middle = run.rows[Math.floor(run.rows.length / 2)];
      ctx.save();
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(
        spec.band.label,
        middle.x + (spec.band.from + spec.band.to) / 2,
        middle.y
      );
      ctx.restore();
    }
  }
};

/**
 * The road's own markings, as they were before any level declared its paint.
 * Kept exactly as-is so every existing level is drawn exactly as it was.
 */
const drawLegacyPaint = (
  ctx: CanvasRenderingContext2D,
  rows: RoadRow[],
  roadOffset: number
) => {
  // Yellow edge lines
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  strokeAlongRoad(ctx, rows, 2);
  strokeAlongRoad(ctx, rows, ROAD_WIDTH - 2);

  // Lane dashes
  const dashLen = 40;
  const gapLen = 30;
  const offset = roadOffset % (dashLen + gapLen);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([dashLen, gapLen]);
  ctx.lineDashOffset = -offset;
  // Painted where the lanes actually divide, so a car right of the right-hand
  // dash is a car the game agrees is in the right-hand lane. Every interior
  // edge, not a hardcoded pair — LANE_COUNT lanes need LANE_COUNT - 1
  // dividers, and a fixed pair only happened to work back when there were 3.
  const edges = laneEdges(0);
  for (const x of edges.slice(1, -1)) {
    strokeAlongRoad(ctx, rows, x);
  }
  ctx.setLineDash([]);
};

/**
 * The auxiliary lane beside the through carriageway, where the route declares
 * one.
 *
 * Painted as road rather than as a picture of road: the same widths
 * `routeGeometry` gives the drivable bounds, sampled at each row's own point of
 * the route, so the tarmac the driver can see and the tarmac they can steer
 * onto are the same tarmac. A lane drawn wider than it is drivable is the
 * defect this replaced — the acceleration lane was a wedge beside a road that
 * did not have one.
 */
const drawAuxiliaryLane = (
  ctx: CanvasRenderingContext2D,
  rows: RoadRow[],
  route: RouteLayout
) => {
  const widths = rows.map(row => auxiliaryAt(row.d, route)?.width ?? 0);

  // Contiguous runs, so a lane that opens and closes is one band rather than a
  // polygon stretched across the gap between two of them.
  let start = 0;
  while (start < rows.length) {
    if (widths[start] <= 0) {
      start += 1;
      continue;
    }
    let end = start;
    while (end + 1 < rows.length && widths[end + 1] > 0) end += 1;
    const run = rows.slice(start, end + 1);
    const runWidths = widths.slice(start, end + 1);

    const band = (from: (i: number) => number, to: (i: number) => number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      run.forEach((row, i) =>
        i === 0
          ? ctx.moveTo(row.x + from(i), row.y)
          : ctx.lineTo(row.x + from(i), row.y)
      );
      for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(run[i].x + to(i), run[i].y);
      ctx.closePath();
      ctx.fill();
    };

    // The shoulder outside it, then the lane surface itself.
    band(i => ROAD_WIDTH + runWidths[i], i => ROAD_WIDTH + runWidths[i] + 25, '#555a5e');
    band(() => ROAD_WIDTH, i => ROAD_WIDTH + runWidths[i], '#35354a');

    // Its outer edge line, and the broken continuity line where it meets the
    // through lanes — which is the marking that tells a driver the lane beside
    // them is one they are expected to leave.
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    run.forEach((row, i) =>
      i === 0
        ? ctx.moveTo(row.x + ROAD_WIDTH + runWidths[i] - 2, row.y)
        : ctx.lineTo(row.x + ROAD_WIDTH + runWidths[i] - 2, row.y)
    );
    ctx.stroke();

    ctx.setLineDash([18, 14]);
    ctx.strokeStyle = 'rgba(248,250,252,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    run.forEach((row, i) =>
      i === 0 ? ctx.moveTo(row.x + ROAD_WIDTH, row.y) : ctx.lineTo(row.x + ROAD_WIDTH, row.y)
    );
    ctx.stroke();
    ctx.setLineDash([]);

    start = end + 1;
  }
};

export const drawRoad = (
  ctx: CanvasRenderingContext2D,
  roadOffset: number,
  distance: number,
  envObjects: EnvObject[],
  curves: CurveSpan[] = [],
  paint?: RoadPaint,
  route?: RouteLayout
) => {
  const rows = roadRows(distance, curves);

  // Background gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  skyGrad.addColorStop(0, '#1a472a');
  skyGrad.addColorStop(0.4, '#2d5a3f');
  skyGrad.addColorStop(1, '#1a3a2a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Sidewalks, then the carriageway, all following the road's own line. The
  // cross-road shading is laid as three bands rather than a gradient, because a
  // gradient can only run straight and this surface does not.
  fillAlongRoad(ctx, rows, -25, 0, '#555a5e');
  fillAlongRoad(ctx, rows, ROAD_WIDTH, ROAD_WIDTH + 25, '#555a5e');
  fillAlongRoad(ctx, rows, 0, ROAD_WIDTH, '#35354a');
  fillAlongRoad(ctx, rows, ROAD_WIDTH * 0.18, ROAD_WIDTH * 0.82, '#3a3a50');
  fillAlongRoad(ctx, rows, 0, ROAD_WIDTH * 0.06, '#2a2a3a');
  fillAlongRoad(ctx, rows, ROAD_WIDTH * 0.94, ROAD_WIDTH, '#2a2a3a');

  // The markings themselves: from the route where the level declares them,
  // otherwise the constant paint every other level has always carried.
  if (paint) drawDeclaredPaint(ctx, rows, roadOffset, paint);
  else drawLegacyPaint(ctx, rows, roadOffset);

  // Then any lane running beside them. Painted after the through lanes so its
  // continuity line reads over the carriageway's own edge, which is what a
  // continuity line does.
  if (route) drawAuxiliaryLane(ctx, rows, route);

  // Environment objects
  for (const obj of envObjects) {
    const screenY = distanceToScreenY(obj.y, distance);
    if (screenY < -30 || screenY > CANVAS_HEIGHT + 30) continue;

    // Anchored to where the road is at their own point of the route, so the
    // roadside follows the bend instead of drifting into the carriageway.
    const objRoadX = roadXAt(obj.y, curves);
    const baseX = obj.side === 'left'
      ? objRoadX - 30 - obj.x * 0.5
      : objRoadX + ROAD_WIDTH + 10 + obj.x * 0.5;
    const perspective = Math.max(0.4, 1 - Math.abs(screenY - CANVAS_HEIGHT / 2) / CANVAS_HEIGHT);

    // The three that belong to a limited-access facility are placed against the
    // carriageway itself rather than scattered along the verge: a median
    // barrier is where the median is, and a crash barrier follows the curb.
    if (obj.type === 'median-barrier' || obj.type === 'guardrail' || obj.type === 'lamp') {
      // Outside the tarmac, which on this side is wider wherever the route
      // opens an auxiliary lane. A barrier placed against the through lanes
      // would stand in the acceleration lane the driver is told to use.
      const aux = auxiliaryAt(obj.y, route)?.width ?? 0;
      drawExpresswayFurniture(ctx, obj.type, obj.side, objRoadX, aux, screenY, perspective);
      continue;
    }

    // The water is the ground the riverside road runs beside, so it is laid
    // down before anything standing on it.
    if (obj.type === 'water' || obj.type === 'seawall') {
      drawRiverside(ctx, obj.type, obj.side, objRoadX, screenY);
      continue;
    }

    if (obj.type === 'house' || obj.type === 'awning' || obj.type === 'court') {
      drawBarangayFrontage(ctx, obj.type, obj.side, objRoadX, screenY, perspective);
      continue;
    }

    if (obj.type === 'acacia') {
      // A street tree with a wide crown, which is what distinguishes a planted
      // riverside road from the scattered saplings of an ordinary verge.
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(baseX - 2.5, screenY - 6, 5, 16);
      for (const [dx, dy, r] of [[0, -16, 13], [-9, -12, 9], [9, -13, 9]] as const) {
        ctx.fillStyle = dx === 0 ? '#2e7d32' : '#357a38';
        ctx.beginPath();
        ctx.arc(baseX + dx, screenY + dy, r * perspective, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }

    if (obj.type === 'tree') {
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(baseX - 2, screenY - 5, 4, 12);
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(baseX, screenY - 10, 8 * perspective, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#388e3c';
      ctx.beginPath();
      ctx.arc(baseX + 2, screenY - 12, 6 * perspective, 0, Math.PI * 2);
      ctx.fill();
    } else if (obj.type === 'pole') {
      ctx.fillStyle = '#78909c';
      ctx.fillRect(baseX - 1, screenY - 20, 2, 25);
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(baseX, screenY - 20, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(baseX - 10, screenY - 25 * perspective, 20, 25 * perspective);
      ctx.fillStyle = '#fff9c4';
      for (let wy = 0; wy < 3; wy++) {
        for (let wx = 0; wx < 2; wx++) {
          ctx.fillRect(baseX - 7 + wx * 10, screenY - 22 * perspective + wy * 8, 4, 4);
        }
      }
    }
  }
};

/**
 * The water and the wall that separate a riverside road from the river.
 *
 * Drawn against the carriageway rather than scattered along the verge, for the
 * same reason the expressway's barrier is: it is a boundary, and a boundary
 * with gaps in it reads as decoration.
 */
const drawRiverside = (
  ctx: CanvasRenderingContext2D,
  type: 'water' | 'seawall',
  side: 'left' | 'right',
  roadX: number,
  screenY: number
) => {
  const outer = side === 'left' ? roadX - 30 : roadX + ROAD_WIDTH + 30;
  const away = side === 'left' ? -1 : 1;
  ctx.save();
  if (type === 'water') {
    const grad = ctx.createLinearGradient(outer, 0, outer + away * 120, 0);
    grad.addColorStop(0, '#1b4b5a');
    grad.addColorStop(1, '#123441');
    ctx.fillStyle = grad;
    ctx.fillRect(Math.min(outer, outer + away * 120), screenY - 42, 120, 84);
    // A couple of still highlights, so the surface reads as water.
    ctx.fillStyle = 'rgba(148,205,220,0.16)';
    ctx.fillRect(Math.min(outer, outer + away * 120) + 18, screenY - 14, 54, 2);
    ctx.fillRect(Math.min(outer, outer + away * 120) + 34, screenY + 12, 38, 2);
  } else {
    ctx.fillStyle = '#9aa3ae';
    ctx.fillRect(side === 'left' ? outer : outer - 12, screenY - 42, 12, 84);
    ctx.fillStyle = '#6b7480';
    ctx.fillRect(side === 'left' ? outer : outer - 12, screenY - 42, 12, 4);
  }
  ctx.restore();
};

/**
 * The frontage of a barangay street: low houses almost on the curb, shop
 * awnings over the footpath, and the covered court.
 */
const drawBarangayFrontage = (
  ctx: CanvasRenderingContext2D,
  type: 'house' | 'awning' | 'court',
  side: 'left' | 'right',
  roadX: number,
  screenY: number,
  perspective: number
) => {
  const edge = side === 'left' ? roadX - 26 : roadX + ROAD_WIDTH + 26;
  const away = side === 'left' ? -1 : 1;
  ctx.save();
  if (type === 'court') {
    // The multi-purpose court: a pale slab with a roof line and a ring.
    const w = 96;
    const left = side === 'left' ? edge - w : edge;
    ctx.fillStyle = '#5b6470';
    ctx.fillRect(left, screenY - 34, w, 68);
    ctx.fillStyle = '#7c8794';
    ctx.fillRect(left, screenY - 34, w, 7);
    ctx.strokeStyle = 'rgba(248,250,252,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(left + w / 2, screenY, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left + 6, screenY);
    ctx.lineTo(left + w - 6, screenY);
    ctx.stroke();
  } else if (type === 'awning') {
    // Corrugated sheet angled out over the footpath.
    const w = 30;
    const left = side === 'left' ? edge - w : edge;
    ctx.fillStyle = '#2f6f5e';
    ctx.fillRect(left, screenY - 9, w, 18);
    ctx.strokeStyle = 'rgba(15,23,42,0.4)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(left + (w / 5) * i, screenY - 9);
      ctx.lineTo(left + (w / 5) * i, screenY + 9);
      ctx.stroke();
    }
  } else {
    // A low house: a wall to the road, a flat roof, two lit windows.
    const w = 46 * perspective + 16;
    const h = 40 * perspective + 12;
    const left = side === 'left' ? edge - w : edge;
    ctx.fillStyle = '#6d5a4c';
    ctx.fillRect(left, screenY - h / 2, w, h);
    ctx.fillStyle = '#8a7263';
    ctx.fillRect(left, screenY - h / 2, w, 6);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(left + (side === 'left' ? w - 16 : 6) , screenY - h / 4, 6, 6);
    ctx.fillRect(left + (side === 'left' ? w - 16 : 6), screenY + h / 8, 6, 6);
    // The door onto the footpath, on the side facing the road.
    ctx.fillStyle = '#3f3129';
    ctx.fillRect(side === 'left' ? left + w - 4 : left, screenY - 6, 4, 14);
  }
  void away;
  ctx.restore();
};

/**
 * The roadside of a limited-access facility: the concrete median, the crash
 * barrier along the outer verge, and the lighting columns between them.
 *
 * One segment per object, butted end to end by the generator's spacing, so the
 * barrier reads as continuous while every piece of it still enters and leaves
 * the frame at its own point of the route.
 */
const drawExpresswayFurniture = (
  ctx: CanvasRenderingContext2D,
  type: 'median-barrier' | 'guardrail' | 'lamp',
  side: 'left' | 'right',
  roadX: number,
  auxiliaryWidth: number,
  screenY: number,
  perspective: number
) => {
  // The outer edge of what can be driven on, not of the through lanes: an
  // auxiliary lane only ever opens on the right of a one-way carriageway, so
  // that is the side whose furniture has to stand further out.
  const outer = side === 'left' ? roadX : roadX + ROAD_WIDTH + auxiliaryWidth;
  const away = side === 'left' ? -1 : 1;

  if (type === 'median-barrier') {
    // A New Jersey profile seen end-on: a pale sloped face over a dark base,
    // standing off the edge of the carriageway rather than on it.
    const x = side === 'left' ? outer - 15 : outer + 4;
    ctx.fillStyle = '#3f4652';
    ctx.fillRect(x, screenY - 42, 11, 44);
    ctx.fillStyle = '#9aa3ae';
    ctx.fillRect(x + 2, screenY - 42, 7, 44);
    ctx.fillStyle = '#d7dde5';
    ctx.fillRect(x + 2, screenY - 42, 3, 44);
    return;
  }

  if (type === 'guardrail') {
    // Posts with a corrugated rail running between them.
    const postX = outer + away * 16;
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(postX - 1.5, screenY - 12, 3, 14);
    ctx.fillStyle = '#b9c2cc';
    ctx.fillRect(postX - 6, screenY - 44, 12, 40);
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    ctx.fillRect(postX - 6, screenY - 26, 12, 3);
    return;
  }

  // A lighting column: mast, outreach arm, and the lamp head glowing over the
  // carriageway.
  const footX = outer + away * 30;
  const headY = screenY - 74 * perspective;
  ctx.strokeStyle = '#8892a0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(footX, screenY);
  ctx.lineTo(footX, headY + 8);
  ctx.quadraticCurveTo(footX, headY, footX - away * 16, headY);
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(footX - away * 18, headY + 1, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(253,230,138,0.10)';
  ctx.beginPath();
  ctx.moveTo(footX - away * 18, headY + 2);
  ctx.lineTo(footX - away * 54, screenY + 12);
  ctx.lineTo(footX + away * 6, screenY + 12);
  ctx.closePath();
  ctx.fill();
};

export const drawCar = (ctx: CanvasRenderingContext2D, car: CarState) => {
  const { speed } = car;

  // While a turn is being executed the whole car is drawn rotated about its
  // own centre, so the body, lights and shadow swing together.
  if (car.heading) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    drawCarBody(ctx, 0, 0, speed);
    ctx.restore();
    return;
  }

  drawCarBody(ctx, car.x, car.y, speed);
};

const drawCarBody = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  speed: number
) => {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + CAR_HEIGHT / 2 + 6, CAR_WIDTH / 2 + 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyGrad = ctx.createLinearGradient(
    cx - CAR_WIDTH / 2, cy - CAR_HEIGHT / 2,
    cx + CAR_WIDTH / 2, cy + CAR_HEIGHT / 2
  );
  bodyGrad.addColorStop(0, '#2563eb');
  bodyGrad.addColorStop(0.5, '#3b82f6');
  bodyGrad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(cx - CAR_WIDTH / 2, cy - CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT, 10);
  ctx.fill();

  // Body outline
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - CAR_WIDTH / 2, cy - CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT, 10);
  ctx.stroke();

  // Front window
  ctx.fillStyle = '#93c5fd';
  ctx.beginPath();
  ctx.roundRect(cx - CAR_WIDTH / 2 + 6, cy - CAR_HEIGHT / 2 + 8, CAR_WIDTH - 12, 16, 5);
  ctx.fill();

  // Window glare
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.roundRect(cx - CAR_WIDTH / 2 + 8, cy - CAR_HEIGHT / 2 + 10, 10, 6, 3);
  ctx.fill();

  // Rear window
  ctx.fillStyle = '#93c5fd';
  ctx.beginPath();
  ctx.roundRect(cx - CAR_WIDTH / 2 + 8, cy + CAR_HEIGHT / 2 - 20, CAR_WIDTH - 16, 12, 4);
  ctx.fill();

  // Headlights
  ctx.fillStyle = '#fef9c3';
  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = speed > 0 ? 8 : 3;
  ctx.beginPath();
  ctx.roundRect(cx - CAR_WIDTH / 2 + 4, cy - CAR_HEIGHT / 2 + 2, 6, 4, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + CAR_WIDTH / 2 - 10, cy - CAR_HEIGHT / 2 + 2, 6, 4, 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Tail lights
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = speed > 0 ? 4 : 2;
  ctx.beginPath();
  ctx.roundRect(cx - CAR_WIDTH / 2 + 4, cy + CAR_HEIGHT / 2 - 6, 6, 3, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + CAR_WIDTH / 2 - 10, cy + CAR_HEIGHT / 2 - 6, 6, 3, 1);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Speed lines
  if (speed > 40) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(speed / MAX_SPEED * 0.4, 0.3)})`;
    ctx.lineWidth = 1;
    const lineCount = Math.floor(speed / 20);
    for (let i = 0; i < lineCount; i++) {
      const lx = cx - CAR_WIDTH / 2 - 5 + Math.random() * (CAR_WIDTH + 10);
      const ly = cy + CAR_HEIGHT / 2 + 10 + i * 8;
      const lineLen = 10 + speed * 0.2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + lineLen);
      ctx.stroke();
    }
  }
};

/**
 * Rain, fog or dust closing the far end of the corridor down.
 *
 * Drawn last, over the road, the events and the car, because that is what
 * reduced visibility is: not a change to the road but a limit on how much of it
 * reaches the driver. The near ground stays clear and the veil thickens with
 * distance up the screen, so the hazard is the one the module actually
 * describes — you can see where you are, and not where you are going.
 *
 * `strength` is `1 - RoadEffect.visibility`: 0 leaves the frame untouched, 1
 * would close it entirely. Content stays well short of 1, since a corridor the
 * driver cannot see at all is not a driving task either.
 */
export const drawVisibilityVeil = (
  ctx: CanvasRenderingContext2D,
  strength: number,
  rain = true
) => {
  const amount = Math.min(1, Math.max(0, strength));
  if (amount <= 0.01) return;

  // The horizon the road vanishes into. Above this row nothing is legible at
  // full strength; below it the veil thins out to nothing by the car's own row.
  const clearFrom = CANVAS_HEIGHT - 120;
  const veil = ctx.createLinearGradient(0, 0, 0, clearFrom);
  veil.addColorStop(0, `rgba(203, 213, 225, ${0.94 * amount})`);
  veil.addColorStop(0.45, `rgba(203, 213, 225, ${0.72 * amount})`);
  veil.addColorStop(1, `rgba(203, 213, 225, ${0.1 * amount})`);
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, CANVAS_WIDTH, clearFrom);

  if (!rain) return;

  // Streaks on the glass. Deliberately drawn across the whole frame rather than
  // only the veiled part: the windscreen is between the driver and all of it.
  ctx.strokeStyle = `rgba(226, 232, 240, ${0.45 * amount})`;
  ctx.lineWidth = 1;
  const streaks = Math.round(70 * amount);
  for (let i = 0; i < streaks; i++) {
    const x = Math.random() * CANVAS_WIDTH;
    const y = Math.random() * CANVAS_HEIGHT;
    const length = 10 + Math.random() * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y + length);
    ctx.stroke();
  }
};
