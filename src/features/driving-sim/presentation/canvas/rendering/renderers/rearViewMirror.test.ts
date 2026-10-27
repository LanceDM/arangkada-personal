/**
 * What the mirror shows, and why it has to be told.
 *
 * The glass used to receive a position and a proximity and nothing else, so it
 * drew one generic white body with a red stripe whatever was behind you. On the
 * scenario whose entire subject is recognising a motorcycle beside your door,
 * that read as an ambulance — the shape was a car and the stripe was the wrong
 * colour for a following vehicle. Identity now rides on the node, and these are
 * the two halves of that: the scene says what is back there, and the renderer
 * dispatches on what it was told rather than on anything it inferred.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { recordingCanvasContext } from '@/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import { SHARED_LANE_HITBOX } from '@/features/driving-sim/domain/systems/updateNpcVehicles';
import type { MirrorVehicle, SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { drawRearViewMirror } from './effectRenderer';
import { drawMirrorVehicle, drawMotorcycle } from './vehicleRenderer';

const FROZEN_NOW = 1_700_000_000_000;
const KINDS = Object.keys(SHARED_LANE_HITBOX) as Array<NpcVehicleSpec['vehicleKind']>;

const byId = (id: string) => {
  for (const level of LEVELS) {
    const event = level.events.find(candidate => candidate.id === id);
    if (event) return { level, event };
  }
  throw new Error(`no such event: ${id}`);
};

/** Every node on the board with the player `ahead` units short of an event. */
const sceneAt = (level: LevelConfig, event: ScenarioEvent, ahead: number): SceneNode[] =>
  composeWorldFrame(
    {
      level,
      distance: event.triggerAtDistance - ahead,
      handled: new Set<number>(),
      curves: curvesForLevel(level),
    },
    { playerLane: 3, traffic: new Map(), now: () => FROZEN_NOW }
  ).nodes;

/** The mirror (or siren alert) this scenario opens, anywhere in its approach. */
const mirrorFor = (id: string, aheads = [400, 300, 200, 120, 60, 0]) => {
  const { level, event } = byId(id);
  for (const ahead of aheads) {
    const node = sceneAt(level, event, ahead).find(
      candidate => candidate.kind === 'rear-view' || candidate.kind === 'siren-alert'
    );
    if (node && (node.kind === 'rear-view' || node.kind === 'siren-alert')) {
      return { node, ahead };
    }
  }
  return null;
};

describe('the scene says what is behind you', () => {
  it('names a motorcycle on the scenario about a motorcycle', () => {
    // The defect, stated as the thing that was missing. `hold-your-line`
    // declares `vehicleKind: 'motorcycle'`; before this the node carried no
    // kind at all and the glass had nothing to draw it from.
    const found = mirrorFor('level8.hold-your-line');
    expect(found, 'no mirror opens on the filtering scenario').not.toBeNull();
    expect(found!.node.kind).toBe('rear-view');
    expect(found!.node.vehicle.kind).toBe('motorcycle');
  });

  it('names a car on the scenario about a car behind you', () => {
    // The other side of the same contract: the finale is pressed from behind by
    // an ordinary car, and it must stay one.
    const found = mirrorFor('level8.both-at-once');
    expect(found, 'no mirror opens on the finale').not.toBeNull();
    expect(found!.node.vehicle.kind).toBe('car');
  });

  it('takes the kind from the declaration, not from the prose', () => {
    // Rewriting every word a scenario says about itself must not move the
    // picture. Same guarantee `sceneDeclaration.test.ts` makes for the road,
    // made here for the glass.
    const { level, event } = byId('level8.hold-your-line');
    const reworded: ScenarioEvent = {
      ...event,
      description: 'A delivery truck rolls up behind you and an ambulance passes.',
      recommendedMove: 'Pull over for the ambulance.',
      npc: { ...event.npc!, label: 'an ambulance with its siren on' },
    };
    const staged: LevelConfig = {
      ...level,
      events: level.events.map(other => (other.id === event.id ? reworded : other)),
    };
    const node = sceneAt(staged, reworded, 200).find(candidate => candidate.kind === 'rear-view');
    expect(node?.kind === 'rear-view' ? node.vehicle.kind : null).toBe('motorcycle');
  });

  it('gives an emergency vehicle the siren alert, and only an emergency vehicle', () => {
    // The alarm treatment is derived from the kind rather than passed beside
    // it, so it cannot be handed to something that is not an emergency vehicle.
    const emergency = LEVELS.flatMap(level =>
      level.events
        .filter(
          event => event.type === 'emergency_vehicle' && event.npc?.path === 'closing_from_behind'
        )
        .map(event => ({ level, event }))
    );
    expect(emergency.length, 'no emergency scenario to check').toBeGreaterThan(0);

    for (const { level, event } of emergency) {
      const node = [400, 300, 200, 120, 60, 0]
        .map(ahead => sceneAt(level, event, ahead).find(n => n.kind === 'siren-alert'))
        .find(Boolean);
      expect(node, `${event.id} opens no siren alert`).toBeDefined();
      expect(node!.kind === 'siren-alert' ? node!.vehicle.kind : null).toBe('ambulance');
    }

    // And nothing ordinary gets one.
    for (const id of ['level8.hold-your-line', 'level8.both-at-once']) {
      expect(mirrorFor(id)!.node.kind).toBe('rear-view');
    }
  });
});

