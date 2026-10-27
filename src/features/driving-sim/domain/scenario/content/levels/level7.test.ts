/**
 * Level 7, as one expressway rather than seven pictures of one.
 *
 * The version before this assembled its road out of per-event scene overlays: an
 * acceleration lane drawn beside a carriageway that did not have one, a median
 * nose in the middle of four same-direction lanes, an exit wedge the car then
 * drove straight past, and a toll plaza dropped on the through road. Each of
 * those is a thing the road and the simulation disagreed about, so the
 * assertions below are mostly about agreement: the lane the gantry names is the
 * lane the grader reads, the tarmac that is drawn is the tarmac that can be
 * driven on, and nothing solid stands in the carriageway that the route did not
 * put there.
 */
import { describe, expect, it } from 'vitest';
import { level7 } from './level7';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import { generateEnvObjects } from '@/features/driving-sim/domain/world/roadsideScenery';
import {
  auxiliaryAt,
  isOnAuxiliaryLane,
  segmentAt,
} from '@/features/driving-sim/domain/world/routeGeometry';
import { createDrivingWorld } from '@/features/driving-sim/domain/world/GameWorld';
import { paceOf, unitsForSeconds } from '@/features/driving-sim/domain/world/DrivingPace';
import { separatorAt } from '@/features/driving-sim/domain/world/routeGeometry';
import {
  BRAKE_FORCE,
  CAR_WIDTH,
  LANE_WIDTH,
  ROAD_CENTRE_X,
  ROAD_WIDTH,
  laneCentreX,
  resolveLaneRole,
  speedProfileFor,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';

const events = level7.events;
const byId = (id: string) => events.find(event => event.id === id)!;
const warnings = computeWarningDistances(events);
const route = level7.route!;

const FROZEN_NOW = 1_700_000_000_000;

/** Everything on the road with the player at a point of the route. */
const sceneAtDistance = (distance: number): SceneNode[] =>
  composeWorldFrame(
    { level: level7, distance, handled: new Set<number>(), curves: [] },
    { playerLane: 1, now: () => FROZEN_NOW }
  ).nodes;

/** Everything on the road while the player is `ahead` units short of an event. */
const sceneAt = (event: ScenarioEvent, ahead: number): SceneNode[] =>
  sceneAtDistance(event.triggerAtDistance - ahead);

/** How much road it takes to stop from a speed, at the rate the car brakes. */
const stoppingDistance = (kph: number) => {
  let speed = kph;
  let travelled = 0;
  while (speed > 0) {
    speed = Math.max(speed - BRAKE_FORCE, 0);
    travelled += speed * 0.05;
  }
  return travelled;
};

describe('the Level 7 road', () => {
  it('is declared once, as a route, not per event', () => {
    // The four values this level used to be assembled from. Every one of them
    // drew a piece of road that knew nothing about the road around it.
    const LEGACY = ['merge', 'divided_start', 'divided_end', 'open_road', 'exit_ramp', 'toll'];
    const offenders = events
      .filter(event => event.scene !== undefined && LEGACY.includes(event.scene))
      .map(event => `${event.id}: scene '${event.scene}'`);
    expect(offenders).toEqual([]);

    // What is left says only that the sign stands beside the road the route
    // already describes.
    for (const event of events) {
      if (event.sign) expect(event.scene, `${event.id}`).toBe('route');
    }
  });

  it('runs its segments end to end, with no gap and no overlap', () => {
    const ordered = [...route.segments].sort((a, b) => a.from - b.from);
    expect(ordered[0].from).toBe(0);
    expect(ordered[ordered.length - 1].to).toBe(level7.roadLength);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].from, 'a stretch of route nothing describes').toBe(ordered[i - 1].to);
    }
  });

  it('opens with an acceleration lane on the right, and closes with a ramp', () => {
    // On the driver's side of a one-way carriageway, which is the right. There
    // is no opposing traffic anywhere on this route, so nothing an auxiliary
    // lane could be confused with.
    expect(level7.paint?.oncomingLanes).toBe(0);

    const opening = auxiliaryAt(0, route);
    expect(opening?.role).toBe('acceleration');
    expect(opening?.width).toBe(LANE_WIDTH);

    // It runs out: full lane, then a taper, then nothing.
    const mergePoint = segmentAt(0, route)!.to;
    expect(auxiliaryAt(mergePoint - 210, route)!.width).toBeLessThan(LANE_WIDTH);
    expect(auxiliaryAt(mergePoint + 1, route)).toBeNull();

    // And nothing at all on that side again until the road actually parts. A
    // lane opening a thousand units before the exit is a second road the driver
    // can sit in while nothing about it is graded, and it let them be "in the
    // exit lane" before there was an exit to be in the lane for.
    const exit = byId('level7.check-brakes-reduce-speed').triggerAtDistance;
    expect(auxiliaryAt(exit - 1, route)).toBeNull();
    expect(auxiliaryAt(exit - 400, route)).toBeNull();

    // The ramp opens at the gore and widens as the two roads separate.
    expect(auxiliaryAt(exit + 60, route)?.role).toBe('deceleration');
    expect(auxiliaryAt(exit + 60, route)!.width).toBeLessThan(LANE_WIDTH);
    expect(auxiliaryAt(exit + 200, route)!.width).toBe(LANE_WIDTH);
  });

  it('starts the drive physically on the acceleration lane', () => {
    // The scenario says the driver is on it. This is what makes that true: the
    // car is beyond the through carriageway, on the lane the route declared.
    const world = createDrivingWorld(level7);
    expect(isOnAuxiliaryLane(world.car.x, ROAD_CENTRE_X)).toBe(true);
    expect(world.car.x).toBeGreaterThan(ROAD_CENTRE_X + ROAD_WIDTH);
    expect(world.car.x).toBeLessThan(ROAD_CENTRE_X + ROAD_WIDTH + LANE_WIDTH);
  });

  it('opens quiet: nothing is asked, nothing is paused, nothing is held', () => {
    const world = createDrivingWorld(level7);
    expect(world.activeEvent).toBeNull();
    expect(world.paused).toBe(false);
    expect(world.inspectionEvent).toBeNull();
    expect(world.cutsceneEvent).toBeNull();

    // And the first scenario is far enough away that a driver starting from
    // rest has several seconds of ordinary driving before it announces itself.
    // Measured against the car's own acceleration rather than a flat speed.
    // Computed on the level's own pace and its own acceleration, and against
    // the speed a driver actually cruises at rather than the headroom above it:
    // `level7Drive.test.ts` drives the same runway through the real session and
    // agrees with this to within a tenth of a second.
    const pace = paceOf(level7);
    const { acceleration } = speedProfileFor(level7.speedLimit);
    const cruise = level7.speedLimit;
    const first = events[0];
    const announceAt = first.triggerAtDistance - warnings.get(first.triggerAtDistance)!;
    let distance = 0;
    let speed = 0;
    let frames = 0;
    while (distance < announceAt && frames < 6000) {
      speed = Math.min(cruise, speed + acceleration * pace.accelerationScale);
      distance += speed * pace.distancePerSpeed;
      frames += 1;
    }
    const seconds = frames / 60;
    expect(seconds).toBeGreaterThanOrEqual(5);
    expect(seconds).toBeLessThanOrEqual(8);
  });

  it('puts nothing solid in the carriageway that is not traffic', () => {
    // The median nose that used to begin in the middle of four same-direction
    // lanes, and everything like it. Scenery belongs outside the road; the only
    // things in it are the vehicles the scenarios declare and the toll barriers.
    const strays: string[] = [];
    for (let distance = 0; distance < level7.roadLength; distance += 120) {
      for (const node of sceneAtDistance(distance)) {
        if (node.kind === 'road-situation') {
          strays.push(`@${distance}: a road situation (${node.situation.situation}) on a route-built road`);
        }
        for (const body of node.solids ?? []) {
          if (body.kind === 'vehicle' || body.kind === 'pedestrian') continue;
          if (body.label.includes('toll gate')) continue;
          // The nose between the slip road and the expressway is a boundary of
          // the carriageway rather than something standing in it, so it is
          // allowed — but only outside the through lanes, which is the whole
          // claim it makes.
          if (node.kind === 'lane-separator') {
            if (body.x < ROAD_CENTRE_X - ROAD_WIDTH / 2 + ROAD_WIDTH - 1) {
              strays.push(`@${distance}: ${body.label} inside the through lanes`);
            }
            continue;
          }
          strays.push(`@${distance}: ${body.label} standing in the carriageway`);
        }
      }
    }
    expect([...new Set(strays)]).toEqual([]);
  });

  it('keeps its roadside outside the road', () => {
    const objects = generateEnvObjects(level7.roadLength, () => 0.5, route);
    expect(objects.some(object => object.type === 'median-barrier')).toBe(true);
    // A median on a one-way carriageway is the barrier down its left edge, and
    // every piece of it is on the left verge rather than in a lane.
    expect(objects.filter(object => object.type === 'median-barrier').every(o => o.side === 'left')).toBe(true);
    expect(objects.some(object => object.type === 'tree')).toBe(false);
  });
});

