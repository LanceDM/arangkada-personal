// Top-down garage bay used by the pre-drive readiness stage. Hand-rolled
// Canvas 2D, matching the style of roadRenderer.ts / index.ts in this folder.

export const GARAGE_WIDTH = 440;
export const GARAGE_HEIGHT = 560;

const HOTSPOT_RADIUS = 15;
const HIT_RADIUS = 22;

export type HotspotStatus = 'pending' | 'correct' | 'wrong';

export interface HotspotMarker {
  id: string;
  label: string;
  /** 0..1 coordinates relative to the diagram. */
  x: number;
  y: number;
  status: HotspotStatus;
}

const toPixels = (marker: HotspotMarker) => ({
  px: marker.x * GARAGE_WIDTH,
  py: marker.y * GARAGE_HEIGHT,
});

const drawFloor = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, GARAGE_WIDTH, GARAGE_HEIGHT);

  // Bay markings
  ctx.strokeStyle = 'rgba(248,250,252,0.16)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(72, 24);
  ctx.lineTo(72, GARAGE_HEIGHT - 24);
  ctx.moveTo(GARAGE_WIDTH - 72, 24);
  ctx.lineTo(GARAGE_WIDTH - 72, GARAGE_HEIGHT - 24);
  ctx.stroke();
  ctx.setLineDash([]);

  // Stop bar at the head of the bay
  ctx.fillStyle = 'rgba(240,201,41,0.35)';
  ctx.fillRect(72, 18, GARAGE_WIDTH - 144, 6);
};

const drawTire = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(cx - 9, cy - 24, 18, 48, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
};