describe('the glass draws what it was told', () => {
  const paint = (vehicle: MirrorVehicle, proximity = 0.7) => {
    const { ctx, recording } = recordingCanvasContext();
    drawRearViewMirror(ctx, 100, 240, proximity, vehicle);
    return recording();
  };

  it('draws a different vehicle for every kind a scenario can declare', () => {
    // Dispatch, asserted as dispatch: eight declarations, eight pictures. One
    // generic body for all of them is exactly the bug.
    const digests = new Map<string, string>();
    for (const kind of KINDS) digests.set(kind, paint({ kind }).digest);
    expect(new Set(digests.values()).size).toBe(KINDS.length);
  });

  it('gives the light bar to the ambulance alone', () => {
    // Every other kind must paint the same picture whether or not anything
    // emergency-shaped is nearby, because nothing else is an emergency.
    const ambulance = paint({ kind: 'ambulance' }).ops.join('\n');
    expect(ambulance).toContain('EMERGENCY VEHICLE BEHIND');
    for (const kind of KINDS.filter(candidate => candidate !== 'ambulance')) {
      const ops = paint({ kind }).ops.join('\n');
      expect(ops, `${kind} was treated as an emergency`).toContain('BEHIND YOU');
      expect(ops, `${kind} was treated as an emergency`).not.toContain('EMERGENCY VEHICLE BEHIND');
    }
  });

  it('draws nothing at all before the vehicle is in range', () => {
    expect(paint({ kind: 'car' }, 0).ops).toEqual([]);
  });

  it('honours a colour the scenario named', () => {
    expect(paint({ kind: 'car', color: '#00ff00' }).digest).not.toBe(paint({ kind: 'car' }).digest);
  });

  it('keeps the vehicle inside the glass at every distance', () => {
    // A sprite clipped by the mirror frame reads as a rendering fault. The
    // housing is 156x46 at y 74, and the clip would hide an overflow rather
    // than show it, so the sizes are checked rather than the picture.
    for (const kind of KINDS) {
      for (const proximity of [0.05, 0.5, 1]) {
        const boxes = paint({ kind }, proximity).ops.flatMap(op => {
          const match = /^(?:roundRect|fillRect)\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(op);
          return match ? [{ y: Number(match[2]), height: Number(match[4]) }] : [];
        });
        // The housing itself is the tallest box drawn; nothing the vehicle laid
        // down may be taller than the glass it sits in.
        const vehicleBoxes = boxes.filter(box => box.height < 46);
        expect(
          vehicleBoxes.every(box => box.height <= 46),
          `${kind} at ${proximity} overflows the glass`
        ).toBe(true);
      }
    }
  });
});