describe('the Level 7 lane plan', () => {
  const plan = route.lanePlan!;

  it('names all four lanes, from the median outwards, as the module does', () => {
    expect(plan.lanes.map(lane => lane.label)).toEqual(['LANE 1', 'LANE 2', 'LANE 3', 'LANE 4']);
    expect(plan.lanes.map(lane => lane.role)).toEqual(['overtaking', 'cars', 'heavy', 'special']);
    expect(plan.lanes[0].use).toMatch(/OVERTAKING/);
    expect(plan.lanes[1].use).toMatch(/CARS/);
    expect(plan.lanes[2].use).toMatch(/BUSES|FREIGHT/);
    expect(plan.lanes[3].use).toMatch(/SPECIAL|CONSTRUCTION/);
  });

  it('hangs each panel over the lane it names', () => {
    const gantry = sceneAt(byId('level7.lane1-keep-right-except-pass'), 0).find(
      (node): node is Extract<SceneNode, { kind: 'overhead-gantry' }> => node.kind === 'overhead-gantry'
    );
    expect(gantry).toBeDefined();
    // Lane indices 0..3, in order, which is what `laneEdges` divides the road
    // into and what `laneOf` reports for a car sitting in each of them.
    expect(gantry!.panels.map(panel => panel.lane)).toEqual([0, 1, 2, 3]);
    expect(gantry!.panels.map(panel => panel.top)).toEqual(plan.lanes.map(lane => lane.label));
    // Lane 1 is a restriction and says so in a word as well as a colour; the
    // lane this car belongs in is the target, and it is the lane the grader
    // requires. One declaration, so the board cannot recommend a lane the
    // scenario marks down.
    expect(gantry!.panels[0].tone).toBe('restricted');
    expect(gantry!.panels[0].badge).toBe('ONLY');
    const target = gantry!.panels.filter(panel => panel.tone === 'target');
    expect(target).toHaveLength(1);
    expect(target[0].top).toBe('LANE 2');
    expect(target[0].badge).toBe('YOUR LANE');
    const graded = byId('level7.lane1-keep-right-except-pass').requiredLane!;
    expect(target[0].lane).toBe(resolveLaneRole(graded.lane!, 0));
  });

  it('grades the passenger car against the lane the plan marks for cars', () => {
    const event = byId('level7.lane1-keep-right-except-pass');
    const carLane = plan.lanes.findIndex(lane => lane.role === 'cars');
    expect(resolveLaneRole(event.requiredLane!.lane, 0)).toBe(carLane);
    // Exactly that lane: not a floor that everything outside Lane 1 satisfies.
    expect(event.requiredLane!.strict).toBeUndefined();
  });
});

