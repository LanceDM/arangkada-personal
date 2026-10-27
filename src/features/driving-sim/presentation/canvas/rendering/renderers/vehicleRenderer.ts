/**
 * The vehicles and animals a scene can put on the road: jeepneys, tricycles,
 * motorcycles, bicycles, a following vehicle, an ambulance, buses, trucks, a
 * broken-down car, a hazard triangle, compliance icons and an animal.
 *
 * `drawOncomingVehicle` and `drawCrossingCar` are in `renderPrimitives`
 * instead, because the junction and crossing renderers need them too;
 * pedestrians are in `pedestrianRenderer`.
 */
import { drawVehicleShadow, bodyGradient, strokeChrome } from '@/features/driving-sim/presentation/canvas/rendering/renderPrimitives';
import type { MirrorVehicle } from '@/features/driving-sim/domain/scene/SceneNode';
import type { MotorcycleRider } from '@/features/driving-sim/domain/scenario/scenarioScene';

export const drawJeepney = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
  braking = false,
  hazards = false
) => {
  drawVehicleShadow(ctx, x, 40 * scale, y + 36 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = bodyGradient(ctx, -20, -30, 20, 30, '#f06152', '#e74c3c', '#b8362a');
  ctx.beginPath();
  ctx.roundRect(-20, -30, 40, 60, 4);
  ctx.fill();
  strokeChrome(ctx);
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(-18, -20, 36, 3);
  ctx.fillRect(-18, -8, 36, 3);
  ctx.fillRect(-18, 4, 36, 3);
  ctx.fillStyle = '#87ceeb';
  ctx.beginPath();
  ctx.roundRect(-16, -28, 32, 12, 3);
  ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 5px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('JEEPNEY', 0, 18);
  ctx.beginPath();
  ctx.arc(-14, -30, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(14, -30, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawTailLamps(ctx, x, y + 30 * scale, 20 * scale, braking);
  if (hazards) drawHazardLamps(ctx, x, y + 30 * scale, y - 30 * scale, 20 * scale);
};

export const drawTricycle = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  drawVehicleShadow(ctx, x, 32 * scale, y + 22 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = bodyGradient(ctx, -6, -18, 6, 18, '#3d5872', '#2c3e50', '#1a2733');
  ctx.beginPath();
  ctx.roundRect(-6, -18, 12, 36, 3);
  ctx.fill();
  strokeChrome(ctx);
  ctx.fillStyle = bodyGradient(ctx, 8, -14, 26, 14, '#f7b449', '#f39c12', '#c8790a');
  ctx.beginPath();
  ctx.roundRect(8, -14, 18, 28, 4);
  ctx.fill();
  strokeChrome(ctx);
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(8, -14, 18, 4);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, 18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(17, 16, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * A motorcycle and its rider, seen from directly above, travelling up the road.
 *
 * Built on the one thing a top-down bike has to get right: the wheels are in
 * line along the direction of travel, one in front of the other. The sprite
 * this replaced put them side by side at the base of a triangle, which from
 * above is a three-wheeler at best and at gameplay size read as an abstract
 * wedge — on the one scenario in the game whose whole subject is recognising a
 * rider beside your door.
 *
 * Drawn nose-up, like every other vehicle travelling the player's way, so it
 * needs no rotation of its own on a straight road and rotates correctly with
 * the frame everywhere it is turned.
 *
 * Kept inside the 24 x 38 body `SHARED_LANE_HITBOX` gives a motorcycle at the
 * 0.9 it is normally drawn at: the handlebars are the widest part at 26, and
 * the wheels set the length at 42. Anything wider would be a sprite whose edges
 * a driver could pass through. What `rider` adds — a back rider, a box over the
 * tail — stays inside the same outline.
 *
 * With no `rider` it draws exactly what it always has: one helmeted rider and a
 * steady tail lamp.
 */
export const drawMotorcycle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
  rider: MotorcycleRider = {}
) => {
  drawVehicleShadow(ctx, x, 16 * scale, y + 19 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Tyres, fore and aft on the long axis. Rounded rather than circular: from
  // above a tyre is a strip of contact, and two circles read as a trike.
  ctx.fillStyle = '#0b0e14';
  ctx.beginPath();
  ctx.roundRect(-3, -20.5, 6, 10.5, 2.5);
  ctx.roundRect(-3.6, 9.5, 7.2, 11.5, 3);
  ctx.fill();

  // The spine between them, and the engine block hanging under the rider.
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(-3.2, -15, 6.4, 27, 2.5);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-5.5, -1, 11, 10, 3);
  ctx.fill();

  // Handlebars: one bar across the front with a grip at each end. The widest
  // thing on the bike, and the detail that says "two wheels and a rider"
  // rather than "small car" at a glance.
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-13, -13.6, 26, 2.8, 1.4);
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-13, -14.6, 4, 4.8, 2);
  ctx.roundRect(9, -14.6, 4, 4.8, 2);
  ctx.fill();

  // Tank and fairing in the bike's own colour, between the bars and the rider.
  ctx.fillStyle = bodyGradient(ctx, -5, -12, 5, 2, '#f87171', '#dc2626', '#991b1b');
  ctx.beginPath();
  ctx.roundRect(-5, -12, 10, 14, 4);
  ctx.fill();
  strokeChrome(ctx);

  // The rider, centred and astride it: arms out to the grips, then shoulders
  // over the tank, then the helmet on top. Painted in this order so the parts
  // nearest the camera are the ones that overlap.
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(-11.5, -12.2, 9, 3.2, 1.6);
  ctx.roundRect(2.5, -12.2, 9, 3.2, 1.6);
  ctx.fill();
  ctx.fillStyle = bodyGradient(ctx, -6.5, -9, 6.5, 8, '#3b4a63', '#27324a', '#161d2c');
  ctx.beginPath();
  ctx.roundRect(-6.5, -9, 13, 17, 5);
  ctx.fill();
  strokeChrome(ctx);

  // Whoever rides behind, over the rear wheel. After the rider's back and
  // before their head, so the two bodies meet the way two people on one seat
  // do and the rider's head stays on top.
  if (rider.backRider) drawBackRider(ctx, rider.backRider);

  // Helmet. A dark shell with a light crown, so it separates from the jacket
  // under it on dark asphalt and still reads as a head at mirror size.
  if (rider.bareheaded) {
    drawBareHead(ctx, -6.5, 4.6);
  } else {
    ctx.fillStyle = '#0b0e14';
    ctx.beginPath();
    ctx.arc(0, -6.5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, -6.5, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-4.2, -10.4, 8.4, 3.4, 1.7);
    ctx.fill();
  }

  // A delivery box over the tail: wider than the rider's shoulders, which is
  // what puts it in the way of both mirrors.
  if (rider.topBox) {
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.roundRect(-9, 8.5, 18, 11.5, 1.5);
    ctx.fill();
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.roundRect(-7.5, 10, 15, 8.5, 1);
    ctx.fill();
  }

  // Headlamp at the front, tail light at the back: which way it is pointing,
  // readable at any size the sprite is drawn at.
  ctx.fillStyle = '#fef9c3';
  ctx.shadowColor = '#fde68a';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.roundRect(-2.6, -19, 5.2, 3.2, 1.6);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Behind whatever now sits over the rear wheel, where the driver following
  // can still see it. A flashing lamp is lit half the time whatever the rider
  // is doing, which is exactly why it tells the driver behind nothing.
  const lampY = rider.backRider || rider.topBox ? 18 : 8.5;
  const lit = rider.tailLamp !== 'blinking' || Math.floor(Date.now() / 250) % 2 === 0;
  ctx.fillStyle = lit ? '#ef4444' : '#450a0a';
  ctx.beginPath();
  ctx.roundRect(-2.4, lampY, 4.8, 2.6, 1.3);
  ctx.fill();

  ctx.restore();
};

/** A head with no helmet on it: hair, seen from above, smaller than a shell. */
const drawBareHead = (ctx: CanvasRenderingContext2D, centreY: number, radius: number) => {
  ctx.fillStyle = '#3b2616';
  ctx.beginPath();
  ctx.arc(0, centreY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c68a5b';
  ctx.beginPath();
  ctx.roundRect(-radius * 0.55, centreY - radius, radius * 1.1, radius * 0.5, radius * 0.25);
  ctx.fill();
};

/** The passenger behind the rider: an adult, or a child a head shorter. */
const drawBackRider = (
  ctx: CanvasRenderingContext2D,
  backRider: NonNullable<MotorcycleRider['backRider']>
) => {
  const child = backRider.kind === 'child';
  const halfWidth = child ? 4.2 : 5.8;
  const top = child ? 6 : 4;
  const length = child ? 8.5 : 12;
  const headY = child ? 9.5 : 10;
  const headRadius = child ? 3.6 : 4.8;

  // A bright shirt against the rider's dark jacket: at the size a motorcycle is
  // drawn, colour is what separates a second person from the first.
  ctx.fillStyle = child
    ? bodyGradient(ctx, -halfWidth, top, halfWidth, top + length, '#fcd34d', '#f59e0b', '#b45309')
    : bodyGradient(ctx, -halfWidth, top, halfWidth, top + length, '#5eead4', '#14b8a6', '#0f766e');
  ctx.beginPath();
  ctx.roundRect(-halfWidth, top, halfWidth * 2, length, 3.5);
  ctx.fill();

  if (backRider.bareheaded) {
    drawBareHead(ctx, headY, headRadius * 0.8);
    return;
  }
  ctx.fillStyle = '#0b0e14';
  ctx.beginPath();
  ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(0, headY, headRadius * 0.72, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * A cyclist travelling your way, seen from above.
 *
 * Deliberately narrow and unarmoured next to `drawMotorcycle`: the whole point
 * of the clearance rule is that this is a person balancing on two thin wheels,
 * not a vehicle. Drawn at the same heading as the player's car, since a cyclist
 * shares the carriageway rather than crossing it.
 */
export const drawBicycle = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  drawVehicleShadow(ctx, x, 12 * scale, y + 14 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // A dark rim under the whole rider, for the reason `drawPedestrian` has one:
  // a cyclist is the narrowest thing sharing this carriageway, and clearance is
  // something the driver has to be able to see before they are asked to leave it.
  ctx.fillStyle = 'rgba(8,10,16,0.8)';
  ctx.beginPath();
  ctx.roundRect(-5, -18, 10, 36, 4);
  ctx.fill();
  // Wheels, thin enough to read as spoked rims rather than tyres.
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -13, 2.5, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 13, 2.5, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Frame running between the hubs.
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 12);
  ctx.stroke();
  // Handlebars across the front, which is what makes the width readable.
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7, -9);
  ctx.lineTo(7, -9);
  ctx.stroke();
  // Rider: torso leaning over the frame, then a helmet.
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.roundRect(-4, -6, 8, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, -8, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

/**
 * A car travelling your way, drawn from behind you — the vertical mirror of
 * `drawOncomingVehicle`, whose nose points down the screen at the player.
 *
 * This one's nose points up, because it is following rather than approaching:
 * headlights at the near end where they fill your mirror, rear window at the
 * far end. Used for the `closing_from_behind` path where the vehicle is an
 * ordinary car rather than the ambulance that path was first written for.
 */
export const drawFollowingVehicle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color = '#dc2626',
  scale = 1
) => {
  drawVehicleShadow(ctx, x, 28 * scale, y + 26 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = bodyGradient(ctx, -14, -24, 14, 24, color, color, '#111827');
  ctx.beginPath();
  ctx.roundRect(-14, -24, 28, 48, 5);
  ctx.fill();
  strokeChrome(ctx);
  // Rear window at the far end of the car, away from the player.
  ctx.fillStyle = '#87ceeb';
  ctx.beginPath();
  ctx.roundRect(-10, 4, 20, 12, 3);
  ctx.fill();
  // Headlights on the near end, filling the mirror of the car in front.
  ctx.fillStyle = '#fef9c3';
  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(-9, -20, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, -20, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
};

/**
 * The lamps on the back of a vehicle you are following.
 *
 * Lit red when it is braking, which is the whole reason a lead vehicle is drawn
 * from behind rather than as another anonymous box: the cue a following driver
 * is entitled to arrives before the gap closes, not after.
 */
const drawTailLamps = (
  ctx: CanvasRenderingContext2D,
  x: number,
  rearY: number,
  halfWidth: number,
  braking: boolean
) => {
  ctx.save();
  ctx.fillStyle = braking ? '#ef4444' : '#7f1d1d';
  if (braking) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
  }
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(x + side * halfWidth - (side > 0 ? 7 : 0), rearY - 4, 7, 4, 1.5);
    ctx.fill();
  }
  ctx.restore();
};

/**
 * Hazard lights: both rear corners, flashing together.
 *
 * Decorative animation, so it reads the clock here rather than being posed by
 * the world: nothing collides with a lamp. What is *not* decided here
 * is whether they are on at all — that is `hazards` on the scenario's own
 * declaration, carried to this frame on the pose.
 */
export const drawHazardLamps = (
  ctx: CanvasRenderingContext2D,
  x: number,
  rearY: number,
  frontY: number,
  halfWidth: number
) => {
  const lit = Math.floor(Date.now() / 480) % 2 === 0;
  ctx.save();
  ctx.fillStyle = lit ? '#f59e0b' : '#7c4a06';
  if (lit) {
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 9;
  }
  for (const side of [-1, 1]) {
    for (const cornerY of [rearY - 4, frontY]) {
      ctx.beginPath();
      ctx.roundRect(x + side * halfWidth - (side > 0 ? 6 : 0), cornerY, 6, 4, 1.5);
      ctx.fill();
    }
  }
  ctx.restore();
};

/**
 * A car travelling ahead of you, seen from behind.
 *
 * Distinct from `drawFollowingVehicle`, which is the car *behind* you and shows
 * its headlights. Which end of a vehicle a driver can see is the difference
 * between reading its brake lights and not, so the two poses are two sprites
 * rather than one drawn twice.
 */
export const drawLeadCar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color = '#e2e8f0',
  braking = false
) => {
  drawVehicleShadow(ctx, x, 30, y + 26);
  ctx.fillStyle = bodyGradient(ctx, x - 15, y - 24, x + 15, y + 24, color, color, '#111827');
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 24, 30, 48, 5);
  ctx.fill();
  strokeChrome(ctx);
  // Rear screen at the near end, since you are looking at the back of it.
  ctx.fillStyle = '#5b7b95';
  ctx.beginPath();
  ctx.roundRect(x - 11, y + 4, 22, 12, 3);
  ctx.fill();
  drawTailLamps(ctx, x, y + 24, 15, braking);
};

/** A panel van: the ordinary light-freight traffic of a general lane. */
export const drawPassengerVan = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  braking = false,
  hazards = false
) => {
  drawVehicleShadow(ctx, x, 34, y + 28);
  ctx.fillStyle = bodyGradient(ctx, x - 17, y - 27, x + 17, y + 27, '#e8edf3', '#cbd5e1', '#64748b');
  ctx.beginPath();
  ctx.roundRect(x - 17, y - 27, 34, 54, 4);
  ctx.fill();
  strokeChrome(ctx);
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(x - 13, y + 2, 26, 13, 2);
  ctx.fill();
  drawTailLamps(ctx, x, y + 27, 17, braking);
  if (hazards) drawHazardLamps(ctx, x, y + 27, y - 27, 17);
};

/**
 * A freight truck: the slow, heavy traffic an expressway keeps out of Lane 1
 * and the reason the overtaking lane exists.
 *
 * Drawn to the body `npcHitbox` gives a truck, so the thing on screen and the
 * thing you can hit are the same size.
 */
export const drawFreightTruck = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  braking = false
) => {
  drawVehicleShadow(ctx, x, 42, y + 34);
  ctx.fillStyle = bodyGradient(ctx, x - 21, y - 33, x + 21, y + 33, '#9aa3ae', '#77808c', '#41474f');
  ctx.beginPath();
  ctx.roundRect(x - 21, y - 33, 42, 66, 4);
  ctx.fill();
  strokeChrome(ctx);
  // Cab at the far end: the truck is facing away up the road.
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.roundRect(x - 19, y - 31, 38, 14, 3);
  ctx.fill();
  // Rear door seam and the reflective chevrons across the tailgate.
  ctx.strokeStyle = 'rgba(15,23,42,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x, y + 26);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
    ctx.fillRect(x - 20 + i * 8, y + 18, 8, 6);
  }
  drawTailLamps(ctx, x, y + 33, 21, braking);
};

