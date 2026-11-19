/**
 * Roadside sign faces and the dispatcher that picks between them.
 * `drawSignFace` switches on `SignPlate.art` (octagon, triangle_down,
 * triangle_up, circle_bar, circle_prohibit, circle_limit, diamond, crossbuck,
 * rect_instruction, signal_head) — every `event.sign` in the game is drawn
 * through it. `chevron` and `obstruction` art stand in the road itself, so
 * their scene (not this dispatcher) draws them.
 */
import { drawSignalHead } from '@/features/driving-sim/presentation/canvas/rendering/renderPrimitives';
import type { SignPlate } from '@/features/driving-sim/domain/scenario/scenarioScene';

const drawSignPost = (ctx: CanvasRenderingContext2D, x: number, y: number, height = 28) => {
  ctx.save();
  ctx.fillStyle = '#64748b';
  ctx.fillRect(x - 2, y, 4, height);
  ctx.fillStyle = '#334155';
  ctx.fillRect(x - 5, y + height - 2, 10, 3);
  ctx.restore();
};

export const drawStopRoadSign = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawSignPost(ctx, x, y + 15, 30);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + i * Math.PI / 4;
    const px = Math.cos(angle) * 17;
    const py = Math.sin(angle) * 17;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('STOP', 0, 3);
  ctx.restore();
};

export const drawYieldRoadSign = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawSignPost(ctx, x, y + 16, 29);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(-20, -15);
  ctx.lineTo(20, -15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(-13, -9);
  ctx.lineTo(13, -9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 5px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('YIELD', 0, 1);
  ctx.restore();
};

export const drawNoEntryRoadSign = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawSignPost(ctx, x, y + 16, 29);
  ctx.save();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 12, y - 4, 24, 8);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

/**
 * Warning sign: a white triangle, point up, with a red border, as the LTO
 * manual draws Philippine warning signs (it was a yellow diamond until the
 * catalogue review of 2026-10-28). The art name stays `diamond` so no content
 * file changes. `label` selects a pictogram where one exists and is otherwise
 * painted on the face as short text, so a new warning sign only needs a
 * pictogram when a word will not do.
 */
export const drawWarningRoadSign = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string
) => {
  drawSignPost(ctx, x, y + 18, 29);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.lineTo(-25, 17);
  ctx.lineTo(25, 17);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = '#1f2937';
  ctx.strokeStyle = '#1f2937';
  ctx.lineCap = 'round';
  if (label === 'TURN' || label === 'BEND') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.quadraticCurveTo(-8, -4, 5, -8);
    ctx.lineTo(10, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -8);
    ctx.lineTo(4, -13);
    ctx.moveTo(10, -8);
    ctx.lineTo(4, -3);
    ctx.stroke();
  } else if (label === 'PED') {
    ctx.beginPath();
    ctx.arc(0, -9, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-3, 5);
    ctx.moveTo(-1, -1);
    ctx.lineTo(6, 2);
    ctx.moveTo(-2, 5);
    ctx.lineTo(-7, 11);
    ctx.moveTo(-2, 5);
    ctx.lineTo(4, 12);
    ctx.stroke();
  } else if (label === 'MERGE') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, 12);
    ctx.lineTo(-2, -2);
    ctx.moveTo(9, 12);
    ctx.quadraticCurveTo(8, 2, -2, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, -11);
    ctx.lineTo(-8, -1);
    ctx.lineTo(4, -1);
    ctx.closePath();
    ctx.fill();
  } else if (label === 'SKID') {
    // A car with the road sliding away under it, which is what the official
    // slippery-road sign shows. The word "SKID" meant nothing on a sign face.
    ctx.lineWidth = 2;
    ctx.strokeRect(-6, -12, 12, 16);
    ctx.fillRect(-6, -12, 12, 4);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const dy of [8, 13]) {
      ctx.beginPath();
      ctx.moveTo(-11, dy);
      ctx.quadraticCurveTo(-3, dy - 4, 3, dy);
      ctx.quadraticCurveTo(8, dy + 4, 12, dy - 1);
      ctx.stroke();
    }
  } else if (label === 'CROSSROADS') {
    // The junction itself, as the intersection-warning signs actually show it.
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, 13);
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
  } else if (label === 'SIDE_ROAD') {
    // A minor road meeting a through road from one side.
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, 13);
    ctx.moveTo(0, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
  } else if (label === 'YIELD_AHEAD') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -7);
    ctx.lineTo(10, -7);
    ctx.lineTo(0, 11);
    ctx.closePath();
    ctx.stroke();
  } else if (label) {
    // Fitted, not merely centred. A diamond is a square on its point, so the
    // widest line it can hold at the middle is narrower than the square is
    // wide — and an unfitted `fillText` spilled "NARROW" past the yellow and
    // left the sign reading "ARROW".
    fitDiamondLabel(ctx, label);
  }
  ctx.restore();
};