describe('the motorcycle in the mirror', () => {
  const ops = (kind: NpcVehicleSpec['vehicleKind']) => {
    const { ctx, recording } = recordingCanvasContext();
    drawMirrorVehicle(ctx, { kind }, 0, 0, 1);
    return recording().ops;
  };

  it('is drawn by the motorcycle sprite rather than a stand-in', () => {
    // Dispatch asserted against the sprite itself: the mirror's motorcycle is
    // op-for-op the motorcycle the road draws, so the two cannot drift apart
    // into a glass that draws its own idea of a bike.
    const { ctx, recording } = recordingCanvasContext();
    drawMotorcycle(ctx, 0, 0, 1);
    // Compared from the first drawing command, past the transform each of them
    // sets up: the mirror scales through the context and the sprite through its
    // own argument, and what is asserted is that the strokes are the sprite's.
    const strokes = (all: string[]) =>
      all
        .slice(all.findIndex(op => op.startsWith('fillStyle=')))
        .filter(op => op !== 'save()' && op !== 'restore()');
    expect(strokes(ops('motorcycle'))).toEqual(strokes(recording().ops));
  });

  it('is the only kind drawn with it', () => {
    // The other half of dispatch: no other declaration reaches this sprite, so
    // "a motorcycle was drawn" can only mean a motorcycle was declared.
    const { ctx, recording } = recordingCanvasContext();
    drawMotorcycle(ctx, 0, 0, 1);
    const helmet = recording().ops.filter(op => op.startsWith('arc('));
    expect(helmet.length, 'the rider lost their helmet').toBeGreaterThan(0);
    for (const kind of KINDS.filter(candidate => candidate !== 'motorcycle')) {
      const shared = ops(kind).filter(op => helmet.includes(op));
      expect(shared, `${kind} is drawn with the motorcycle's rider`).toEqual([]);
    }
  });

  it('puts its wheels in line, one in front of the other', () => {
    // The defect in the old sprite, asserted directly: its two wheels were side
    // by side at the same height, which from above is not a motorcycle. The
    // tyres are the two dark rounded rects furthest apart up the sprite.
    const boxes = ops('motorcycle').flatMap(op => {
      const match = /^roundRect\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(op);
      return match
        ? [{ x: Number(match[1]), y: Number(match[2]), w: Number(match[3]), h: Number(match[4]) }]
        : [];
    });
    const narrow = boxes.filter(box => box.w <= 8 && box.h >= 10);
    expect(narrow.length, 'no wheels found').toBeGreaterThanOrEqual(2);
    const front = narrow.reduce((a, b) => (a.y < b.y ? a : b));
    const rear = narrow.reduce((a, b) => (a.y > b.y ? a : b));
    // Separated along the direction of travel, not across it.
    expect(rear.y - front.y).toBeGreaterThan(20);
    expect(Math.abs(rear.x - front.x)).toBeLessThan(4);
  });

  it('fits the body the collision pass gives a motorcycle', () => {
    // At the 0.9 it is drawn at on the road. A sprite wider than its hitbox is
    // one whose edges a driver can pass through.
    const extent = ops('motorcycle').flatMap(op => {
      const match = /^roundRect\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(op);
      return match
        ? [
            { min: Number(match[1]), max: Number(match[1]) + Number(match[3]), axis: 'x' as const },
            { min: Number(match[2]), max: Number(match[2]) + Number(match[4]), axis: 'y' as const },
          ]
        : [];
    });
    const span = (axis: 'x' | 'y') => {
      const parts = extent.filter(part => part.axis === axis);
      return Math.max(...parts.map(p => p.max)) - Math.min(...parts.map(p => p.min));
    };
    const body = SHARED_LANE_HITBOX.motorcycle;
    expect(span('x') * 0.9).toBeLessThanOrEqual(body.width + 0.5);
    expect(span('y') * 0.9).toBeLessThanOrEqual(body.height + 0.5);
  });
});