describe('the Level 7 merge', () => {
  const event = byId('level7.merging-traffic-minimum-speed');

  it('measures the lane transition as well as the speed and the gap', () => {
    expect(event.merge).toMatchObject({
      intoLane: 'curb',
      minSpeed: 60,
    });
    expect(event.merge!.safeGapSeconds).toBeGreaterThan(0);
  });

  it('has its traffic on the acceleration lane, travelling the way you are', () => {
    expect(event.npc).toMatchObject({ path: 'merging_from_ramp', lane: 'curb' });

    // Posed across the whole run-in: on the lane while the lane is there, in the
    // carriageway once it is not, and never turned to face the player.
    const seen: Array<{ x: number; y: number; heading: number }> = [];
    for (let ahead = 900; ahead >= 0; ahead -= 60) {
      const node = sceneAt(event, ahead).find(
        (entry): entry is Extract<SceneNode, { kind: 'scripted-vehicle' }> =>
          entry.kind === 'scripted-vehicle' && entry.npc === event.npc
      );
      if (node) seen.push({ x: node.at.x, y: node.at.y, heading: node.at.heading });
    }
    expect(seen.length).toBeGreaterThan(3);
    // Never pointing back down the road: an oncoming pose is a heading near pi.
    expect(seen.every(pose => Math.abs(pose.heading) < Math.PI / 4)).toBe(true);
    // On the road, never off the side of it.
    expect(seen.every(pose => pose.x > ROAD_CENTRE_X)).toBe(true);
    expect(
      seen.every(pose => pose.x < ROAD_CENTRE_X + ROAD_WIDTH + LANE_WIDTH)
    ).toBe(true);
  });

  it('ends with its traffic in the lane it was joining, not beside it', () => {
    // At the merge point the lane has gone, so anything still on it has moved
    // across — which is what the route makes true for the NPC and asks of the
    // player.
    const node = sceneAt(event, 0).find(
      (entry): entry is Extract<SceneNode, { kind: 'scripted-vehicle' }> =>
        entry.kind === 'scripted-vehicle' && entry.npc === event.npc
    );
    if (!node) return;
    const curbCentre = laneCentreX(resolveLaneRole('curb', 0), ROAD_CENTRE_X);
    expect(Math.abs(node.at.x - curbCentre)).toBeLessThan(LANE_WIDTH);
  });
});