export const drawSmokePlume = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  const t = Date.now() * 0.002;
  ctx.fillStyle = 'rgba(75,85,99,0.45)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x - i * 5, y - i * 10 + Math.sin(t + i) * 3, 6 + i * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

export const drawAmbulance = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  drawVehicleShadow(ctx, x, 36 * scale, y + 30 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = bodyGradient(ctx, -18, -28, 18, 28, '#ffffff', '#f8fafc', '#d6dbe1');
  ctx.beginPath();
  ctx.roundRect(-18, -28, 36, 56, 4);
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-3, -14, 6, 16);
  ctx.fillRect(-9, -8, 18, 6);
  ctx.fillStyle = '#87ceeb';
  ctx.beginPath();
  ctx.roundRect(-14, -26, 28, 10, 3);
  ctx.fill();
  const on = Math.floor(Date.now() / 250) % 2 === 0;
  ctx.fillStyle = on ? '#ef4444' : '#1d4ed8';
  ctx.beginPath();
  ctx.arc(-10, -30, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = on ? '#1d4ed8' : '#ef4444';
  ctx.beginPath();
  ctx.arc(10, -30, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const drawHazardTriangle = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(-14, 12);
  ctx.lineTo(14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(-9, 7);
  ctx.lineTo(9, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ea580c';
  ctx.font = 'bold 12px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('!', 0, 4);
  ctx.restore();
};

export const drawComplianceIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glyph: string,
  bg: string
) => {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x, y + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
};

/** An animal standing in the road. */
export const drawAnimal = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4b4034';
  ctx.beginPath();
  ctx.roundRect(x - 22, y - 10, 44, 22, 8);
  ctx.fill();
  ctx.fillStyle = '#3a3129';
  ctx.beginPath();
  ctx.arc(x + 24, y - 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d6cbb8';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 22, y - 15);
  ctx.quadraticCurveTo(x + 30, y - 22, x + 36, y - 14);
  ctx.stroke();
  ctx.fillStyle = '#2f2822';
  for (const dx of [-16, -6, 8, 16]) ctx.fillRect(x + dx, y + 10, 4, 8);
  ctx.restore();
};

/* ------------------------------------------------------------------------- *
 * Larger vehicles
 * ------------------------------------------------------------------------- */

/**
 * A truck drawn overloaded rather than merely large.
 *
 * Level 10 asks the driver to keep off the tail of a vehicle that is over its
 * rated weight, and a truck whose load sits inside its own side rails would
 * show a perfectly legal one — the crates standing proud of the roofline are
 * the violation the event is about, so they are what gets drawn.
 */
export const drawOverloadedTruck = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawVehicleShadow(ctx, x, 34, y + 32);
  ctx.fillStyle = bodyGradient(ctx, x - 17, y - 32, x + 17, y + 32, '#8a8f98', '#6b7280', '#3f4652');
  ctx.beginPath();
  ctx.roundRect(x - 17, y - 32, 34, 64, 4);
  ctx.fill();
  strokeChrome(ctx);
  // Cab, at the far end since the truck faces away from the player.
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 30, 30, 13, 3);
  ctx.fill();
  // The load, stacked past the side rails and leaning.
  ctx.save();
  ctx.translate(x, y + 4);
  ctx.rotate(0.06);
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.roundRect(-21, -14, 42, 28, 2);
  ctx.fill();
  ctx.strokeStyle = '#713f12';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-21, 0);
  ctx.lineTo(21, 0);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 14);
  ctx.stroke();
  ctx.restore();
  // The single rope holding all of it on.
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 2);
  ctx.lineTo(x + 22, y + 6);
  ctx.stroke();
};

