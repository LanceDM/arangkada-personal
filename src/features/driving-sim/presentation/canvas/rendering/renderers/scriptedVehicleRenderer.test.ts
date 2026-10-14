/**
 * A scripted vehicle is drawn as what the scenario said it is, at the size the
 * collision pass says it is.
 *
 * Two failures this rules out, both of which the level that preceded it had a
 * version of. The first is a scenario that names a freight truck and gets an
 * anonymous car, which makes the prose a lie the picture cannot correct. The
 * second is a sprite that does not match its body — a truck drawn forty-two
 * pixels wide and hit at thirty is a vehicle whose edges you can drive through,
 * and one drawn thirty and hit at forty-two stops you on clear road.
 */
import { describe, expect, it } from 'vitest';
import { recordingCanvasContext } from '@/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import { drawScriptedVehicle } from './scriptedVehicleRenderer';
import {
  SHARED_LANE_HITBOX,
  npcHitbox,
  type NpcTransform,
} from '@/features/driving-sim/domain/systems/updateNpcVehicles';
import { ROAD_ACTORS } from '@/features/driving-sim/domain/world/roadActors';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';

const AT: NpcTransform = { x: 0, y: 0, heading: 0, active: true, solid: true };

const spec = (vehicleKind: NpcVehicleSpec['vehicleKind']): NpcVehicleSpec => ({
  path: 'travelling_ahead',
  vehicleKind,
  label: `a ${vehicleKind}`,
});

/** What one call to the renderer asked the canvas for. */
const paint = (
  vehicleKind: NpcVehicleSpec['vehicleKind'],
  at: NpcTransform = AT
): { ops: string[]; digest: string } => {
  const { ctx, recording } = recordingCanvasContext();
  drawScriptedVehicle(ctx, spec(vehicleKind), 'leading', at);
  return recording();
};

/** Every axis-aligned box the sprite laid down, in the order it drew them. */
const boxes = (ops: string[]) =>
  ops.flatMap(op => {
    const match = /^(?:roundRect|fillRect)\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(op);
    return match
      ? [{ x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) }]
      : [];
  });

const KINDS = Object.keys(SHARED_LANE_HITBOX) as Array<NpcVehicleSpec['vehicleKind']>;

