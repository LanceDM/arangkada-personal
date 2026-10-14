/**
 * Every person drawn on the road: the pedestrian sprite itself, the group
 * composer that puts a scene's declared `pedestrians` on a crossing, and the
 * LTO checkpoint officer.
 *
 * `drawPedestrian` is the single sprite every category file reaches for —
 * crossingRenderer.ts composes it onto a crosswalk, junctionRenderer.ts and checkpointRenderer.ts
 * use the officer. Nothing here knows about a zebra, a driveway or a sign
 * post; that composition happens in the file that owns the road furniture.
 */
import type { CrossingPedestrian, PedestrianKind } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { crossingPedestrianPositions } from '@/features/driving-sim/domain/world/sceneGeometry';

/**
 * Somebody on foot, at the size the collision pass gives them.
 *
 * The silhouette carries a contact shadow and a dark rim because a person is
 * the smallest thing on this board and the one it costs most to miss: against
 * dark asphalt a 10-pixel figure with no edge simply is not read, and a
 * scenario whose whole subject is a pedestrian then has no subject on screen.
 * The footprint is unchanged, so the sprite and its body still agree.
 */
export const drawPedestrian = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'student' | 'lola' | 'pwd' | 'regular' = 'regular'
) => {
  ctx.save();
  ctx.translate(x, y);
  // Contact shadow: what separates a figure from the road under it.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const bodyColor =
    type === 'student' ? '#ffffff' :
    type === 'lola'    ? '#c98b4b' :
    type === 'pwd'     ? '#4169e1' : '#94a3b8';
  // One dark rim behind the whole figure, so every part of it has an edge.
  ctx.fillStyle = 'rgba(8,10,16,0.85)';
  ctx.beginPath();
  ctx.arc(0, -10, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5.2, -6, 10.4, 16);
  ctx.fillRect(-5.2, 9, 4.2, 9.5);
  ctx.fillRect(0.2, 9, 4.2, 9.5);
  ctx.fillStyle = '#deb887';
  ctx.beginPath();
  ctx.arc(0, -10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-4, -5, 8, 14);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-4, 9, 3, 8);
  ctx.fillRect(1, 9, 3, 8);
  if (type === 'student') {
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(4, -3, 4, 8);
  } else if (type === 'lola') {
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(8, 17);
    ctx.stroke();
  } else if (type === 'pwd') {
    ctx.strokeStyle = '#4169e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 12, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

export const drawCheckpointOfficer = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.roundRect(-22, -6, 20, 34, 3);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-22, -6, 20, 5);
  ctx.fillStyle = '#deb887';
  ctx.beginPath();
  ctx.arc(6, -14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(2, -9, 8, 14);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(2, 5, 3, 8);
  ctx.fillRect(7, 5, 3, 8);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(13, -12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 5px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('STOP', 13, -10.5);
  ctx.restore();
};

/**
 * An enforcer standing on the right verge, arm out over the curb toward the
 * traffic with a STOP paddle: the officer of `drawCheckpointOfficer` without the
 * booth, facing the other way, because a traffic stop flags a car over to the
 * curb rather than holding it at a barrier.
 */
export const drawFlaggingEnforcer = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.translate(x, y);
  // Uniform, with a reflective band across it.
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(-4, -9, 8, 14);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-4, -4, 8, 2);
  // Head and cap.
  ctx.fillStyle = '#deb887';
  ctx.beginPath();
  ctx.arc(0, -14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-5, -20, 10, 3);
  // Legs.
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-4, 5, 3, 8);
  ctx.fillRect(1, 5, 3, 8);
  // The arm out toward the road, and the paddle at the end of it.
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(-14, -8, 10, 3);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(-18, -10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 5px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('STOP', -18, -8.5);
  ctx.restore();
};

/** Sprite variant `drawPedestrian` draws for each scenario-level kind. */
type PedestrianSprite = 'student' | 'lola' | 'pwd' | 'regular';

export const SPRITE_FOR_KIND: Record<PedestrianKind, PedestrianSprite> = {
  child: 'student',
  elderly: 'lola',
  pwd: 'pwd',
  adult: 'regular',
};


/**
 * The people on a crossing, drawn and made solid.
 *
 * Independent of which crossing they are standing on: this takes a road
 * position and a list of people, and knows nothing about zebras, signs,
 * schools or driveways. A scene that wants three children on a crossing asks
 * for three children; the crossing itself is unchanged and unaware.
 *
 * Exactly the ones marked `solid` register a hitbox. A crossing normally has
 * one — the person the event is actually about — with the rest of the group
 * standing clear as scenery, which is how a crossing has always been able to
 * end the run without every bystander being a wall.
 */
export const drawCrossingPedestrians = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  people: readonly CrossingPedestrian[]
) => {
  crossingPedestrianPositions(roadX, people).forEach((x, index) => {
    drawPedestrian(ctx, x, screenY - 13, SPRITE_FOR_KIND[people[index].kind]);
  });
};