/** A provincial bus, the largest thing that shares the carriageway. */
export const drawProvincialBus = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  braking = false
) => {
  drawVehicleShadow(ctx, x, 36, y + 34);
  ctx.fillStyle = bodyGradient(ctx, x - 18, y - 35, x + 18, y + 35, '#2f7bd6', '#1565c0', '#0d3f7a');
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 35, 36, 70, 5);
  ctx.fill();
  strokeChrome(ctx);
  ctx.fillStyle = '#87ceeb';
  ctx.beginPath();
  ctx.roundRect(x - 14, y - 30, 28, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 5px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('PROVINCIAL', x, y + 5);
  drawTailLamps(ctx, x, y + 35, 18, braking);
};

/**
 * A bus coming the other way, facing you.
 *
 * Drawn from its own front: a windscreen at the near end and headlamps below
 * it, so the thing bearing down on you reads as a bus rather than as a large
 * rectangle. The body matches `HITBOX_SIZE.oncoming_through` at the width a
 * bus needs, which is what makes the lane it is using unmistakable.
 */
export const drawOncomingBus = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawVehicleShadow(ctx, x, 34, y + 30);
  ctx.fillStyle = bodyGradient(ctx, x - 17, y - 32, x + 17, y + 32, '#2f7bd6', '#1565c0', '#0d3f7a');
  ctx.beginPath();
  ctx.roundRect(x - 17, y - 32, 34, 64, 5);
  ctx.fill();
  strokeChrome(ctx);
  // Windscreen at the near end — it is coming toward you.
  ctx.fillStyle = '#9fd3f0';
  ctx.beginPath();
  ctx.roundRect(x - 13, y + 14, 26, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(x + side * 15 - (side > 0 ? 6 : 0), y + 28, 6, 4, 1.5);
    ctx.fill();
  }
};