describe('a vehicle travelling ahead of you', () => {
  it('is drawn differently for every kind a scenario can declare', () => {
    const digests = new Map<string, string>();
    for (const kind of KINDS) digests.set(kind, paint(kind).digest);
    // Seven kinds, seven pictures: if two shared one, a scenario could name a
    // truck and be drawn a van with nothing on screen to say so.
    expect(new Set(digests.values()).size).toBe(KINDS.length);
  });

  it('draws its own sprites at exactly the body the collision pass gives them', () => {
    // The three drawn for this path specifically. Their body is laid down as a
    // single rounded rect, so the sprite's size and the hitbox's are the same
    // pair of numbers written twice — and this is what keeps them that way.
    const mismatched: string[] = [];

    for (const kind of ['car', 'van', 'truck'] as const) {
      const body = npcHitbox(spec(kind), AT)!;
      const drawn = boxes(paint(kind).ops);
      const matches = drawn.some(
        box => Math.abs(box.width - body.width) < 0.5 && Math.abs(box.height - body.height) < 0.5
      );
      if (!matches) {
        mismatched.push(
          `${kind}: hit at ${body.width}x${body.height}, drawn as ${drawn
            .map(box => `${box.width}x${box.height}`)
            .join(', ')}`
        );
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('gives a kind the same body wherever it is drawn', () => {
    // The rest reuse the sprites a road actor is drawn with, at the same
    // scales, so they must be hit at the same size. Two tables disagreeing
    // about how big a jeepney is would mean a jeepney you can clip the corner
    // of on one path and are stopped short of on the other. `bicycle` is the
    // newest of them, and the one where the difference would matter most: the
    // clearance a driver leaves a cyclist is the gap they can see.
    for (const kind of ['jeepney', 'motorcycle', 'ambulance', 'bus', 'bicycle'] as const) {
      expect(SHARED_LANE_HITBOX[kind], `${kind} is two different sizes`).toEqual({
        width: ROAD_ACTORS[kind].width,
        height: ROAD_ACTORS[kind].height,
      });
    }
  });

  it('shows brake lights, and only when the world says it is braking', () => {
    // The cue a following driver is entitled to. Without it the gap closes with
    // nothing on screen to have reacted to, which is an ambush rather than a
    // following-distance test.
    for (const kind of ['car', 'van', 'truck'] as const) {
      const calm = paint(kind);
      const braking = paint(kind, { ...AT, braking: true });
      expect(braking.digest, `${kind} draws the same picture braking as not`).not.toBe(calm.digest);
    }
  });

  it('draws nothing at all when the world has not put it on the road', () => {
    const { ctx, recording } = recordingCanvasContext();
    drawScriptedVehicle(ctx, spec('truck'), 'leading', null);
    expect(recording().ops).toEqual([]);
  });
});

describe('a vehicle coming down an entry ramp', () => {
  it('is turned onto the line its ramp runs, rather than drawn flat', () => {
    const { ctx, recording } = recordingCanvasContext();
    drawScriptedVehicle(ctx, { ...spec('car'), path: 'merging_from_ramp' }, 'merging', {
      ...AT,
      heading: 0.6,
    });
    const ops = recording().ops;
    expect(ops).toContain('rotate(0.6)');
    expect(ops[0]).toBe('save()');
    expect(ops[ops.length - 1]).toBe('restore()');
  });
});

describe('what a motorcycle carries', () => {
  /** The motorcycle travelling ahead, carrying `rider`, at a frozen instant. */
  const riding = (rider: NpcVehicleSpec['rider'], now = 1_760_000_000_000) => {
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const { ctx, recording } = recordingCanvasContext();
      drawScriptedVehicle(ctx, { ...spec('motorcycle'), rider }, 'leading', AT);
      return recording();
    } finally {
      Date.now = realNow;
    }
  };

  it('with nothing declared, is the lone helmeted rider it always was', () => {
    expect(riding(undefined).digest).toBe(riding({}).digest);
  });

  it('draws every detail a scenario can declare as its own picture', () => {
    // Each is the whole cue of a Level 11 scenario, so no two may look alike,
    // and none may look like the rider the sprite draws by default.
    const pictures = [
      riding({}),
      riding({ bareheaded: true }),
      riding({ backRider: { kind: 'adult' } }),
      riding({ backRider: { kind: 'child', bareheaded: true } }),
      riding({ topBox: true }),
    ].map(picture => picture.digest);
    expect(new Set(pictures).size).toBe(pictures.length);
  });

  it('draws no helmet on a rider who is not wearing one', () => {
    // The helmet's light crown is the one thing that says "helmet" from above.
    const crown = (ops: string[]) => ops.filter(op => op === 'fillStyle=#e2e8f0');
    expect(crown(riding({}).ops).length).toBeGreaterThan(0);
    expect(crown(riding({ bareheaded: true }).ops)).toEqual([]);
  });

  it('flashes a blinker tail lamp whatever the rider is doing, and holds a steady one', () => {
    const at = (rider: NpcVehicleSpec['rider'], ms: number) => riding(rider, 1_760_000_000_000 + ms).digest;
    expect(at({ tailLamp: 'blinking' }, 0)).not.toBe(at({ tailLamp: 'blinking' }, 250));
    expect(at({}, 0)).toBe(at({}, 250));
  });

  it('keeps what it carries inside the body the collision pass hits', () => {
    // Drawn at 0.9 through the context, so the sprite's own coordinates are
    // scaled by that before they are compared with the 24 x 38 body.
    const body = SHARED_LANE_HITBOX.motorcycle;
    const { ops } = riding({ backRider: { kind: 'adult' }, topBox: true, tailLamp: 'blinking' });
    const outside = boxes(ops).filter(
      box =>
        Math.abs(box.x) * 0.9 > body.width / 2 + 1.5 ||
        Math.abs(box.x + box.width) * 0.9 > body.width / 2 + 1.5 ||
        Math.abs(box.y) * 0.9 > body.height / 2 + 1 ||
        Math.abs(box.y + box.height) * 0.9 > body.height / 2 + 1
    );
    expect(outside).toEqual([]);
  });
});
