/**
 * Level 8, as a drive rather than a checklist with a road attached.
 *
 * What replaced the old roster is one journey — the school run at 6:45, out of
 * the barangay, along the river, into mixed traffic — and six scenarios that
 * ask for six different things: arrive slow, hold your line, take the bend on
 * your own side, give way, keep your gap, and stop for a child. Six different
 * *answers* is the design constraint, because a level whose every correct
 * answer is "slow down" is a level a crawl can pass.
 *
 * The version before this opened with a four-point garage stage inspecting the
 * *driver* — fatigue, the stereo, a family argument, a trip plan — and then ran
 * seven road events, one of which was a frozen prompt whose correct answer was
 * the absence of an action. Eighty of its two hundred and forty points were
 * scored before the car moved.
 *
 * So the assertions below are mostly about measurement: every scenario is
 * answered with the vehicle, every scenario says what the safe move is, every
 * claim a scenario makes about the road is backed by something declared on it,
 * and every reward names only what the grader actually watched.
 */
import { describe, expect, it } from 'vitest';
import { level8 } from './level8';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { paceOf, unitsForSeconds } from '@/features/driving-sim/domain/world/DrivingPace';
import type { RoadTraffic } from '@/features/driving-sim/domain/systems/roadTraffic';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import {
  ACTION_ZONE_EXIT,
  BRAKE_FORCE,
  LANE_WIDTH,
  REACTION_ZONE_ENTER,
  ROAD_CENTRE_X,
  laneBounds,
  laneCentreX,
  laneOf,
  resolveLaneRole,
  roadOffsetAt,
  roadXAt,
  speedProfileFor,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';

const events = level8.events;
const byId = (id: string) => events.find(event => event.id === id)!;
const warnings = computeWarningDistances(events);

const FROZEN_NOW = 1_700_000_000_000;

/**
 * Everything on the road with the player `ahead` units short of an event.
 *
 * The drive's own traffic map is stood in for rather than left out. A
 * self-driving vehicle carries its own road distance, and a composition with no
 * drive behind it places *every* one of them at a nominal gap ahead of the
 * player — so the scenario after this one would appear to have parked its lead
 * vehicle on this one's road. The map says where this event's vehicle is, and
 * that nobody else's has joined yet.
 */
const sceneAt = (event: ScenarioEvent, ahead: number): SceneNode[] => {
  const distance = event.triggerAtDistance - ahead;
  const traffic: RoadTraffic = new Map();
  if (event.npc?.path === 'travelling_ahead') {
    traffic.set(event.id, {
      distance:
        distance +
        unitsForSeconds(event.npc.entryHeadway ?? 2.5, level8.speedLimit, paceOf(level8)),
      speed: level8.speedLimit * (event.npc.speed?.cruise ?? 1),
      braking: false,
    });
  }
  return composeWorldFrame(
    { level: level8, distance, handled: new Set<number>(), curves: [] },
    { playerLane: 2, traffic, now: () => FROZEN_NOW }
  ).nodes;
};

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

describe('what Level 8 no longer is', () => {
  it('has no pre-drive stage at either end of the route', () => {
    // The whole subject of this module is what the driver does with the road in
    // front of them. A stage inspecting a stationary car scored a third of the
    // level before the wheels turned.
    expect(level8.garage).toBeUndefined();
    expect(level8.aftermath).toBeUndefined();
  });

  it('keeps none of the events it replaced, anywhere in the game', () => {
    const REMOVED = [
      'level8.jeepney-hides-pavement',
      'level8.cyclist-clearance-pass',
      'level8.tailgater-let-pass',
      'level8.road-rage-confrontation',
      'level8.unmarked-work-zone',
      'level8.stress-lay-by-stop',
      'level8.lola-last-clear-chance',
    ];
    // Across the whole roster, not just this level: Level 12 borrows content by
    // id, so a stale copy would keep the old scenario alive in the exam.
    const survivors = LEVELS.flatMap(level => level.events)
      .map(event => event.id)
      .filter(id => REMOVED.includes(id));
    expect(survivors).toEqual([]);
  });

  it('asks nothing through a frozen prompt', () => {
    // Every point in the level is answered with the car. The road-rage
    // confrontation this replaced was a cutscene whose correct answer was the
    // absence of an action, which no amount of speed or lane data can tell
    // apart from simply not having noticed.
    const frozen = events.filter(
      event => event.cutscene || event.inspection || event.parkingCutscene || event.choices
    );
    expect(frozen.map(event => event.id)).toEqual([]);
  });
});

describe('every Level 8 scenario', () => {
  it('is named with this level’s own stable id convention', () => {
    const ids = events.map(event => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(id => !/^level8\.[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toEqual([]);
  });

  it('is the set of ids the rest of the game refers to', () => {
    // Pinned rather than derived: `remediationPool` indexes this level's SLOTS
    // by competency, and an id that quietly changes breaks the trail from what
    // is on screen back to this file.
    expect(events.map(event => event.id)).toEqual([
      'level8.school-gate',
      'level8.hold-your-line',
      'level8.blind-bend',
      'level8.let-them-out',
      'level8.two-seconds',
      'level8.both-at-once',
    ]);
  });

  it('says what the safe move is', () => {
    const silent = events.filter(event => !event.recommendedMove?.trim());
    expect(silent.map(event => event.id)).toEqual([]);
  });

  it('puts something on the road, and something solid where it claims a hazard', () => {
    const empty: string[] = [];
    for (const event of events) {
      const nodes = sceneAt(event, 0);
      if (nodes.length === 0) empty.push(`${event.id}: composes nothing at all`);
      const solids = nodes.flatMap(node => node.solids ?? []);
      if (solids.length === 0) empty.push(`${event.id}: nothing on its road can be hit`);
    }
    expect(empty).toEqual([]);
  });

  it('declares every road user its prose names', () => {
    // The article is what separates a road user the driver is looking at ("a
    // jeepney is running ahead of you") from a category named in a rule.
    // Either slot: a scenario may put something in front of the driver, behind
    // them, or both, and the prose is entitled to name any of them.
    const vehicle = (event: ScenarioEvent) => [event.npc?.vehicleKind, event.rear?.vehicleKind];
    const naming = (noun: string) =>
      new RegExp(`\\b(?:a|an|the)\\s+(?:\\w+\\s+){0,2}${noun}\\b`, 'i');
    const NAMED: Array<[RegExp, (event: ScenarioEvent) => boolean]> = [
      [naming('trucks?'), e => vehicle(e).includes('truck') || e.actor?.kind === 'truck'],
      [naming('jeepneys?'), e => vehicle(e).includes('jeepney') || e.actor?.kind === 'jeepney'],
      [naming('motorcycles?'), e => vehicle(e).includes('motorcycle') || e.actor?.kind === 'motorcycle'],
      [naming('cyclists?'), e => vehicle(e).includes('bicycle') || e.actor?.kind === 'bicycle'],
      [naming('vans?'), e => vehicle(e).includes('van') || e.actor?.kind === 'van'],
      [naming('bus(?:es)?'), e => vehicle(e).includes('bus') || e.actor?.kind === 'bus'],
      [naming('riders?'), e => vehicle(e).includes('motorcycle')],
      [naming('cars?(?!\\s+lengths?)'), e => vehicle(e).includes('car')],
      // Anybody on foot is a declared pedestrian or the prefab that draws one.
      [
        /\b(?:somebody|its driver|person|people)\b/i,
        e => Boolean(e.pedestrians?.length) || e.scenePrefab?.kind === 'driveway_crossing',
      ],
    ];

    const broken: string[] = [];
    for (const event of events) {
      const prose = `${event.description} ${event.recommendedMove ?? ''}`;
      for (const [pattern, declares] of NAMED) {
        if (pattern.test(prose) && !declares(event)) {
          broken.push(`${event.id}: names something it does not declare (${pattern.source})`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('never rewards a behaviour it did not measure', () => {
    const CLAIMS: Array<[RegExp, (event: ScenarioEvent) => boolean, string]> = [
      // A *time* gap to the road user ahead, which is the thing `following`
      // measures — not the word "gap" used for a pinch in the kerbs.
      [
        /\bgap to\b|\broom to stop\b|\bseconds of road\b|\b\d+(?:\.\d+)?[- ]seconds?\b/i,
        e => Boolean(e.following),
        'a gap it kept',
      ],
      [/\bcurb lane\b|\bown side\b|\bhalf of the gap\b/i, e => Boolean(e.requiredLane), 'a lane the grader reads'],
      [/\bstopped\b|\bfull stop\b/i, e => e.correctAction === 'stop', 'a stop it watched happen'],
      [/\bhorn\b/i, e => Boolean(e.avoid?.includes('honk')), 'a horn it listened for'],
      [
        /\bheld your line\b|\bdrift(?:ed)?\b|\bsteady\b/i,
        e => Boolean(e.lineHold),
        'a line it measured',
      ],
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

/**
 * The six learning beats the module is assessed on, and the measurement that
 * is actually taken for each.
 *
 * The pairing is the point of the table: a scenario that says it is about
 * keeping a cushion and declares no `following` is a scenario whose lesson the
 * grader never looks at, which is the defect the level this replaced had four
 * versions of.
 *
 * `answer` is the second half of it. Six scenarios that each measure something
 * real can still be six scenarios a single habit clears, so the correct input
 * is named here too and no two of them may be the same.
 */
const BEATS: Array<{
  id: string;
  beat: string;
  answer: string;
  measured: (event: ScenarioEvent) => boolean;
}> = [
  {
    id: 'level8.school-gate',
    beat: 'reading a developing hazard early enough to arrive slow',
    answer: 'be under 20 before the line',
    measured: event =>
      event.correctAction === 'brake' &&
      !event.following &&
      !event.requiredLane &&
      // Children on the footpath, and the van's hazards, are the cue. Both are
      // declared, so the prediction is made from something on screen.
      Boolean(event.pedestrians?.length) &&
      event.actor?.hazards === true,
  },
  {
    id: 'level8.hold-your-line',
    beat: 'lateral stability while somebody passes, without retaliating',
    answer: 'touch nothing',
    measured: event =>
      event.lineHold !== undefined &&
      event.avoid?.includes('honk') === true &&
      event.npc?.path === 'filtering_past' &&
      // Explicitly not a speed test: easing off has to stay acceptable.
      !event.following &&
      event.effect === undefined,
  },
  {
    id: 'level8.blind-bend',
    beat: 'lane position through a curve you cannot see round',
    answer: 'move to the curb lane',
    measured: event =>
      event.requiredLane?.lane === 'curb' &&
      event.effect?.curve === 'left' &&
      event.npc?.vehicleKind === 'bus',
  },
  {
    id: 'level8.let-them-out',
    beat: 'courtesy: making space for somebody with no priority',
    answer: 'come to a full stop',
    measured: event =>
      event.correctAction === 'stop' &&
      event.npc?.path === 'crossing_from_right' &&
      // Waits to be let out rather than barging: without `yields` the jeepney
      // takes the gap itself and the courtesy is never the player's to give.
      event.npc.yields === true &&
      event.npc.emerges === true,
  },
  {
    id: 'level8.two-seconds',
    beat: 'a following gap held while the vehicle ahead slows',
    answer: 'ease off and keep two seconds',
    measured: event =>
      event.following?.seconds === 2 &&
      event.npc?.path === 'travelling_ahead' &&
      event.npc.speed?.slowsTo !== undefined,
  },
  {
    id: 'level8.both-at-once',
    beat: 'two hazards at once, with pressure from behind',
    answer: 'stop and hold, off the horn',
    measured: event =>
      event.correctAction === 'stop' &&
      event.avoid?.includes('honk') === true &&
      Boolean(event.pedestrians?.length) &&
      event.npc?.hazards === true,
  },
];

describe('the Level 8 curriculum', () => {
  it('covers each of the module’s six beats exactly once', () => {
    expect(BEATS.map(beat => beat.id)).toEqual(events.map(event => event.id));
  });

  it('asks for a different answer at every one of them', () => {
    // The whole reason the level was rebuilt. Six scenarios whose correct input
    // is the same input is one scenario repeated six times, and the habit that
    // clears it is the habit the module is supposed to be teaching against.
    const answers = BEATS.map(beat => beat.answer);
    expect(new Set(answers).size).toBe(answers.length);
    // And they are not all a variation on slowing down: the level has to be
    // failable by a driver whose only idea is the brake, and passable by one
    // who never touches it at the rider.
    const actions = new Set(events.map(event => event.correctAction));
    expect(actions.size).toBeGreaterThanOrEqual(3);
  });

  it('actually measures the behaviour each beat is about', () => {
    const unmeasured = BEATS.filter(beat => !beat.measured(byId(beat.id))).map(
      beat => `${beat.id}: nothing measures ${beat.beat}`
    );
    expect(unmeasured).toEqual([]);
  });

  it('grades defensive-driving judgment, not another level’s subject', () => {
    // No checkpoint, no vehicle failure, no parking bay, no expressway
    // manoeuvre, and nothing that can be answered by naming a sign: the two
    // boards on this route stand beside the road situation they describe and
    // neither is what is graded.
    const strays = events.filter(
      event =>
        event.inspection ||
        event.emergency ||
        event.bay ||
        event.maneuver ||
        event.merge ||
        event.overtake ||
        event.marking ||
        event.competency === 'road_signs'
    );
    expect(strays.map(event => event.id)).toEqual([]);
  });

  it('spreads its competencies across the module rather than repeating one', () => {
    const competencies = new Set(events.map(event => event.competency));
    expect(competencies.size).toBeGreaterThanOrEqual(3);
    for (const competency of competencies) {
      expect(
        ['hazard_awareness', 'pedestrians', 'right_of_way', 'general_rules', 'lane_discipline']
      ).toContain(competency);
    }
  });
});

describe('the Level 8 road', () => {
  it('is an ordinary two-way city street, with a side that is not yours', () => {
    expect(level8.paint?.oncomingLanes).toBe(2);
    expect(level8.speedLimit).toBe(40);
    // On the shared arithmetic: nothing about this level needs its own pace, and
    // a gap authored in seconds only means the same thing on both if it does not.
    expect(level8.pace).toBeUndefined();
  });

  it('puts every lane it names within reach of the wheel', () => {
    const unreachable: string[] = [];
    for (const event of events) {
      if (!event.requiredLane) continue;
      const wanted = resolveLaneRole(event.requiredLane.lane, 2);
      const bounds = laneBounds(
        ROAD_CENTRE_X,
        event.effect?.narrowsTo ?? 1,
        event.effect?.openSide ?? 'centre'
      );
      const reachable = [bounds.min, bounds.max].map(x => laneOf(x, ROAD_CENTRE_X));
      if (wanted < Math.min(...reachable) || wanted > Math.max(...reachable)) {
        unreachable.push(`${event.id}: asks for lane ${wanted}, which the road here does not reach`);
      }
    }
    expect(unreachable).toEqual([]);
  });

  it('bends the road it says bends, by enough to be a bend', () => {
    const bend = byId('level8.blind-bend');
    const curves = curvesForLevel(level8);
    expect(curves.length, 'the only curve on this route is the blind bend').toBe(1);
    // A full lane of swing, give or take: less and the "curve" is a kink in the
    // tarmac that nothing about lane position would follow from.
    const swing = Math.abs(roadOffsetAt(bend.triggerAtDistance, curves));
    expect(swing).toBeGreaterThan(LANE_WIDTH * 0.75);
    // Left-handed, which is why the curb lane is the one with the view.
    expect(roadOffsetAt(bend.triggerAtDistance, curves)).toBeLessThan(0);
    // Settled before the next scenario is graded, and already close enough to
    // straight where it opens that the side road is not drawn onto a curve the
    // driver is still steering through.
    const next = byId('level8.let-them-out');
    const opens = next.triggerAtDistance - warnings.get(next.triggerAtDistance)!;
    expect(Math.abs(roadOffsetAt(opens, curves))).toBeLessThan(LANE_WIDTH / 4);
    expect(roadOffsetAt(next.triggerAtDistance, curves)).toBeCloseTo(0, 5);
  });

  it('paints the bend with the line the bend is actually graded on', () => {
    // The binding one. The scenario marks a driver down for being against the
    // center line here, so the center line here has to be one they are not
    // allowed to be against. A broken line under a wrong-lane verdict is the
    // road contradicting the grader.
    const bend = byId('level8.blind-bend');
    const graded = {
      // Earliest the lane can settle the event, and the point the lane is read.
      from: bend.triggerAtDistance - REACTION_ZONE_ENTER,
      to: bend.triggerAtDistance + ACTION_ZONE_EXIT,
    };
    const solid = (level8.paint?.spans ?? []).filter(span => span.art === 'double_solid_yellow');
    const covering = solid.find(span => span.from <= graded.from && span.to >= graded.to);
    expect(
      covering,
      `nothing paints a solid line over ${graded.from}-${graded.to}, where the lane is graded`
    ).toBeDefined();
  });

  it('leaves the lane it sends you into fully drivable round the bend', () => {
    // A lane the wheel cannot reach, or one the car is pushed out of, would be
    // a scenario that asks for something the road refuses to give.
    const bend = byId('level8.blind-bend');
    const curves = curvesForLevel(level8);
    const curb = resolveLaneRole('curb', 2);
    const off: string[] = [];
    for (let at = bend.triggerAtDistance - 400; at <= bend.triggerAtDistance + 100; at += 20) {
      const roadX = roadXAt(at, curves);
      const bounds = laneBounds(roadX, 1, 'centre');
      const centre = laneCentreX(curb, roadX);
      if (centre < bounds.min || centre > bounds.max) off.push(`${at}: curb lane out of bounds`);
      if (laneOf(centre, roadX) !== curb) off.push(`${at}: curb lane centre reads as another lane`);
    }
    expect(off).toEqual([]);
  });

  it('keeps the people at the school gate off the carriageway', () => {
    // They are the cue, not the hazard: something to read and slow for, with
    // nothing to hit. A body in the lane would make the scenario a stop test.
    const event = byId('level8.school-gate');
    const people = event.pedestrians!;
    expect(people.length).toBeGreaterThan(0);
    for (const person of people) {
      expect(person.solid, 'somebody at the gate is a collision body').toBeFalsy();
      // Past the far curb: `position` is a share of the road width from its
      // left edge, so anything over 1 is off the carriageway entirely.
      expect(person.position, `${person.kind} at ${person.position} is on the road`).toBeGreaterThan(1);
    }
    const group = sceneAt(event, 0).find(node => node.kind === 'pedestrian-group');
    expect(group, 'the declared people are not composed onto the road').toBeDefined();
    expect(group!.solids ?? [], 'somebody at the gate can be hit').toEqual([]);
  });
});

describe('Level 8 pacing', () => {
  /** How much road it takes to stop from the fastest this car can be driven. */
  const recoveryNeeded = stoppingDistance(speedProfileFor(level8.speedLimit).maxSpeed);

  it('gives every scenario a warning long enough to stop inside', () => {
    const tooLate: string[] = [];
    for (const event of events) {
      const warning = warnings.get(event.triggerAtDistance)!;
      const seconds = warning / (level8.speedLimit * 0.05 * 60);
      if (warning < recoveryNeeded) {
        tooLate.push(`${event.id}: ${warning} units of warning, ${Math.round(recoveryNeeded)} needed to stop`);
      }
      if (seconds < 3) tooLate.push(`${event.id}: only ${seconds.toFixed(1)}s of warning at the limit`);
    }
    expect(tooLate).toEqual([]);
  });

  it('honours the warning each scenario authored, rather than clamping it', () => {
    const clamped = events
      .filter(event => warnings.get(event.triggerAtDistance) !== event.warningDistance)
      .map(event => `${event.id}: authored ${event.warningDistance}, got ${warnings.get(event.triggerAtDistance)}`);
    expect(clamped).toEqual([]);
  });

  it('never opens one scenario inside the window of the one before it', () => {
    const overlaps: string[] = [];
    for (let i = 1; i < events.length; i++) {
      const previous = events[i - 1];
      const event = events[i];
      const previousCloses = previous.triggerAtDistance + ACTION_ZONE_EXIT;
      const opens = event.triggerAtDistance - warnings.get(event.triggerAtDistance)!;
      if (opens < previousCloses) {
        overlaps.push(`${event.id} opens at ${opens}, inside ${previous.id}'s window`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('leaves recovery road between one scenario and the next', () => {
    const cramped: string[] = [];
    for (let i = 1; i < events.length; i++) {
      const gap =
        events[i].triggerAtDistance -
        warnings.get(events[i].triggerAtDistance)! -
        (events[i - 1].triggerAtDistance + ACTION_ZONE_EXIT);
      if (gap < recoveryNeeded) {
        cramped.push(`${events[i].id}: ${Math.round(gap)} units of clear road behind it`);
      }
    }
    expect(cramped).toEqual([]);
    // And road left past the last one for its window to close in.
    const last = events[events.length - 1];
    expect(level8.roadLength - last.triggerAtDistance).toBeGreaterThan(ACTION_ZONE_EXIT * 5);
  });

  it('has every road user it describes on the road while it is being read', () => {
    // Each scenario is read with the drive held, and what it describes is
    // supposed to be the thing on the board behind the panel. A vehicle whose
    // approach is shorter than its warning distance arrives *after* the driver
    // has been told about it, which makes the briefing prose rather than a
    // description of the road.
    const late: string[] = [];
    for (const event of events) {
      if (!event.npc) continue;
      const warning = warnings.get(event.triggerAtDistance)!;
      const onScreen = sceneAt(event, warning).some(
        node => node.kind === 'scripted-vehicle' && node.npc === event.npc
      );
      if (!onScreen) late.push(`${event.id}: ${event.npc.label} is not there yet at ${warning} out`);
    }
    expect(late).toEqual([]);
  });

  it('brings each scenario its own traffic, and nobody else’s', () => {
    // A lead vehicle left over from the scenario before is a second thing in the
    // driver's lane with nothing on screen explaining it.
    const crowded: string[] = [];
    for (const event of events) {
      const strangers = sceneAt(event, 0)
        .filter(
          (node): node is Extract<SceneNode, { kind: 'scripted-vehicle' }> =>
            node.kind === 'scripted-vehicle'
        )
        .filter(node => node.npc !== event.npc && node.npc !== event.rear)
        .filter(node => node.at.y > 260);
      if (strangers.length > 0) {
        crowded.push(`${event.id}: ${strangers.map(s => s.npc.label).join(', ')} still on the road`);
      }
    }
    expect(crowded).toEqual([]);
  });
});

describe('the Level 8 score', () => {
  const total = events.reduce((sum, event) => sum + event.points, 0);

  it('is calibrated against what the route is actually worth', () => {
    expect(total).toBe(170);
    expect(level8.requiredScore).toBeLessThan(level8.stars2);
    expect(level8.stars2).toBeLessThan(level8.stars3);
    expect(level8.stars3).toBeLessThanOrEqual(total);
    expect(level8.requiredScore / total).toBeGreaterThan(0.66);
    expect(level8.requiredScore / total).toBeLessThan(0.72);
  });

  it('keeps the failures that would hurt somebody severe', () => {
    // Every one of these ends with a person or a head-on if it is got wrong.
    const CRITICAL = [
      'level8.hold-your-line',
      'level8.blind-bend',
      'level8.two-seconds',
      'level8.both-at-once',
    ];
    for (const id of CRITICAL) expect(byId(id).severity, id).toBe('critical');
    // And severity and worth agree: every scenario that ends with somebody hurt
    // is worth more than every scenario that does not. That is what makes "one
    // lapse is forgiven, but not this one" a rule rather than an accident of
    // which events happen to carry which numbers.
    const critical = events.filter(event => event.severity === 'critical');
    const rest = events.filter(event => event.severity !== 'critical');
    expect(critical.map(event => event.id).sort()).toEqual([...CRITICAL].sort());
    expect(Math.min(...critical.map(event => event.points))).toBeGreaterThan(
      Math.max(...rest.map(event => event.points))
    );
  });

  it('forgives one lapse and no more', () => {
    // Failing an event costs its points twice: once unearned, once deducted.
    // The ladder that falls out of it is the whole calibration — a clean run
    // scores everything, one 25-point slip still just clears the mark, a
    // critical 30-point one does not, and two of anything is nowhere near.
    const cost = (id: string) => {
      const event = byId(id);
      const weight = event.severity === 'critical' ? 2 : event.severity === 'major' ? 1.5 : 1;
      return event.points + Math.ceil(event.points * 0.5 * weight);
    };
    const cheapest = Math.min(...events.map(event => cost(event.id)));
    const dearest = Math.max(...events.map(event => cost(event.id)));
    expect(total - cheapest, 'one small lapse should still scrape a pass').toBeGreaterThanOrEqual(
      level8.requiredScore
    );
    expect(total - dearest, 'a critical lapse should not').toBeLessThan(level8.requiredScore);
    expect(total - cheapest * 2, 'two lapses should be nowhere near').toBeLessThan(
      level8.requiredScore - 30
    );
  });

  it('cannot be passed by clearing only the scenarios one habit answers', () => {
    // Arithmetic rather than a drive — `level8Drive.test.ts` does it for real,
    // through the session, and is the assertion that actually settles it.
    const cost = (id: string) => {
      const event = byId(id);
      const weight = event.severity === 'critical' ? 2 : event.severity === 'major' ? 1.5 : 1;
      return event.points + Math.ceil(event.points * 0.5 * weight);
    };
    // A driver whose only idea is the brake misses the bend's lane.
    expect(total - cost('level8.blind-bend')).toBeLessThan(level8.requiredScore);
    // A driver who never comes to a full stop misses both stops.
    expect(
      total - cost('level8.let-them-out') - cost('level8.both-at-once')
    ).toBeLessThan(level8.requiredScore);
    // A driver who answers everything with the horn loses both prohibitions.
    expect(
      total - cost('level8.hold-your-line') - cost('level8.both-at-once')
    ).toBeLessThan(level8.requiredScore);
  });
});