/** How wide a line may be across the middle of the diamond face, in px. */
const DIAMOND_TEXT_WIDTH = 34;

/**
 * A word (or two) written inside the diamond, shrunk until it fits.
 *
 * Two lines where the label has a space in it, one otherwise, and the size
 * steps down until the longest line measures inside the face. Nothing is ever
 * clipped and nothing is ever drawn outside the yellow.
 */
const fitDiamondLabel = (ctx: CanvasRenderingContext2D, label: string) => {
  const words = label.split(' ');
  const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : words;
  let size = 11;
  const fits = () => {
    ctx.font = `bold ${size}px Inter`;
    return lines.every(line => ctx.measureText(line).width <= DIAMOND_TEXT_WIDTH);
  };
  while (size > 5 && !fits()) size -= 1;
  ctx.font = `bold ${size}px Inter`;
  ctx.textAlign = 'center';
  const lead = size + 1;
  const top = -((lines.length - 1) * lead) / 2 + size / 3;
  lines.forEach((line, index) => ctx.fillText(line, 0, top + index * lead));
};

/** Red-ringed prohibition disc with a pictogram struck through. */
export const drawProhibitionSign = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glyph = ''
) => {
  drawSignPost(ctx, x, y + 17, 29);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#1f2937';
  ctx.fillStyle = '#1f2937';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (glyph === 'LEFT' || glyph === 'RIGHT') {
    const dir = glyph === 'LEFT' ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(0, -1);
    ctx.lineTo(dir * 7, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dir * 12, -1);
    ctx.lineTo(dir * 6, -6);
    ctx.lineTo(dir * 6, 4);
    ctx.closePath();
    ctx.fill();
  } else if (glyph === 'U') {
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.lineTo(-6, -2);
    ctx.quadraticCurveTo(-6, -8, 0, -8);
    ctx.quadraticCurveTo(6, -8, 6, -2);
    ctx.lineTo(6, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 9);
    ctx.lineTo(2, 2);
    ctx.lineTo(10, 2);
    ctx.closePath();
    ctx.fill();
  } else if (glyph) {
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(glyph, 0, 4);
  }

  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10.5, 10.5);
  ctx.lineTo(10.5, -10.5);
  ctx.stroke();
  ctx.restore();
};

/** White disc with a red ring and the posted number on it. */
export const drawSpeedRoadSign = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glyph = ''
) => {
  drawSignPost(ctx, x, y + 17, 29);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 13px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(glyph, x, y + 5);
  ctx.restore();
};

/** Rectangular instruction board, wrapped onto two lines when it needs to be. */
export const drawInstructionRoadSign = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glyph = ''
) => {
  const words = glyph.split(' ');
  const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : words;
  const width = 62;
  const height = lines.length > 1 ? 34 : 24;

  drawSignPost(ctx, x, y + height / 2, 28);
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 3);
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 9px Inter';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + 4 + (i - (lines.length - 1) / 2) * 11);
  });
  ctx.restore();
};