describe('the Level 7 exit', () => {
  const event = byId('level7.check-brakes-reduce-speed');

  it('is driven: a lane, a speed, and a turn that has to be made', () => {
    expect(event.correctAction).toBe('turn_right');
    expect(event.maneuver).toMatchObject({
      direction: 'right',
      lane: 'curb',
      maxSpeed: 60,
      mandatory: true,
      exitLane: 'curb',
    });
    // Taken at the exit itself rather than anywhere along the lane leading to
    // it, and at one number rather than a band: `commitFrom` was 700 units
    // wide, and its far end was 820 units from the nose a driver could see.
    expect(event.maneuver!.commitFrom).toBeUndefined();
    expect(event.maneuver!.commitAt).toBe(event.triggerAtDistance);
  });

  it('takes its exit at the one point the road marks, and nowhere else', () => {
    // The anchor, and everything that has to agree with it. A renderer offset,
    // a commit band and a trigger that drifted apart from one another is the
    // whole defect: the car turned several lengths after the marker, because
    // "the marker" and "the turn" were different numbers.
    const gore = route.fixtures!.find(fixture => fixture.fixture.kind === 'exit-gore')!;
    expect(gore.at).toBe(event.triggerAtDistance);
    expect(event.maneuver!.commitAt).toBe(gore.at);
    // And the advance board is somewhere else, so the two cannot be mistaken
    // for one another.
    const advance = route.fixtures!.find(fixture => fixture.fixture.kind === 'exit-gantry')!;
    expect(advance.at).toBeLessThan(gore.at - 400);
  });

  it('leads onto the toll approach, and is done with before the plaza asks', () => {
    // Nothing is handed over: a ramp is road, and the driver stays on it until
    // it tapers back in. What has to be true is that the taper is finished
    // before the plaza's window opens, or the driver is asked to pick a gate
    // from a road they are still walled off from.
    const rampSegment = segmentAt(event.triggerAtDistance + 100, route)!;
    expect(rampSegment.roadside).toBe('toll_approach');
    expect(rampSegment.auxiliary?.role).toBe('deceleration');
    expect(event.maneuver!.handOffAfter).toBeUndefined();

    const rejoined = rampSegment.to;
    const toll = byId('level7.toll-plaza-closed-gates');
    const tollOpensAt = toll.triggerAtDistance - warnings.get(toll.triggerAtDistance)!;
    expect(rejoined).toBeLessThan(tollOpensAt);
    expect(tollOpensAt - rejoined).toBeGreaterThan(50);
  });

  it('divides the ramp from the expressway everywhere but the opening', () => {
    // The mirror of the acceleration lane. Crossable for the length of the
    // manoeuvre and nowhere else: you cannot join the ramp late, and once on it
    // you cannot steer back onto the expressway.
    const at = event.triggerAtDistance;
    // The opening lasts as long as the manoeuvre can: the latest commit, plus
    // the crossing, plus the car's own length.
    expect(separatorAt(at + 40, route), 'the opening was closed').toBeNull();
    expect(separatorAt(at + 600, route), 'the opening was closed').toBeNull();
    expect(separatorAt(at + 800, route), 'the ramp was never divided').not.toBeNull();
    // And the wall is most of the ramp's length, not a stub: a short one reads
    // as something the driver drifts into and out of rather than a commitment.
    expect(separatorAt(at + 1200, route)).not.toBeNull();
    expect(separatorAt(at + 1700, route)).not.toBeNull();
    const divided = segmentAt(at + 100, route)!.auxiliary!.separator!;
    expect(divided.to - divided.from).toBeGreaterThan(1000);
    // And it ends where the ramp rejoins, which is the only other place the two
    // roads meet.
    const rampSegment = segmentAt(at + 100, route)!;
    expect(separatorAt(rampSegment.to - 10, route)).toBeNull();
  });

  it('paints its gore off the lane the exit is taken from', () => {
    const gore = sceneAt(event, 0).find(
      (node): node is Extract<SceneNode, { kind: 'exit-gore' }> => node.kind === 'exit-gore'
    );
    expect(gore).toBeDefined();
    expect(gore!.exitLane).toBe(resolveLaneRole(event.maneuver!.lane, 0));
  });

  it('is signed by a gantry before it, and by the module own board', () => {
    const gantry = sceneAtDistance(event.triggerAtDistance - 700).find(
      (node): node is Extract<SceneNode, { kind: 'overhead-gantry' }> => node.kind === 'overhead-gantry'
    );
    expect(gantry?.panels[0]).toMatchObject({ top: 'EXIT', tone: 'exit' });
    expect(event.sign?.image).toContain('check-brakes-reduce-speed');
  });
});