const drawCar = (ctx: CanvasRenderingContext2D, plate: string) => {
  const bodyX = GARAGE_WIDTH * 0.28;
  const bodyW = GARAGE_WIDTH * 0.44;
  const bodyY = GARAGE_HEIGHT * 0.07;
  const bodyH = GARAGE_HEIGHT * 0.87;
  const cx = GARAGE_WIDTH / 2;

  // Tires straddle the body edge so they stay visible from above.
  drawTire(ctx, bodyX - 5, GARAGE_HEIGHT * 0.24);
  drawTire(ctx, bodyX + bodyW + 5, GARAGE_HEIGHT * 0.24);
  drawTire(ctx, bodyX - 5, GARAGE_HEIGHT * 0.74);
  drawTire(ctx, bodyX + bodyW + 5, GARAGE_HEIGHT * 0.74);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(bodyX + 6, bodyY + 10, bodyW, bodyH, 22);
  ctx.fill();

  // Body
  const grad = ctx.createLinearGradient(bodyX, bodyY, bodyX + bodyW, bodyY + bodyH);
  grad.addColorStop(0, '#3b82f6');
  grad.addColorStop(0.5, '#2563eb');
  grad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glass
  ctx.fillStyle = 'rgba(135,206,235,0.85)';
  ctx.beginPath();
  ctx.roundRect(bodyX + 14, GARAGE_HEIGHT * 0.30, bodyW - 28, GARAGE_HEIGHT * 0.08, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(bodyX + 14, GARAGE_HEIGHT * 0.62, bodyW - 28, GARAGE_HEIGHT * 0.07, 8);
  ctx.fill();

  // Cabin roof
  ctx.fillStyle = 'rgba(15,23,42,0.28)';
  ctx.beginPath();
  ctx.roundRect(bodyX + 10, GARAGE_HEIGHT * 0.39, bodyW - 20, GARAGE_HEIGHT * 0.22, 10);
  ctx.fill();

  // Seats, so the cabin reads as an interior
  ctx.fillStyle = 'rgba(226,232,240,0.5)';
  ctx.beginPath();
  ctx.roundRect(bodyX + 26, GARAGE_HEIGHT * 0.42, 34, 44, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(bodyX + bodyW - 60, GARAGE_HEIGHT * 0.42, 34, 44, 6);
  ctx.fill();

  // Headlights
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.roundRect(bodyX + 16, bodyY + 6, 34, 12, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(bodyX + bodyW - 50, bodyY + 6, 34, 12, 5);
  ctx.fill();

  // Tail lights
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(bodyX + 16, bodyY + bodyH - 20, 34, 12, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(bodyX + bodyW - 50, bodyY + bodyH - 20, 34, 12, 5);
  ctx.fill();

  // Side mirrors
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(bodyX - 10, GARAGE_HEIGHT * 0.34, 12, 8);
  ctx.fillRect(bodyX + bodyW - 2, GARAGE_HEIGHT * 0.34, 12, 8);

  // Rear plate
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(cx - 34, bodyY + bodyH - 4, 68, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(plate, cx, bodyY + bodyH + 9);
};

const statusFill = (status: HotspotStatus): string => {
  switch (status) {
    case 'correct': return '#22c55e';
    case 'wrong': return '#ef4444';
    default: return '#f0c929';
  }
};

const drawMarker = (
  ctx: CanvasRenderingContext2D,
  marker: HotspotMarker,
  index: number,
  hovered: boolean
) => {
  const { px, py } = toPixels(marker);

  if (marker.status === 'pending') {
    const pulse = 0.5 + Math.sin(Date.now() * 0.004 + index) * 0.25;
    ctx.fillStyle = `rgba(240,201,41,${pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, HOTSPOT_RADIUS + 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = statusFill(marker.status);
  ctx.beginPath();
  ctx.arc(px, py, HOTSPOT_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = hovered ? '#ffffff' : 'rgba(15,23,42,0.65)';
  ctx.lineWidth = hovered ? 3 : 2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    marker.status === 'correct' ? '✓' : marker.status === 'wrong' ? '✕' : String(index + 1),
    px,
    py + 0.5
  );
  ctx.textBaseline = 'alphabetic';
};

const drawHoverLabel = (ctx: CanvasRenderingContext2D, marker: HotspotMarker) => {
  const { px, py } = toPixels(marker);
  ctx.font = 'bold 11px Inter';
  ctx.textAlign = 'center';
  const width = ctx.measureText(marker.label).width + 18;
  const boxX = Math.min(Math.max(px - width / 2, 6), GARAGE_WIDTH - width - 6);
  const boxY = py - HOTSPOT_RADIUS - 30;

  ctx.fillStyle = 'rgba(15,23,42,0.92)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, width, 22, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,201,41,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#f0c929';
  ctx.fillText(marker.label, boxX + width / 2, boxY + 15);
};

// ---------------------------------------------------------------------------
// Close-up art, drawn when a single inspection point is opened.
// ---------------------------------------------------------------------------

export const DETAIL_WIDTH = 260;
export const DETAIL_HEIGHT = 190;

const detailBackdrop = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, DETAIL_WIDTH, DETAIL_HEIGHT);
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x < DETAIL_WIDTH; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, DETAIL_HEIGHT);
    ctx.stroke();
  }
};

const faultMark = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 9);
  ctx.lineTo(x + 20, y + 20);
  ctx.stroke();
};

const okMark = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x - 2, y + 6);
  ctx.lineTo(x + 8, y - 7);
  ctx.stroke();
};

const drawTireDetail = (ctx: CanvasRenderingContext2D) => {
  const cx = DETAIL_WIDTH / 2;
  const cy = DETAIL_HEIGHT / 2;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  // Sidewall cracks
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.28;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
    ctx.lineTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
    ctx.stroke();
  }

  // Flattened contact patch
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(cx - 52, cy + 52, 104, 12);
  faultMark(ctx, cx + 46, cy - 44);
};

const drawBrakesDetail = (ctx: CanvasRenderingContext2D) => {
  // Pedal arm
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(96, 34);
  ctx.lineTo(126, 104);
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(104, 100, 48, 30, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Floor
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 152, DETAIL_WIDTH, DETAIL_HEIGHT - 152);

  // Fluid pool
  ctx.fillStyle = 'rgba(245,158,11,0.75)';
  ctx.beginPath();
  ctx.ellipse(150, 166, 46, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(245,158,11,0.9)';
  ctx.beginPath();
  ctx.arc(150, 140, 4, 0, Math.PI * 2);
  ctx.fill();

  faultMark(ctx, 196, 150);
};

const drawLightsDetail = (ctx: CanvasRenderingContext2D) => {
  const cx = DETAIL_WIDTH / 2;
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.roundRect(34, 58, DETAIL_WIDTH - 68, 74, 12);
  ctx.fill();

  const glow = ctx.createRadialGradient(cx, 95, 4, cx, 95, 62);
  glow.addColorStop(0, 'rgba(253,230,138,0.95)');
  glow.addColorStop(1, 'rgba(253,230,138,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, 95, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.roundRect(52, 74, 62, 42, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(DETAIL_WIDTH - 114, 74, 62, 42, 8);
  ctx.fill();

  okMark(ctx, cx, 158);
};

const drawEngineDetail = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(22, 30, DETAIL_WIDTH - 44, DETAIL_HEIGHT - 62, 10);
  ctx.fill();

  // Battery
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(38, 46, 66, 46, 5);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(48, 40, 12, 8);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(82, 40, 12, 8);

  // Coolant reservoir
  ctx.fillStyle = 'rgba(96,165,250,0.35)';
  ctx.beginPath();
  ctx.roundRect(124, 44, 46, 62, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(96,165,250,0.85)';
  ctx.fillRect(124, 76, 46, 30);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(124, 44, 46, 62, 6);
  ctx.stroke();

  // Dipstick
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(196, 46);
  ctx.lineTo(196, 108);
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(196, 42, 7, 0, Math.PI * 2);
  ctx.fill();

  okMark(ctx, DETAIL_WIDTH / 2, 156);
};

const drawTrunkDetail = (ctx: CanvasRenderingContext2D) => {
  // Open, empty trunk well
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(28, 40, DETAIL_WIDTH - 56, DETAIL_HEIGHT - 82, 10);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Empty outlines where the kit should be
  ctx.strokeStyle = 'rgba(148,163,184,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(84, 100, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(150, 122);
  ctx.lineTo(178, 74);
  ctx.lineTo(206, 122);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(148,163,184,0.7)';
  ctx.font = 'bold 9px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('NO SPARE', 84, 104);
  ctx.fillText('NO EWD', 178, 112);

  faultMark(ctx, 216, 60);
};

const drawCockpitDetail = (ctx: CanvasRenderingContext2D) => {
  // Gear gate
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(30, 34, 108, 122, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 60);
  ctx.lineTo(60, 130);
  ctx.moveTo(108, 60);
  ctx.lineTo(108, 130);
  ctx.moveTo(60, 95);
  ctx.lineTo(108, 95);
  ctx.stroke();

  // Lever parked in first, not neutral
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(84, 95);
  ctx.lineTo(60, 62);
  ctx.stroke();
  ctx.fillStyle = '#f0c929';
  ctx.beginPath();
  ctx.arc(60, 60, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 9px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('1', 60, 63);

  ctx.fillStyle = 'rgba(148,163,184,0.85)';
  ctx.font = 'bold 9px Inter';
  ctx.fillText('N', 84, 99);

  // Drowsy driver
  ctx.fillStyle = '#deb887';
  ctx.beginPath();
  ctx.arc(196, 78, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(184, 74);
  ctx.lineTo(192, 74);
  ctx.moveTo(200, 74);
  ctx.lineTo(208, 74);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(196, 90, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 13px Inter';
  ctx.fillText('z', 218, 52);
  ctx.font = 'bold 10px Inter';
  ctx.fillText('z', 230, 40);

  faultMark(ctx, 128, 158);
};

const drawPlateDetail = (ctx: CanvasRenderingContext2D, plate: string) => {
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(28, 52, DETAIL_WIDTH - 56, 86, 8);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 11px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('PILIPINAS', DETAIL_WIDTH / 2, 70);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px Inter';
  ctx.fillText(plate, DETAIL_WIDTH / 2, 112);

  // Box the exact two glyphs the schedule is read from: the last digit sets the
  // month and the second-to-last sets the week. Measured rather than guessed so
  // the call-outs land on the right characters for any plate.
  const fullWidth = ctx.measureText(plate).width;
  const left = DETAIL_WIDTH / 2 - fullWidth / 2;
  const upToLast = ctx.measureText(plate.slice(0, -1)).width;
  const upToSecondLast = ctx.measureText(plate.slice(0, -2)).width;

  const monthX = left + upToLast;
  const monthW = fullWidth - upToLast;
  const weekX = left + upToSecondLast;
  const weekW = upToLast - upToSecondLast;

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(weekX - 3, 86, weekW + 6, 34, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(monthX - 3, 86, monthW + 6, 34, 4);
  ctx.stroke();

  // Staggered below the plate with leader lines: the two digits sit side by side
  // and are far too narrow to caption in line without the words colliding.
  const caption = (cx: number, y: number, label: string) => {
    ctx.strokeStyle = 'rgba(240,201,41,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 122);
    ctx.lineTo(cx, y - 8);
    ctx.stroke();
    ctx.fillStyle = '#f0c929';
    ctx.font = 'bold 10px Inter';
    ctx.fillText(label, cx, y);
  };

  caption(weekX + weekW / 2, 152, 'week digit');
  caption(monthX + monthW / 2, 174, 'month digit');
};

/**
 * One occupant, seen from behind in their seat.
 *
 * The two restraint drawings below are the same figure at two sizes with the
 * strap drawn where the scenario says it actually lies, which is the whole
 * point of them: an inspection of how somebody is belted needs a picture of how
 * they are belted, and the six arts before these could only offer a gearstick
 * and a sleeping face.
 */
const seatedOccupant = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  { width, height, strap }: { width: number; height: number; strap: 'chest' | 'neck' | 'none' }
) => {
  const seatW = width + 24;
  const bottom = top + height;

  // Seat back and squab
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(cx - seatW / 2, top - 8, seatW, height + 26, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Head and torso
  const headR = width * 0.34;
  ctx.fillStyle = '#deb887';
  ctx.beginPath();
  ctx.arc(cx, top + headR, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, top + headR * 1.7, width, bottom - (top + headR * 1.7), 8);
  ctx.fill();

  if (strap === 'none') return;

  // The shoulder strap, drawn from the anchor by the ear to the buckle at the
  // hip. Across the collarbone where it belongs, or across the throat where it
  // does not — the difference the law and the scenario both turn on.
  const shoulderY = strap === 'chest' ? top + headR * 1.9 : top + headR * 0.9;
  const hipY = bottom - 8;
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + width / 2 + 4, shoulderY);
  ctx.lineTo(cx - width * 0.18, hipY);
  ctx.stroke();

  // And the lap belt across the hips, which is where both halves of the module
  // agree it goes.
  ctx.beginPath();
  ctx.moveTo(cx - width / 2 - 4, hipY);
  ctx.lineTo(cx + width / 2 + 4, hipY);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Buckle
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(cx - width * 0.28, hipY - 6, 13, 12, 3);
  ctx.fill();
};

/** Caption under a seat, so the two sides of a comparison are named. */
const seatCaption = (ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, color: string) => {
  ctx.fillStyle = color;
  ctx.font = 'bold 10px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y);
};

/** The front row, seen from behind: two adults, one belt each. */
const drawBeltDetail = (ctx: CanvasRenderingContext2D) => {
  seatedOccupant(ctx, 74, 36, { width: 44, height: 104, strap: 'chest' });
  seatedOccupant(ctx, 186, 36, { width: 44, height: 104, strap: 'chest' });
  seatCaption(ctx, 74, 168, 'DRIVER', 'rgba(226,232,240,0.8)');
  seatCaption(ctx, 186, 168, 'FRONT PASSENGER', 'rgba(226,232,240,0.8)');
};

/**
 * The back seat, seen from behind: the five-year-old on the bare bench with the
 * adult strap across her throat, and her brother on the belt correctly.
 *
 * Both children in one picture because the rule is one rule. The dashed outline
 * is the restraint that is missing, which is the thing the player is being
 * asked to notice.
 */
const drawChildSeatDetail = (ctx: CanvasRenderingContext2D) => {
  seatedOccupant(ctx, 74, 54, { width: 30, height: 74, strap: 'neck' });
  seatedOccupant(ctx, 186, 40, { width: 42, height: 96, strap: 'chest' });

  // Where the child restraint should be.
  ctx.strokeStyle = 'rgba(248,113,113,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.roundRect(40, 40, 68, 104, 8);
  ctx.stroke();
  ctx.setLineDash([]);

  seatCaption(ctx, 74, 168, 'NO CHILD SEAT', '#f87171');
  seatCaption(ctx, 186, 168, '150 CM — BELT OK', '#4ade80');
};

/** Paints the close-up for one inspection point. */
export const drawHotspotDetail = (
  ctx: CanvasRenderingContext2D,
  art: string,
  plate: string
) => {
  ctx.clearRect(0, 0, DETAIL_WIDTH, DETAIL_HEIGHT);
  detailBackdrop(ctx);
  ctx.textBaseline = 'alphabetic';

  switch (art) {
    case 'tire': return drawTireDetail(ctx);
    case 'brakes': return drawBrakesDetail(ctx);
    case 'lights': return drawLightsDetail(ctx);
    case 'engine': return drawEngineDetail(ctx);
    case 'trunk': return drawTrunkDetail(ctx);
    case 'cockpit': return drawCockpitDetail(ctx);
    case 'belt': return drawBeltDetail(ctx);
    case 'child_seat': return drawChildSeatDetail(ctx);
    case 'plate': return drawPlateDetail(ctx, plate);
  }
};

// ---------------------------------------------------------------------------
// The crash scene
//
// The stage machinery — a diagram, points on it, a modal per point, a checklist
// that has to be emptied — turned out to have nothing to do with garages. Only
// the picture underneath changes, so a road crash gets its own picture and
// reuses everything else: the same markers, the same hit testing, the same
// 0..1 coordinates.
// ---------------------------------------------------------------------------

/** Where the carriageway ends and the verge begins, in scene pixels. */
const ROAD_LEFT = 40;
const ROAD_RIGHT = 292;
const VERGE_RIGHT = 312;

const drawCrashGround = (ctx: CanvasRenderingContext2D) => {
  // Night-lit asphalt, the same ground tone the garage floor uses so the two
  // stages read as one game.
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, GARAGE_WIDTH, GARAGE_HEIGHT);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, GARAGE_HEIGHT);

  // Verge, then the creek the road runs alongside.
  ctx.fillStyle = '#14532d';
  ctx.fillRect(ROAD_RIGHT, 0, VERGE_RIGHT - ROAD_RIGHT, GARAGE_HEIGHT);
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(VERGE_RIGHT, 0, GARAGE_WIDTH - VERGE_RIGHT, GARAGE_HEIGHT);

  // Water surface, drawn as slow ripples so the creek is legibly water rather
  // than a blue field.
  ctx.strokeStyle = 'rgba(186,230,253,0.22)';
  ctx.lineWidth = 1.5;
  for (let y = 30; y < GARAGE_HEIGHT; y += 46) {
    ctx.beginPath();
    ctx.moveTo(VERGE_RIGHT + 8, y);
    ctx.bezierCurveTo(VERGE_RIGHT + 40, y - 8, GARAGE_WIDTH - 40, y + 8, GARAGE_WIDTH - 6, y);
    ctx.stroke();
  }

  // Centre line and edge lines.
  ctx.strokeStyle = 'rgba(240,201,41,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo((ROAD_LEFT + ROAD_RIGHT) / 2, 0);
  ctx.lineTo((ROAD_LEFT + ROAD_RIGHT) / 2, GARAGE_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(248,250,252,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ROAD_LEFT + 6, 0);
  ctx.lineTo(ROAD_LEFT + 6, GARAGE_HEIGHT);
  ctx.moveTo(ROAD_RIGHT - 6, 0);
  ctx.lineTo(ROAD_RIGHT - 6, GARAGE_HEIGHT);
  ctx.stroke();
};

/** Scattered wreckage across the asphalt, which is what makes this a scene. */
const drawDebris = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = 'rgba(148,163,184,0.5)';
  const bits: Array<[number, number, number]> = [
    [130, 214, 7], [172, 232, 5], [204, 200, 6], [146, 250, 4],
    [232, 224, 5], [110, 190, 4], [196, 252, 6], [252, 208, 5],
  ];
  for (const [x, y, r] of bits) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x - r * 0.4, y + r);
    ctx.closePath();
    ctx.fill();
  }
};

/** A car body seen from above, optionally crushed at the nose. */
const drawSceneCar = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  body: string,
  wrecked: boolean
) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(-21, -32, 42, 68, 8);
  ctx.fill();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-22, -34, 44, 68, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,232,240,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cabin glass.
  ctx.fillStyle = 'rgba(148,197,253,0.35)';
  ctx.beginPath();
  ctx.roundRect(-15, -12, 30, 22, 4);
  ctx.fill();

  if (wrecked) {
    // The front end folded in, drawn as a bitten-out nose rather than a neat
    // rectangle, so "destroyed" is visible at diagram scale.
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-22, -34);
    ctx.lineTo(-4, -20);
    ctx.lineTo(10, -34);
    ctx.lineTo(22, -22);
    ctx.lineTo(22, -34);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
};

/** Smoke lifting off a wrecked engine bay. */
const drawSmoke = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
  ctx.fillStyle = 'rgba(203,213,225,0.28)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(cx + (i % 2 ? 9 : -7) + i * 2, cy - i * 13, 10 + i * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** A person standing on the scene, seen from above. */
const drawFigure = (ctx: CanvasRenderingContext2D, cx: number, cy: number, tone: string) => {
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - 5, cy + 4, 10, 15, 4);
  ctx.fill();
};

/** Hazard lights on the driver's own stopped vehicle. */
const drawHazards = (ctx: CanvasRenderingContext2D, cx: number, cy: number) => {
  const on = Math.floor(Date.now() / 480) % 2 === 0;
  ctx.fillStyle = on ? '#f59e0b' : 'rgba(245,158,11,0.25)';
  for (const [dx, dy] of [[-17, -28], [17, -28], [-17, 28], [17, 28]] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawCrashScene = (ctx: CanvasRenderingContext2D, plate: string) => {
  drawCrashGround(ctx);
  drawDebris(ctx);

  // The wrecked car, slewed across both lanes, with its engine bay smoking.
  drawSceneCar(ctx, 158, 168, -0.62, '#7f1d1d', true);
  drawSmoke(ctx, 150, 146);

  // The second vehicle: upright, stable, clear of the lane, with the
  // unresponsive passenger still belted into it.
  drawSceneCar(ctx, 220, 291, 0.14, '#334155', false);

  // The van that left the road, still floating in the creek. Drawn part-sunk:
  // the near end is under the surface, which is the whole reason this is urgent.
  ctx.save();
  ctx.translate(343, 347);
  ctx.rotate(0.5);
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-24, -36, 48, 72, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(12,74,110,0.62)';
  ctx.beginPath();
  ctx.roundRect(-24, 2, 48, 34, 8);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(186,230,253,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(343, 347, 40, 30, 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // The walking wounded, and the officer who has just arrived.
  drawFigure(ctx, 252, 246, '#fbbf24');
  drawFigure(ctx, 122, 372, '#38bdf8');

  // The driver's own vehicle, stopped clear of the wreckage with hazards on.
  drawSceneCar(ctx, 88, 414, 0, '#1d4ed8', false);
  drawHazards(ctx, 88, 414);

  ctx.fillStyle = 'rgba(248,250,252,0.9)';
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(plate, 88, 462);
  ctx.textAlign = 'left';
};

export const drawGarage = (
  ctx: CanvasRenderingContext2D,
  plate: string,
  markers: HotspotMarker[],
  hoveredId: string | null,
  scene: 'garage' | 'crash_scene' = 'garage'
) => {
  ctx.clearRect(0, 0, GARAGE_WIDTH, GARAGE_HEIGHT);
  if (scene === 'crash_scene') {
    drawCrashScene(ctx, plate);
  } else {
    drawFloor(ctx);
    drawCar(ctx, plate);
  }

  markers.forEach((marker, index) => drawMarker(ctx, marker, index, marker.id === hoveredId));

  const hovered = markers.find(m => m.id === hoveredId);
  if (hovered) drawHoverLabel(ctx, hovered);
};

/** Returns the id of the marker under the given canvas point, if any. */
export const hitTestHotspot = (
  markers: HotspotMarker[],
  px: number,
  py: number
): string | null => {
  let closest: { id: string; dist: number } | null = null;

  for (const marker of markers) {
    const { px: mx, py: my } = toPixels(marker);
    const dist = Math.hypot(px - mx, py - my);
    if (dist <= HIT_RADIUS && (!closest || dist < closest.dist)) {
      closest = { id: marker.id, dist };
    }
  }

  return closest?.id ?? null;
};