/** Roadwork's warning triangle, point up, on a post. */
export const drawRoadworkRoadSign = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawSignPost(ctx, x, y + 15, 30);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-18, 14);
  ctx.lineTo(18, 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 15px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('!', 0, 11);
  ctx.restore();
};

/** Crossed white plates marking a railway level crossing. */
export const drawCrossbuckSign = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawSignPost(ctx, x, y + 16, 30);
  ctx.save();
  ctx.translate(x, y);
  for (const angle of [-Math.PI / 5, Math.PI / 5]) {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(-20, -5, 40, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 6px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('RAIL', 0, 2);
  ctx.restore();
};

/** Paints whichever sign face this event declares, at the given post position. */
export const drawSignFace = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sign: SignPlate,
  cleared: boolean
) => {
  switch (sign.art) {
    case 'octagon':
      drawStopRoadSign(ctx, x, y);
      break;
    case 'triangle_down':
      drawYieldRoadSign(ctx, x, y);
      break;
    case 'triangle_up':
      drawRoadworkRoadSign(ctx, x, y);
      break;
    case 'circle_bar':
      drawNoEntryRoadSign(ctx, x, y);
      break;
    case 'circle_prohibit':
      drawProhibitionSign(ctx, x, y, sign.glyph);
      break;
    case 'circle_limit':
      drawSpeedRoadSign(ctx, x, y, sign.glyph);
      break;
    case 'diamond':
      drawWarningRoadSign(ctx, x, y, sign.glyph ?? '');
      break;
    case 'crossbuck':
      drawCrossbuckSign(ctx, x, y);
      break;
    case 'rect_instruction':
      drawInstructionRoadSign(ctx, x, y, sign.glyph);
      break;
    case 'signal_head':
      drawSignalHead(ctx, x, y, sign.aspect ?? 'red', cleared);
      break;
    // Hazard markers stand in the road itself, so the scene places them.
    case 'chevron':
    case 'obstruction':
      break;
  }
};

/* ------------------------------------------------------------------------- *
 * Free-standing signals and plates
 *
 * These are not `SignPlate` faces — no level declares them as a sign, they
 * belong to an event `type` instead — but they are the same kind of object:
 * something standing at the roadside telling the driver a rule.
 * ------------------------------------------------------------------------- */

/** Which lamp on a curbside signal head is lit. */
export type TrafficSignalAspect = 'red' | 'yellow';

/**
 * A three-lamp signal head on its own mast, with one aspect lit.
 *
 * `drawSignalHead` in renderPrimitives.ts is the junction-mounted version, sized and
 * positioned for a scene that has already drawn its own crossroads. This is
 * the standalone one the `red_light`/`yellow_light` events use, kept to the
 * exact geometry each of those two branches was drawing by hand.
 */
export const drawTrafficSignal = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  aspect: TrafficSignalAspect,
  { mast = false }: { mast?: boolean } = {}
) => {
  ctx.save();
  if (mast) {
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 2, y - 5, 4, 67);
  }
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.roundRect(x - 14, y, 28, 55, 6);
  ctx.fill();
  if (mast) {
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Red lamp, then amber, then green, down the head.
  const lamps: Array<[number, boolean, string, string]> = [
    [15, aspect === 'red', '#ef4444', '#3a0000'],
    [33, aspect === 'yellow', '#f59e0b', '#4a3a00'],
    [51, false, '#22c55e', '#003a00'],
  ];
  for (const [offset, lit, onColor, offColor] of lamps) {
    ctx.fillStyle = lit ? onColor : offColor;
    if (lit) {
      ctx.shadowColor = onColor;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(x, y + offset, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
};

/** The round white plate posting a speed, in km/h. */
export const drawSpeedLimitSign = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  limit: number
) => {
  ctx.save();
  ctx.fillStyle = '#666';
  ctx.fillRect(x - 1, y, 3, 20);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(`${limit}`, x, y + 4);
  ctx.restore();
};