describe('the Level 7 toll plaza', () => {
  const event = byId('level7.toll-plaza-closed-gates');

  it('stands on the road the exit led to', () => {
    expect(segmentAt(event.triggerAtDistance, route)?.roadside).toBe('toll_approach');
    expect(event.triggerAtDistance).toBeGreaterThan(
      byId('level7.check-brakes-reduce-speed').triggerAtDistance
    );
  });

  it('opens the gate the grader accepts, and bars the rest', () => {
    const plaza = sceneAt(event, 0).find(
      (node): node is Extract<SceneNode, { kind: 'toll-plaza' }> => node.kind === 'toll-plaza'
    );
    expect(plaza).toBeDefined();
    const open = resolveLaneRole(event.requiredLane!.lane, 0);
    expect(plaza!.openLane).toBe(open);

    // Three barriers, and none of them across the open gate: a driver who read
    // the indicator correctly must be able to drive through what it showed.
    const bars = plaza!.solids ?? [];
    expect(bars).toHaveLength(3);
    const openCentre = laneCentreX(open, plaza!.roadX);
    for (const bar of bars) {
      const covers = openCentre > bar.x - CAR_WIDTH / 2 && openCentre < bar.x + bar.width + CAR_WIDTH / 2;
      expect(covers, 'a barrier across the open gate').toBe(false);
    }
  });
});