/** A truck coming the other way, facing you. */
export const drawOncomingTruck = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawVehicleShadow(ctx, x, 40, y + 30);
  ctx.fillStyle = bodyGradient(ctx, x - 20, y - 30, x + 20, y + 30, '#9aa3ae', '#77808c', '#41474f');
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 30, 40, 60, 4);
  ctx.fill();
  strokeChrome(ctx);
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.roundRect(x - 18, y + 12, 36, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(x + side * 18 - (side > 0 ? 6 : 0), y + 26, 6, 4, 1.5);
    ctx.fill();
  }
};

/** A vehicle failing its emissions test, with the plume that gives it away. */
export const drawSmokeBelcher = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawVehicleShadow(ctx, x, 32, y + 22);
  ctx.fillStyle = bodyGradient(ctx, x - 16, y - 22, x + 16, y + 22, '#4b5563', '#374151', '#1f2937');
  ctx.beginPath();
  ctx.roundRect(x - 16, y - 22, 32, 44, 4);
  ctx.fill();
  strokeChrome(ctx);
  drawSmokePlume(ctx, x - 14, y - 22);
};


/**
 * A car body seen from above, with a cabin, glass and wheels.
 *
 * The one shape every vehicle on this road was missing. A rounded rectangle
 * with a gradient reads as a block at gameplay scale — the wreck drawn that way
 * was reported from a playtest as "a plain square" — so the parts that make a
 * car legible from above are drawn: four wheels proud of the body, a cabin
 * inset, a windscreen and a rear window, and a roof line between them.
 *
 * Drawn around the origin so a caller can rotate it: a vehicle across a lane is
 * the same body at an angle, not a different sprite.
 */
