/**
 * Level 11, as mixed traffic met from a car.
 *
 * The roster this replaced had ten scenarios, and the road showed the vehicle
 * four of them were about in none of those four: a rider in the motorcycle
 * lane, a jeepney in a loading bay and a tricycle in a yellow box were paint,
 * and a motorcycle with a flashing lamp was a visibility effect that composed
 * nothing at all. Two more graded carrying on at speed past riders and boarding
 * passengers, which no source asks for.
 *
 * So the assertions below are mostly about measurement and declaration: every
 * road user the prose names is on the road, every motorcycle carries what its
 * scenario is about, every verdict names only what the grader watched, and each
 * beat is measured by something that fits the move the LTO material gives a
 * driver who meets it.
 */
import { describe, expect, it } from 'vitest';
import { level11, SLOTS, SLOT_DISTANCES } from './level11';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { isPortableRemediation } from '@/features/driving-sim/domain/scenario/remediationPool';
import { scenarioInstruction, scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { paceOf, unitsForSeconds } from '@/features/driving-sim/domain/world/DrivingPace';
import { intersectionGeometry } from '@/features/driving-sim/domain/world/junctionGeometry';
import type { RoadTraffic } from '@/features/driving-sim/domain/systems/roadTraffic';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';

const events = level11.events;
const byId = (id: string) => events.find(event => event.id === id)!;
const warnings = computeWarningDistances(events);

const FROZEN_NOW = 1_700_000_000_000;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
/** Sentences, counted the way a reader does: by full stops that end one. */
const sentences = (text: string) => text.split(/[.!?]+(?:\s|$)/).filter(part => part.trim()).length;

/**
 * Everything on the road with the player `ahead` units short of an event.
 *
 * The drive's own traffic map is stood in for: a vehicle travelling ahead
 * carries its own road distance, so the map says where this event's vehicle is,
 * a little further up the road than the car.
 */
const sceneAt = (event: ScenarioEvent, ahead: number): SceneNode[] => {
  const distance = event.triggerAtDistance - ahead;
  const traffic: RoadTraffic = new Map();
  if (event.npc?.path === 'travelling_ahead') {
    traffic.set(event.id, {
      distance: distance + unitsForSeconds(1.5, level11.speedLimit, paceOf(level11)),
      speed: level11.speedLimit * (event.npc.speed?.cruise ?? 1),
      braking: false,
    });
  }
  return composeWorldFrame(
    { level: level11, distance, handled: new Set<number>(), curves: [] },
    { playerLane: 2, traffic, now: () => FROZEN_NOW }
  ).nodes;
};

describe('what Level 11 no longer is', () => {
  it('keeps none of the scenarios it replaced, anywhere in the game', () => {
    const REMOVED = [
      'level11.motorcycle-lane-clearance',
      'level11.bareheaded-rider-no-plate',
      'level11.yellow-box-clear-exit',
      'level11.delivery-box-blind-spot',
      'level11.child-passenger-unsecured',
      'level11.puv-loading-bay-correct',
      'level11.yellow-box-tricycle-blocked',
      'level11.lola-crossing-puv-stop',
      'level11.overloaded-jeepney-overhang',
      'level11.blinker-taillight-dusk',
    ];
    // Across the whole roster: Level 12 borrows this level's hazards by
    // reading its SLOTS, so a stale copy would keep an old scenario alive there.
    const survivors = LEVELS.flatMap(level => level.events.map(event => event.id)).filter(id =>
      REMOVED.includes(id)
    );
    expect(survivors).toEqual([]);
  });

  it('draws no scene from paint alone, and hides no road', () => {
    // A lane-paint prefab draws a stripe and nothing else, and a visibility
    // effect composes an empty scene. Between them they left four scenarios
    // describing a vehicle the road did not have.
    expect(events.filter(event => event.scenePrefab).map(event => event.id)).toEqual([]);
    expect(events.filter(event => event.effect?.visibility !== undefined).map(event => event.id)).toEqual([]);
  });

  it('grades carrying on nowhere', () => {
    // No source in the module makes carrying on the correct answer past a rider,
    // a cyclist or a loading jeepney. The one `accelerate` left is the
    // motorcycle lane, and it is graded on the line held, never on speed.
    const carryOn = events.filter(event => event.correctAction === 'accelerate');
    expect(carryOn.map(event => event.id)).toEqual(['level11.riders-in-their-lane']);
    expect(carryOn[0].lineHold).toBeDefined();
  });
});

describe('every Level 11 scenario', () => {
  it('is the set of ids the rest of the game refers to', () => {
    // Pinned rather than derived: Level 12's hazard slot and the remediation
    // index read this level's SLOTS, and a quietly renamed id breaks the trail
    // from what is on screen back to here.
    expect(events.map(event => event.id)).toEqual([
      'level11.riders-in-their-lane',
      'level11.no-helmet',
      'level11.cyclist-in-the-bike-lane',
      'level11.delivery-box',
      'level11.child-aboard',
      'level11.jeepney-stop',
      'level11.tricycle-in-the-box',
      'level11.crossing-at-the-stop',
      'level11.overloaded-jeepney',
      'level11.flashing-tail-lamp',
    ]);
    expect(events.map(event => event.id).filter(id => !/^level11\.[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toEqual([]);
  });

  it('names each one in two to five words that do not give the move away', () => {
    for (const event of events) {
      expect(event.label, `${event.id} has no label`).toBeTruthy();
      expect(words(scenarioLabel(event)), `${event.id} label`).toBeLessThanOrEqual(5);
      expect(words(scenarioLabel(event)), `${event.id} label`).toBeGreaterThanOrEqual(2);
      expect(scenarioLabel(event), `${event.id} label`).not.toMatch(MOVE);
    }
  });

  it('says what to do about each one in ten words, and only where the move is shown', () => {
    for (const event of events) {
      expect(event.recommendedMove, `${event.id} has no recommended move`).toBeTruthy();
      expect(words(scenarioInstruction(event)), `${event.id} move`).toBeLessThanOrEqual(10);
    }
  });

  it('sets up the situation without stating the move', () => {
    // The description is shown at every support level, including `none`, where
    // the move must not be on screen.
    const telling = events.filter(event => MOVE.test(event.description)).map(event => event.id);
    expect(telling).toEqual([]);
  });

  it('puts something on the road at every one of them, and something solid', () => {
    const empty: string[] = [];
    for (const event of events) {
      const nodes = sceneAt(event, 150);
      if (nodes.length === 0) empty.push(`${event.id}: composes nothing`);
      else if (nodes.flatMap(node => node.solids ?? []).length === 0) empty.push(`${event.id}: nothing can be hit`);
    }
    expect(empty).toEqual([]);
  });

  it('declares every road user its prose names', () => {
    const vehicle = (event: ScenarioEvent) => [event.npc?.vehicleKind, event.actor?.kind];
    const naming = (noun: string) => new RegExp(`\\b(?:a|an|the)\\s+(?:\\w+\\s+){0,2}${noun}\\b`, 'i');
    const NAMED: Array<[RegExp, (event: ScenarioEvent) => boolean]> = [
      [naming('(?:motorcycles?|riders?)'), e => vehicle(e).includes('motorcycle')],
      [naming('back riders?'), e => Boolean(e.npc?.rider?.backRider)],
      [naming('child'), e => e.npc?.rider?.backRider?.kind === 'child' || Boolean(e.pedestrians?.some(p => p.kind === 'child'))],
      [naming('jeepneys?'), e => vehicle(e).includes('jeepney')],
      [naming('tricycles?'), e => vehicle(e).includes('tricycle')],
      [naming('cyclists?'), e => vehicle(e).includes('bicycle')],
      [naming('(?:woman|passengers|people)'), e => Boolean(e.pedestrians?.length)],
    ];
    const broken: string[] = [];
    for (const event of events) {
      for (const [pattern, declares] of NAMED) {
        // The jeepney stop is a place, not a vehicle: the crossing is at one.
        const prose = event.description.replace(/\bthe jeepney stop\b/gi, 'the stop');
        if (pattern.test(prose) && !declares(event)) {
          broken.push(`${event.id}: names something it does not declare (${pattern.source})`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('draws each motorcycle carrying what its scenario is about', () => {
    // The sprite drew a helmeted rider alone with a steady lamp, whatever the
    // prose said. Each of these is the whole cue of its scenario.
    expect(byId('level11.riders-in-their-lane').npc?.rider?.backRider?.kind).toBe('adult');
    expect(byId('level11.no-helmet').npc?.rider?.bareheaded).toBe(true);
    expect(byId('level11.delivery-box').npc?.rider?.topBox).toBe(true);
    expect(byId('level11.child-aboard').npc?.rider?.backRider).toEqual({ kind: 'child', bareheaded: true });
    expect(byId('level11.flashing-tail-lamp').npc?.rider?.tailLamp).toBe('blinking');

    // And the composed scene carries it to the renderer.
    for (const event of events.filter(event => event.npc?.vehicleKind === 'motorcycle')) {
      const drawn = sceneAt(event, 150).find(
        (node): node is Extract<SceneNode, { kind: 'scripted-vehicle' }> => node.kind === 'scripted-vehicle'
      );
      expect(drawn?.npc.rider, `${event.id}: the rider never reaches the scene`).toEqual(event.npc!.rider);
    }
  });

  it('stands the tricycle inside the yellow box, in the lane it declares', () => {
    const box = byId('level11.tricycle-in-the-box');
    const nodes = sceneAt(box, 150);
    const tricycle = nodes.find(
      (node): node is Extract<SceneNode, { kind: 'road-actor' }> =>
        node.kind === 'road-actor' && node.actor.kind === 'tricycle'
    );
    expect(tricycle, 'no tricycle in the box').toBeDefined();
    expect(tricycle!.solids?.length).toBe(1);
    // Wholly past the box's near edge, so it is in the box rather than short of
    // it: its body's back is above the edge on screen.
    const junction = nodes.find(
      (node): node is Extract<SceneNode, { kind: 'junction' }> => node.kind === 'junction'
    );
    expect(junction, 'no junction for the box').toBeDefined();
    const body = tricycle!.solids![0];
    expect(body.y + body.height).toBeLessThanOrEqual(intersectionGeometry(junction!.shape.screenY).boxBottom);
  });

  it('never rewards a behaviour it did not measure', () => {
    const CLAIMS: Array<[RegExp, (event: ScenarioEvent) => boolean, string]> = [
      [/\bdistance\b|\bgap\b|\bwell back\b|\bseconds?\b/i, e => Boolean(e.following), 'a gap it kept'],
      [/\bown lane\b|\bbike lane\b/i, e => Boolean(e.requiredLane), 'a lane the grader reads'],
      [/\bstopped\b|\bfull stop\b/i, e => e.correctAction === 'stop', 'a stop it watched happen'],
      [/\bheld your line\b/i, e => Boolean(e.lineHold), 'a line it measured'],
      [/\bspeed down\b/i, e => e.correctAction === 'brake' && !e.following, 'a speed it read'],
    ];
    const overclaimed: string[] = [];
    for (const event of events) {
      for (const [pattern, declares, what] of CLAIMS) {
        if (pattern.test(event.rewardMessage) && !declares(event)) {
          overclaimed.push(`${event.id}: its reward claims ${what}, which nothing measures`);
        }
      }
    }
    expect(overclaimed).toEqual([]);
  });
});

/** A move stated outright: what the description and label must never say. */
const MOVE = /\b(?:slow(?:s|ing)? down|stop (?:before|short)|keep (?:back|clear|two|three)|hold (?:your|the) line|give way|stay (?:back|in|out)|let (?:her|him|them) finish|pass(?:ing)? (?:slowly|wide)|clearance|correct)\b/i;

/**
 * The ten beats, and the measurement taken for each.
 *
 * The pairing is the point: a scenario that says it is about the gap behind a
 * rider and declares no `following` is one whose lesson the grader never
 * looks at.
 */
const BEATS: Array<{ id: string; law: string; measured: (event: ScenarioEvent) => boolean }> = [
  {
    id: 'level11.riders-in-their-lane',
    law: 'motorcycle lanes',
    measured: e =>
      e.lineHold !== undefined &&
      e.npc?.vehicleKind === 'motorcycle' &&
      e.npc.lane === 'curb' &&
      // The lane can be shared with other vehicles, so nothing grades where
      // the car is: only the line it holds past them.
      !e.requiredLane,
  },
  {
    id: 'level11.no-helmet',
    law: 'RA 10054',
    measured: e => e.following?.seconds === 2 && e.npc?.path === 'travelling_ahead' && e.npc.speed?.slowsTo !== undefined,
  },
  {
    id: 'level11.cyclist-in-the-bike-lane',
    law: 'bicycle lane',
    measured: e =>
      e.requiredLane?.lane === 'inner' &&
      !e.requiredLane.strict &&
      e.correctAction === 'brake' &&
      e.npc?.vehicleKind === 'bicycle' &&
      e.npc.lane === 'curb',
  },
  {
    id: 'level11.delivery-box',
    law: 'custom-made top box',
    measured: e => e.following?.seconds === 2 && e.npc?.speed?.slowsTo !== undefined,
  },
  {
    id: 'level11.child-aboard',
    law: 'RA 10666',
    measured: e => e.following?.seconds === 2 && e.npc?.speed?.slowsTo !== undefined,
  },
  {
    id: 'level11.jeepney-stop',
    law: 'loading and unloading',
    measured: e =>
      e.correctAction === 'brake' &&
      e.actor?.kind === 'jeepney' &&
      e.actor.side === 'curb' &&
      // People waiting on the footpath, none of them in the road.
      (e.pedestrians ?? []).length > 0 &&
      (e.pedestrians ?? []).every(person => !person.solid && (person.position ?? 0) > 1),
  },
  {
    id: 'level11.tricycle-in-the-box',
    law: 'tricycle violations',
    measured: e => e.correctAction === 'stop' && e.marking?.art === 'yellow_box' && e.actor?.kind === 'tricycle',
  },
  {
    id: 'level11.crossing-at-the-stop',
    law: 'pedestrians',
    measured: e =>
      e.correctAction === 'stop' &&
      e.type === 'pedestrian_crossing' &&
      (e.pedestrians ?? []).filter(person => person.solid).map(person => person.kind).join() === 'elderly',
  },
  {
    id: 'level11.overloaded-jeepney',
    law: 'overloading',
    measured: e => e.following?.seconds === 3 && e.npc?.vehicleKind === 'jeepney',
  },
  {
    id: 'level11.flashing-tail-lamp',
    law: 'motorcycle lighting',
    measured: e => e.following?.seconds === 3 && e.npc?.vehicleKind === 'motorcycle' && e.npc.speed?.slowsTo !== undefined,
  },
];

describe('the Level 11 curriculum', () => {
  it('covers each beat exactly once, in route order', () => {
    expect(BEATS.map(beat => beat.id)).toEqual(events.map(event => event.id));
  });

  it('actually measures the behaviour each beat is about', () => {
    const unmeasured = BEATS.filter(beat => !beat.measured(byId(beat.id))).map(beat => `${beat.id}: ${beat.law} is not measured`);
    expect(unmeasured).toEqual([]);
  });

  it('cites each of the module’s laws somewhere on the road', () => {
    const cited = events.map(event => event.lawCitation ?? '').join(' ');
    for (const law of ['RA 10054', 'RA 10666', 'JAO 2014-01', 'top box', 'tricycle', 'loading and unloading', 'bicycle lane', 'Motorcycle lanes']) {
      expect(cited, `${law} is never cited`).toContain(law);
    }
  });

  it('claims nothing the LTO sources leave open', () => {
    // An image-only fact is a gap, and a rule is applied only to the
    // vehicles its source names.
    const cited = events.map(event => `${event.id}: ${event.lawCitation ?? ''} ${event.penaltyMessage}`);
    const OPEN: Array<[RegExp, string]> = [
      [/half face|half head|full face, /i, 'the helmet types are only on a slide image'],
      [/\bdecal\b|front plate/i, 'whether a front plate is still required is for a person to confirm'],
      [/stand while|standing passengers/i, 'standing is a bus rule'],
      [/per square meter|\b20 kg/i, 'roof freight is a bus rule'],
      [/\b911\b|\b117\b/, 'no hotline is sourced for this level'],
    ];
    const claimed = cited.flatMap(text => OPEN.filter(([pattern]) => pattern.test(text)).map(([, why]) => `${text.slice(0, 40)}…: ${why}`));
    expect(claimed).toEqual([]);
  });

  it('grades the competencies the simulation reads', () => {
    // What the learner model and the routing FSM's review guard read. Slot 3
    // moved from general_rules to lane_discipline with the cyclist; the set of
    // competencies Level 11 presents is the same four it always was.
    expect(events.map(event => event.competency)).toEqual([
      'lane_discipline',
      'hazard_awareness',
      'lane_discipline',
      'hazard_awareness',
      'general_rules',
      'general_rules',
      'general_rules',
      'pedestrians',
      'hazard_awareness',
      'hazard_awareness',
    ]);
  });
});

describe('what the simulation reads, held where it was left', () => {
  it('keeps the points, pass mark and spacing', () => {
    expect(events.reduce((sum, event) => sum + event.points, 0)).toBe(225);
    expect(level11.requiredScore).toBe(158);
    expect(SLOT_DISTANCES).toEqual([840, 1540, 2240, 2940, 3640, 4340, 5040, 5740, 6440, 7140]);
    expect(events.map(event => event.severity)).toEqual([
      'major', 'major', 'major', 'major', 'critical', 'major', 'major', 'critical', 'major', 'major',
    ]);
  });

  it('is one variant per slot, every one of them portable', () => {
    expect(SLOTS.every(slot => slot.length === 1)).toBe(true);
    expect(SLOTS.flat().filter(variant => !isPortableRemediation(variant)).map(variant => variant.id)).toEqual([]);
  });
});

describe('Level 11 copy fits on the screen it is shown on', () => {
  it('sets each situation up in one or two sentences', () => {
    for (const event of events) {
      expect(words(event.description), `${event.id} description`).toBeLessThanOrEqual(32);
      expect(sentences(event.description), `${event.id} description`).toBeLessThanOrEqual(2);
    }
  });

  it('keeps the verdicts to two short sentences', () => {
    for (const event of events) {
      for (const text of [
        event.rewardMessage,
        event.penaltyMessage,
        event.following?.tooCloseMessage,
        event.lineHold?.driftedMessage,
        event.requiredLane?.wrongLaneMessage,
      ]) {
        if (!text) continue;
        expect(sentences(text), `${event.id}: ${text}`).toBeLessThanOrEqual(2);
        expect(words(text), `${event.id}: ${text}`).toBeLessThanOrEqual(30);
      }
    }
  });

  it('puts every long legal passage behind the disclosure', () => {
    for (const event of events) {
      expect(words(event.lawCitation ?? ''), `${event.id} citation`).toBeGreaterThan(30);
    }
  });
});

describe('the Level 11 road', () => {
  it('is an ordinary two-way national road at 60, not over the line RA 10666 draws', () => {
    expect(level11.paint?.oncomingLanes).toBe(2);
    expect(level11.speedLimit).toBe(60);
    expect(level11.pace).toBeUndefined();
  });

  it('paints the motorcycle and bicycle lanes over the whole stretch each scenario is graded on', () => {
    const spans = level11.paint!.spans;
    for (const [id, art] of [
      ['level11.riders-in-their-lane', 'motorcycle_lane'],
      ['level11.cyclist-in-the-bike-lane', 'bicycle_lane'],
    ] as const) {
      const event = byId(id);
      const from = event.triggerAtDistance - warnings.get(event.triggerAtDistance)!;
      const to = event.triggerAtDistance + 20;
      const span = spans.find(candidate => candidate.art === art);
      expect(span, `${id}: no ${art} painted`).toBeDefined();
      expect(span!.from, id).toBeLessThan(from);
      expect(span!.to, id).toBeGreaterThan(to);
    }
  });
});