describe('every Level 7 scenario', () => {
  it('says what the safe move is', () => {
    const silent = events.filter(event => !event.recommendedMove?.trim());
    expect(silent.map(event => event.id)).toEqual([]);
  });

  it('puts on the road every vehicle its prose names', () => {
    // A vehicle the prose puts *on the road* — "a freight truck is running",
    // not the lane table's "Lane 3 for large buses and heavy freight", which
    // names categories rather than anything the driver is looking at. The
    // article is what tells the two apart.
    const naming = (noun: string) =>
      new RegExp(`\\b(?:a|an|the)\\s+(?:\\w+\\s+){0,2}${noun}\\b`, 'i');
    const NAMED: Array<[RegExp, string]> = [
      [naming('trucks?'), 'truck'],
      [naming('vans?'), 'van'],
      [naming('bus(es)?'), 'bus'],
      [naming('sedans?'), 'car'],
      [naming('cars?(?!\\s+lengths?)'), 'car'],
      [naming('jeepneys?'), 'jeepney'],
      [naming('motorcycles?'), 'motorcycle'],
    ];

    const broken: string[] = [];
    for (const event of events) {
      const prose = `${event.description} ${event.rewardMessage}`;
      for (const [pattern, kind] of NAMED) {
        if (!pattern.test(prose)) continue;
        const declared = event.npc?.vehicleKind === kind || event.actor?.kind === kind;
        if (!declared) broken.push(`${event.id}: names a ${kind} it does not declare`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('never rewards a manoeuvre it did not measure', () => {
    const CLAIMS: Array<[RegExp, (event: ScenarioEvent) => boolean, string]> = [
      [/\bpass(ed|ing)?\b|overtak/i, event => Boolean(event.overtake), 'a completed pass'],
      [/\bgaps?\b/i, event => Boolean(event.following || event.merge), 'a gap it kept'],
      [
        /\blane 1\b|\blane 2\b/i,
        event => Boolean(event.requiredLane || event.overtake),
        'a lane the grader reads',
      ],
      [/\bexit lane\b|\bgate\b|\bramp\b/i, event => Boolean(event.requiredLane || event.maneuver), 'a lane the grader reads'],
      [/\bmerg(e|ed|ing)\b/i, event => Boolean(event.merge), 'a completed merge'],
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

  it('asks nothing the driver cannot see', () => {
    const invisible = events.filter(event => /\d+\s*cc\b/i.test(event.description));
    expect(invisible.map(event => event.id)).toEqual([]);
  });
});

describe('Level 7 pacing', () => {
  /**
   * The road one scenario needs to itself: the warning it announces over, the
   * window it is graded in, and enough afterwards to stop from the speed the
   * road is driven at before the next one may open.
   */
  const recoveryNeeded = stoppingDistance(speedProfileFor(level7.speedLimit).maxSpeed);

  it('gives every scenario a warning long enough to stop inside', () => {
    const tooLate: string[] = [];
    for (const event of events) {
      const warning = warnings.get(event.triggerAtDistance)!;
      const seconds = warning / (level7.speedLimit * 0.05 * 60);
      if (warning < recoveryNeeded) {
        tooLate.push(`${event.id}: ${warning} units of warning, ${Math.round(recoveryNeeded)} needed to stop`);
      }
      if (seconds < 2) tooLate.push(`${event.id}: only ${seconds.toFixed(1)}s of warning at the limit`);
    }
    expect(tooLate).toEqual([]);
  });

  it('never opens one scenario inside the window of the one before it', () => {
    const overlaps: string[] = [];
    for (let i = 1; i < events.length; i++) {
      const previous = events[i - 1];
      const event = events[i];
      const previousCloses = previous.triggerAtDistance + 20;
      const opens = event.triggerAtDistance - warnings.get(event.triggerAtDistance)!;
      if (opens < previousCloses) {
        overlaps.push(`${event.id} opens at ${opens}, inside ${previous.id}'s window`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('brings each scenario its own traffic, and nobody else run-off', () => {
    // Only one vehicle may be close enough to be mistaken for the one this
    // scenario is about. A lead vehicle left over from the event before is a
    // second thing in the driver's lane with nothing explaining it.
    const crowded: string[] = [];
    for (const event of events) {
      if (!event.npc) continue;
      const strangers = sceneAt(event, 0)
        .filter(
          (node): node is Extract<SceneNode, { kind: 'scripted-vehicle' }> =>
            node.kind === 'scripted-vehicle'
        )
        .filter(node => node.npc !== event.npc)
        // Anything within a screen of the player's own row is close enough to
        // read as part of this scenario.
        .filter(node => node.at.y > 260);
      if (strangers.length > 0) {
        crowded.push(`${event.id}: ${strangers.map(s => s.npc.label).join(', ')} still on the road`);
      }
    }
    expect(crowded).toEqual([]);
  });

  it('leaves the overtake enough road to be completed at the legal minimum', () => {
    // The envelope, computed rather than assumed: how far the car travels while
    // closing the initial gap plus the clearance it has to open, at the slowest
    // speed the expressway allows.
    const event = byId('level7.lane1-overtake-freight-truck');
    const truck = event.npc!;
    const overtake = event.overtake!;

    const MINIMUM_LEGAL = 60;
    // On the level's own pace, not the shared one: the road this manoeuvre has
    // to fit into is measured in units, and how many units a km/h is worth here
    // is exactly what `pace` changes.
    const pace = paceOf(level7);
    const playerPerFrame = MINIMUM_LEGAL * pace.distancePerSpeed;
    const truckPerFrame = level7.speedLimit * truck.speed!.cruise * pace.distancePerSpeed;
    const startingGap = unitsForSeconds(truck.entryHeadway!, level7.speedLimit, pace);
    const relative = startingGap + overtake.clearBy;
    const frames = relative / (playerPerFrame - truckPerFrame);
    const roadNeeded = frames * playerPerFrame;

    const window = warnings.get(event.triggerAtDistance)! + 20;
    expect(playerPerFrame, 'the truck is not slower than the legal minimum').toBeGreaterThan(truckPerFrame);
    expect(window, `the pass needs ${Math.round(roadNeeded)} units`).toBeGreaterThan(roadNeeded);
    // And the driver never has to break the limit to make it.
    expect(MINIMUM_LEGAL).toBeLessThanOrEqual(level7.speedLimit);
  });
});

describe('the Level 7 score', () => {
  const total = events.reduce((sum, event) => sum + event.points, 0);

  it('is calibrated against what the route is actually worth', () => {
    expect(total).toBe(165);
    expect(level7.requiredScore).toBeLessThan(level7.stars2);
    expect(level7.stars2).toBeLessThan(level7.stars3);
    expect(level7.stars3).toBeLessThanOrEqual(total);
    expect(level7.requiredScore / total).toBeGreaterThan(0.66);
    expect(level7.requiredScore / total).toBeLessThan(0.72);
  });
});