const drawCarBody = (
  ctx: CanvasRenderingContext2D,
  width: number,
  length: number,
  light: string,
  mid: string,
  dark: string
) => {
  const halfW = width / 2;
  const halfL = length / 2;

  // Wheels first, so the body sits over them and only their outer edge shows.
  ctx.fillStyle = '#18181b';
  const wheelW = 5;
  const wheelL = length * 0.2;
  for (const dx of [-halfW - 1, halfW + 1 - wheelW]) {
    for (const dy of [-halfL * 0.62, halfL * 0.62 - wheelL]) {
      ctx.beginPath();
      ctx.roundRect(dx, dy, wheelW, wheelL, 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = bodyGradient(ctx, -halfW, -halfL, halfW, halfL, light, mid, dark);
  ctx.beginPath();
  ctx.roundRect(-halfW, -halfL, width, length, Math.min(7, width * 0.22));
  ctx.fill();
  strokeChrome(ctx);

  // Cabin: a darker inset with a windscreen at the far end and a rear window at
  // the near one, which is what tells a viewer which way the car is pointing.
  ctx.fillStyle = 'rgba(15,23,42,0.55)';
  ctx.beginPath();
  ctx.roundRect(-halfW * 0.74, -halfL * 0.34, width * 0.74, length * 0.5, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(148,197,253,0.42)';
  ctx.beginPath();
  ctx.roundRect(-halfW * 0.66, -halfL * 0.3, width * 0.66, length * 0.16, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-halfW * 0.66, halfL * 0.02, width * 0.66, length * 0.13, 2);
  ctx.fill();
};

/**
 * A car that has been in a crash: slewed across the lane, front end folded in,
 * smoking.
 *
 * Everything here is what tells a driver at a glance that this is a wreck and
 * not traffic: the angle across the lane, the crushed nose bitten out of the
 * body rather than drawn as a neat edge, the crazed windscreen, and the smoke
 * lifting off the engine bay. The `crashed_car` body is wider than it is long
 * for the same reason — it is lying across the road, and the shape that can be
 * seen is the shape that can be hit.
 */
export const drawCrashedCar = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawVehicleShadow(ctx, x, 50, y + 16);
  ctx.save();
  ctx.translate(x, y);
  // Slewed, not square to the road. The body is authored nose-up and turned
  // most of a right angle, which is what puts it across the lane.
  ctx.rotate(-1.15);
  drawCarBody(ctx, 30, 50, '#b91c1c', '#7f1d1d', '#450a0a');

  // The folded nose, bitten out rather than squared off.
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.moveTo(-15, -25);
  ctx.lineTo(-4, -14);
  ctx.lineTo(6, -25);
  ctx.lineTo(15, -15);
  ctx.lineTo(15, -25);
  ctx.closePath();
  ctx.fill();

  // Crazed glass.
  ctx.strokeStyle = 'rgba(226,232,240,0.7)';
  ctx.lineWidth = 0.8;
  for (const [ax, ay, bx, by] of [
    [-8, -6, 2, -1],
    [-3, -7, -6, 0],
    [4, -6, 0, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.restore();

  // Smoke off the engine bay, drawn unrotated so it always lifts up the screen.
  drawSmokePlume(ctx, x - 12, y - 14);
  drawSmokePlume(ctx, x - 4, y - 20);
};

/** A vehicle stopped dead in the lane, with its warning triangle set out behind. */
export const drawBrokenDownVehicle = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawVehicleShadow(ctx, x, 32, y + 22);
  ctx.save();
  ctx.translate(x, y);
  drawCarBody(ctx, 32, 44, '#a0431e', '#7c2d12', '#4d1b0b');
  ctx.restore();
  // The lid up, which is what says "stopped and being worked on" rather than
  // "parked": a pale wedge standing off the nose.
  ctx.fillStyle = 'rgba(203,213,225,0.55)';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 22);
  ctx.lineTo(x + 13, y - 22);
  ctx.lineTo(x + 8, y - 31);
  ctx.lineTo(x - 8, y - 31);
  ctx.closePath();
  ctx.fill();
  drawHazardTriangle(ctx, x, y + 34, 0.8);
};

/**
 * The vehicle behind you, drawn small enough for the rear-view glass.
 *
 * The one dispatch from a declared `vehicleKind` to a sprite for the mirror,
 * so the glass and the road cannot draw two different vehicles from one
 * declaration. Exhaustive over the kinds on purpose: a new one cannot be added
 * without deciding what it looks like in a mirror, which is the failure this
 * replaced — the glass drew a single generic white body with a red stripe for
 * everything, and a scenario that declared a motorcycle showed what most
 * players read as an ambulance.
 *
 * A car keeps `drawFollowingVehicle`, which is the sprite a car behind the
 * player is already drawn with on the road: ordinary traffic looks exactly as
 * it did. Every other kind gets its own sprite at the same scale, and each of
 * them is drawn nose-up, toward the driver, as a vehicle behind you is.
 */
export const drawMirrorVehicle = (
  ctx: CanvasRenderingContext2D,
  vehicle: MirrorVehicle,
  x: number,
  y: number,
  scale: number
) => {
  // Scaled once here rather than per sprite, because three of them take no
  // scale of their own and giving them one would change how every road they
  // are drawn on looks. The two-wheelers are lifted a little: a sprite already
  // narrow on the road disappears in a glass a third the size.
  const lift = vehicle.kind === 'motorcycle' || vehicle.kind === 'bicycle' ? 1.35 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * lift, scale * lift);
  switch (vehicle.kind) {
    case 'car':
      drawFollowingVehicle(ctx, 0, 0, vehicle.color ?? '#f8fafc');
      break;
    case 'motorcycle':
      drawMotorcycle(ctx, 0, 0);
      break;
    case 'bicycle':
      drawBicycle(ctx, 0, 0);
      break;
    case 'ambulance':
      drawAmbulance(ctx, 0, 0);
      break;
    case 'jeepney':
      drawJeepney(ctx, 0, 0);
      break;
    case 'van':
      drawPassengerVan(ctx, 0, 0);
      break;
    case 'truck':
      drawFreightTruck(ctx, 0, 0);
      break;
    case 'bus':
      drawProvincialBus(ctx, 0, 0);
      break;
  }
  ctx.restore();
};
