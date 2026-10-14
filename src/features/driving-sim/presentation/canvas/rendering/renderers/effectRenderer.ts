import { CANVAS_WIDTH, CANVAS_HEIGHT, ROAD_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { MirrorVehicle } from '@/features/driving-sim/domain/scene/SceneNode';
import { drawMirrorVehicle } from './vehicleRenderer';

/**
 * Driver-view alerts: things the cockpit tells you, rather than things on the
 * road.
 *
 * Every other file under `rendering/` draws a world object — a sign stands
 * somewhere, a car occupies a lane. What is here is neither. A rear-view
 * mirror is a piece of the vehicle you are sitting in, and a siren glow is a
 * property of the light reaching you, so both are drawn in canvas space at
 * fixed positions and neither has a road distance or a hitbox.
 *
 * They exist because of a specific failure. The board shows the road ahead and
 * about 150px of it behind, and the touch controls sit over the bottom of that
 * strip — so a vehicle closing from behind spent nearly all of its approach
 * either off the bottom of the frame or underneath the controls, and arrived
 * with no warning at all. A real driver has mirrors and can hear a siren
 * several seconds before they can see it; without something standing in for
 * that, "yield to the ambulance" is a reaction test with the cue removed.
 */

/**
 * The mirror housing, centred near the top of the board. `MIRROR_TOP` sits
 * below the HUD's top bar and progress bar (which occupy roughly the first 60
 * canvas pixels) so the mirror has a clear strip to itself — the reserved band
 * the rest of the HUD chrome was cleared out of. Its label rides just above it.
 */
const MIRROR_WIDTH = 156;
const MIRROR_HEIGHT = 46;
const MIRROR_TOP = 74;

const flash = (phaseMs: number) => (Math.floor(Date.now() / phaseMs) % 2 === 0 ? 0 : 1);

/**
 * The pulsing wash of red and blue along the bottom of the board.
 *
 * Deliberately at the bottom edge rather than around the whole frame: it is
 * light spilling from something behind you, so it should come from behind. It
 * also survives the touch controls sitting on top of that strip, because a
 * glow reads through a gap between buttons in a way a 40px sprite does not.
 */
export const drawSirenGlow = (ctx: CanvasRenderingContext2D, proximity: number) => {
  if (proximity <= 0) return;
  const lit = flash(260);
  const height = 90 + proximity * 40;

  ctx.save();
  const grad = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, CANVAS_HEIGHT - height);
  const hue = lit ? '59,130,246' : '239,68,68';
  grad.addColorStop(0, `rgba(${hue},${0.42 * proximity})`);
  grad.addColorStop(1, `rgba(${hue},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, CANVAS_HEIGHT - height, CANVAS_WIDTH, height);
  ctx.restore();
};

/**
 * The rear-view mirror, with whatever is behind you in it.
 *
 * `followerX` is the follower's real position on the carriageway, so the lane
 * it is using is the lane you see it in — which is the whole reason to look:
 * an ambulance in your own lane needs you to move, one already past you does
 * not. The road is compressed into the mirror's width the same way a real
 * mirror compresses it.
 */
export const drawRearViewMirror = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  followerX: number,
  proximity: number,
  /**
   * What is back there, as the scenario declared it. The glass draws this
   * vehicle rather than a stand-in for one — see `MirrorVehicle`.
   */
  vehicle: MirrorVehicle
) => {
  if (proximity <= 0) return;

  // Read off the vehicle rather than passed beside it, so the alarm treatment
  // cannot be given to something that is not an emergency vehicle. An
  // ambulance names itself and gets the alternating light bar; a car on your
  // bumper is a fact about the road, not an alarm.
  const emergency = vehicle.kind === 'ambulance';
  const left = (CANVAS_WIDTH - MIRROR_WIDTH) / 2;
  const lit = emergency && flash(260);

  ctx.save();

  // Housing.
  ctx.fillStyle = 'rgba(12,14,22,0.92)';
  ctx.strokeStyle = emergency
    ? (lit ? 'rgba(59,130,246,0.9)' : 'rgba(239,68,68,0.9)')
    : `rgba(250,204,21,${0.45 + proximity * 0.45})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(left, MIRROR_TOP, MIRROR_WIDTH, MIRROR_HEIGHT, 8);
  ctx.fill();
  ctx.stroke();

  // Clip to the glass, so the road behind cannot spill out of the frame.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left + 3, MIRROR_TOP + 3, MIRROR_WIDTH - 6, MIRROR_HEIGHT - 6, 6);
  ctx.clip();

  // The road behind, compressed: the carriageway's full width mapped onto the
  // glass, converging slightly toward the top as distance does.
  // Centred in the glass rather than low in it: the vehicle is now a sprite
  // rather than a blob, so it is tall enough that a few pixels of offset put
  // its wheels through the bottom of the frame.
  const glassMidY = MIRROR_TOP + MIRROR_HEIGHT / 2;
  ctx.fillStyle = '#2a2a3a';
  ctx.beginPath();
  ctx.moveTo(left + 10, MIRROR_TOP + MIRROR_HEIGHT);
  ctx.lineTo(left + MIRROR_WIDTH - 10, MIRROR_TOP + MIRROR_HEIGHT);
  ctx.lineTo(left + MIRROR_WIDTH - 44, MIRROR_TOP + 6);
  ctx.lineTo(left + 44, MIRROR_TOP + 6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(left + MIRROR_WIDTH / 2, MIRROR_TOP + MIRROR_HEIGHT);
  ctx.lineTo(left + MIRROR_WIDTH / 2, MIRROR_TOP + 6);
  ctx.stroke();
  ctx.setLineDash([]);

  // The follower itself, drawn as the vehicle the scenario declared. Its lane
  // on the real road maps to the same share of the mirror's width, and it
  // grows as it closes.
  const share = Math.min(Math.max((followerX - roadX) / ROAD_WIDTH, 0), 1);
  const spread = 56 + proximity * 26;
  const cx = left + MIRROR_WIDTH / 2 + (share - 0.5) * spread * 2;
  const cy = glassMidY + (1 - proximity) * 8;
  // Big enough to be read as a particular vehicle and small enough that the
  // longest sprite still sits inside the glass at its closest. The blob this
  // replaced needed only to be a smudge that grew; a motorcycle has to show
  // its wheels, its bars and its rider, and at the scale the smudge used it
  // was eight pixels of tyre and nothing else.
  const scale = 0.4 + proximity * 0.18;

  drawMirrorVehicle(ctx, vehicle, cx, cy, scale);

  if (emergency) {
    // Light bar, alternating with the glow below so the two read as one vehicle.
    const barWidth = 19 + proximity * 8;
    ctx.fillStyle = lit ? '#3b82f6' : '#ef4444';
    ctx.fillRect(cx - barWidth / 2, cy - 15 - proximity * 6, barWidth, 3);
  }

  ctx.restore();

  // "Behind you" label, so the mirror is legible the first time it appears.
  ctx.fillStyle = emergency
    ? (lit ? 'rgba(147,197,253,0.95)' : 'rgba(252,165,165,0.95)')
    : 'rgba(253,224,71,0.95)';
  ctx.font = 'bold 8px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(emergency ? 'EMERGENCY VEHICLE BEHIND' : 'BEHIND YOU', CANVAS_WIDTH / 2, MIRROR_TOP - 5);
  ctx.textAlign = 'left';

  ctx.restore();
};
