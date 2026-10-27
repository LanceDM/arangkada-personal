/**
 * Level 10, as one trip rather than a law quiz with a road attached.
 *
 * The roster this replaced ran five driveway questions and eight road events —
 * thirteen graded decisions, eight of them multiple choice — and two of the
 * "driven" ones described a jeepney and a truck that nothing put on the road.
 * A third named a following distance and declared no vehicle to keep one from.
 *
 * So the assertions below are mostly about measurement: every scenario says
 * what the safe move is, every road user its prose names is declared, every
 * reward names only what the grader actually watched, and each of the seven
 * beats is measured by something different from all the others.
 */
import { describe, expect, it } from 'vitest';
import { level10 } from './level10';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { scenarioInstruction, scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { paceOf, unitsForSeconds } from '@/features/driving-sim/domain/world/DrivingPace';
import type { RoadTraffic } from '@/features/driving-sim/domain/systems/roadTraffic';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import {
  ACTION_ZONE_EXIT,
  BAY_SPAN,
  BRAKE_FORCE,
  REACTION_ZONE_ENTER,
  ROAD_CENTRE_X,
  isInBay,
  laneBounds,
  resolveLaneRole,
  speedProfileFor,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';

const events = level10.events;
const byId = (id: string) => events.find(event => event.id === id)!;
const hotspots = level10.garage!.hotspots;
const warnings = computeWarningDistances(events);

const FROZEN_NOW = 1_700_000_000_000;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
/** Sentences, counted the way a reader does: by full stops that end one. */
const sentences = (text: string) => text.split(/[.!?]+(?:\s|$)/).filter(part => part.trim()).length;

/**
 * Everything on the road with the player `ahead` units short of an event.
 *
 * The drive's own traffic map is stood in for rather than left out. A vehicle
 * travelling ahead carries its own road distance, so a composition with no
 * drive behind it has nowhere to read that from; the map says where this
 * event's vehicle is, and that nobody else's has joined yet.
 */
const sceneAt = (event: ScenarioEvent, ahead: number): SceneNode[] => {
  const distance = event.triggerAtDistance - ahead;
  const traffic: RoadTraffic = new Map();
  if (event.npc?.path === 'travelling_ahead') {
    traffic.set(event.id, {
      distance:
        distance +
        unitsForSeconds(event.npc.entryHeadway ?? 2.5, level10.speedLimit, paceOf(level10)),
      speed: level10.speedLimit * (event.npc.speed?.cruise ?? 1),
      braking: false,
    });
  }
  return composeWorldFrame(
    { level: level10, distance, handled: new Set<number>(), curves: [] },
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

describe('what Level 10 no longer is', () => {
  it('keeps none of the scenarios it replaced, anywhere in the game', () => {
    const REMOVED = [
      'level10.phone-rings-driving',
      'level10.child-out-of-harness',
      'level10.smoke-belcher-following-distance',
      'level10.checkpoint-field-sobriety-test',
      'level10.checkpoint-bac-release',
      'level10.overloaded-truck-gravel',
      'level10.bus-speed-limiter-descent',
      'level10.phone-call-for-help',
      // And the five driveway points, which were addressed by their own ids.
      'rear-child-restraints',
      'front-seat-belts',
      'load-and-seats',
      'emission-certificate',
      'who-drives',
    ];
    // Across the whole roster, not just this level: Level 12 borrows content by
    // id and the remediation index reads this level's SLOTS, so a stale copy
    // would keep an old scenario alive somewhere else.
    const survivors = LEVELS.flatMap(level => [
      ...level.events.map(event => event.id),
      ...(level.garage?.hotspots ?? []).map(spot => spot.id),
      ...(level.aftermath?.hotspots ?? []).map(spot => spot.id),
    ]).filter(id => REMOVED.includes(id));
    expect(survivors).toEqual([]);
  });

  it('asks only one of its road scenarios through a frozen prompt', () => {
    // A ringing phone is answered correctly by doing nothing, which no speed or
    // lane can tell apart from not having noticed. Everything else on this
    // route ends in something the telemetry watched happen.
    const frozen = events.filter(event => event.cutscene || event.parkingCutscene);
    expect(frozen.map(event => event.id)).toEqual(['level10.the-phone-rings']);
  });

  it('settles the checkpoint in one stop rather than two', () => {
    const checkpoints = events.filter(event => event.inspection);
    expect(checkpoints.map(event => event.id)).toEqual(['level10.the-checkpoint']);
    // And it is answered by actually stopping: the document only opens once the
    // car is at rest, so a driver who rolls through is graded on rolling
    // through. The old release event asked the driver to accelerate at a
    // `stop_sign`, which is the two halves disagreeing about what was wanted.
    expect(byId('level10.the-checkpoint').correctAction).toBe('stop');
  });

  it('puts nothing abstract on the carriageway', () => {
    // The compliance glyph — a phone, a child, a padlock — is drawn dead centre
    // of the road. Three of the old events used one, so the scene for "your
    // phone is ringing" was an icon floating in the lane ahead.
    const glyphs = events.filter(event => event.scenePrefab?.kind === 'compliance');
    expect(glyphs.map(event => event.id)).toEqual([]);
  });
});

describe('every Level 10 scenario', () => {
  it('is named with this level’s own stable id convention', () => {
    const ids = events.map(event => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(id => !/^level10\.[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toEqual([]);
  });

  it('is the set of ids the rest of the game refers to', () => {
    // Pinned rather than derived: `remediationPool` indexes this level's SLOTS
    // by competency and `pullOverBay.test.ts` names the bay, so an id that
    // quietly changes breaks the trail from what is on screen back to here.
    expect(events.map(event => event.id)).toEqual([
      'level10.the-phone-rings',
      'level10.out-of-her-seat',
      'level10.smoke-in-the-lane',
      'level10.the-checkpoint',
      'level10.losing-its-load',
      'level10.bus-on-the-grade',
      'level10.rider-down',
    ]);
  });

  it('names each one in two to five words, on the road and on the verdict', () => {
    // `scenarioLabel` is what the road prompt, the read panel and the result
    // card all call this scenario. Derived from the id where a level has not
    // authored one, which is how "Smoke Belcher Following Distance" ended up
    // truncated across the top of the prompt.
    for (const event of events) {
      expect(event.label, `${event.id} has no label`).toBeTruthy();
      expect(words(scenarioLabel(event)), `${event.id} label`).toBeLessThanOrEqual(5);
      expect(words(scenarioLabel(event)), `${event.id} label`).toBeGreaterThanOrEqual(2);
    }
  });

  it('says what to do about each one the driver actually drives, in ten words', () => {
    // The frozen prompt is excluded: it carries a question and three answers
    // instead, and the read panel it would appear in is suppressed for it.
    // The checkpoint is excluded too — its prompt is the checkpoint tone, which
    // writes its own "brake to a full stop at the line".
    const driven = events.filter(event => !event.cutscene && !event.inspection);
    for (const event of driven) {
      expect(event.recommendedMove, `${event.id} has no recommended move`).toBeTruthy();
      expect(words(scenarioInstruction(event)), `${event.id} move`).toBeLessThanOrEqual(10);
    }
  });

  it('puts something on the road at every one of them', () => {
    const empty = events
      .filter(event => sceneAt(event, 0).length === 0)
      .map(event => `${event.id}: composes nothing at all`);
    expect(empty).toEqual([]);
  });

  it('puts something solid where it claims a physical hazard', () => {
    // The three that can be driven into. A checkpoint puts nothing solid on the
    // road by design, and neither does a turnout or a posted speed.
    const HAZARDS = ['level10.smoke-in-the-lane', 'level10.losing-its-load', 'level10.rider-down'];
    for (const id of HAZARDS) {
      const solids = sceneAt(byId(id), 0).flatMap(node => node.solids ?? []);
      expect(solids.length, `${id}: nothing on its road can be hit`).toBeGreaterThan(0);
    }
  });

  it('declares every road user its prose names', () => {
    // The defect this catches is the one the old level had twice: a description
    // promising a jeepney laying down smoke, and a road with nothing on it.
    const vehicle = (event: ScenarioEvent) => [event.npc?.vehicleKind, event.rear?.vehicleKind];
    const naming = (noun: string) =>
      new RegExp(`\\b(?:a|an|the)\\s+(?:\\w+\\s+){0,2}${noun}\\b`, 'i');
    const NAMED: Array<[RegExp, (event: ScenarioEvent) => boolean]> = [
      [naming('trucks?'), e => vehicle(e).includes('truck') || e.actor?.kind === 'truck'],
      [naming('jeepneys?'), e => vehicle(e).includes('jeepney') || e.actor?.kind === 'jeepney'],
      [
        naming('motorcycles?'),
        e => vehicle(e).includes('motorcycle') || e.actor?.kind === 'motorcycle',
      ],
      [naming('bus(?:es)?'), e => vehicle(e).includes('bus') || e.actor?.kind === 'bus'],
      [naming('riders?'), e => vehicle(e).includes('motorcycle') || e.actor?.kind === 'motorcycle'],
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
      [
        /\bgap to\b|\broom to stop\b|\b\d+(?:\.\d+)?[- ]seconds?\b|\bthree seconds\b/i,
        e => Boolean(e.following),
        'a gap it kept',
      ],
      [
        /\bown side\b|\bcenter line\b|\bcurb lane\b/i,
        e => Boolean(e.requiredLane),
        'a lane the grader reads',
      ],
      [/\bstopped\b|\bfull stop\b/i, e => e.correctAction === 'stop', 'a stop it watched happen'],
      [/\boff the travel lane\b|\bturnout\b/i, e => Boolean(e.bay), 'a bay it watched you stop in'],
      [/\bheld your line\b|\bdrift(?:ed)?\b/i, e => Boolean(e.lineHold), 'a line it measured'],
      [/\bforty\b/i, e => e.postedSpeed === 40, 'a posted speed it read you against'],
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
 * The seven beats the module is assessed on, and the measurement taken for each.
 *
 * The pairing is the point of the table: a scenario that says it is about
 * keeping a cushion and declares no `following` is a scenario whose lesson the
 * grader never looks at, which the old route had twice.
 *
 * `answer` is the other half. Seven scenarios that each measure something real
 * can still be seven scenarios a single habit clears, so the correct input is
 * named here too and no two of them may be the same.
 */
const BEATS: Array<{
  id: string;
  law: string;
  beat: string;
  answer: string;
  measured: (event: ScenarioEvent) => boolean;
}> = [
  {
    id: 'level10.the-phone-rings',
    law: 'RA 10913',
    beat: 'the phone stays in the cradle, red light included',
    answer: 'do nothing at all',
    measured: event =>
      event.cutscene === true &&
      event.correctAction === 'accelerate' &&
      // Three answers, and the red-light one is the distractor that matters.
      event.choices?.length === 3 &&
      event.choices.some(choice => /red light/i.test(choice.label)),
  },
  {
    id: 'level10.out-of-her-seat',
    law: 'RA 11229',
    beat: 'a restraint is fixed stopped, off the travel lane',
    answer: 'stop in the turnout',
    measured: event =>
      event.correctAction === 'stop' &&
      event.bay?.side === 'right' &&
      event.bay.mayStop === true &&
      // Explicitly not a speed test: `bay` is the whole grade where it is set.
      !event.following &&
      !event.requiredLane &&
      // The road shows the turnout; the situation must not say where to go,
      // or a driver shown it alone has been told the move.
      !/turnout|lay-by|pull (?:in|over|off)/i.test(event.description),
  },
  {
    id: 'level10.smoke-in-the-lane',
    law: 'RA 8749',
    beat: 'a smoke-belcher is fallen back from, not crowded',
    answer: 'keep three seconds',
    measured: event =>
      event.following?.seconds === 3 &&
      event.npc?.path === 'travelling_ahead' &&
      event.npc.smoking === true &&
      // It slows on the run-in, so the gap is tested by the jeepney closing it
      // rather than by the driver choosing to.
      event.npc.speed?.slowsTo !== undefined &&
      // And nothing hides the road: a visibility effect composes an empty scene,
      // which is what left the old event describing a jeepney that was not drawn.
      event.effect?.visibility === undefined,
  },
  {
    id: 'level10.the-checkpoint',
    law: 'RA 10586',
    beat: 'submitting to a lawful direction rather than arguing with it',
    answer: 'stop, then take the tests',
    measured: event =>
      event.correctAction === 'stop' &&
      event.inspection !== undefined &&
      event.choices?.length === 3 &&
      // The correct answer has to be the one that also satisfies the stop, or
      // the driving half and the judgment half grade different things.
      event.choices.some(choice => choice.action === 'stop') &&
      // Probable cause is a sign on the driver: the Act counts the smell of
      // alcohol on the driver's breath, never a passenger's.
      event.inspection.fields.some(
        field => field.label === 'Probable cause' && /\bdriver\b/i.test(field.value)
      ),
  },
  {
    id: 'level10.losing-its-load',
    law: 'RA 8794',
    beat: 'a truck shedding its load is not passed across the solid line',
    answer: 'stay on your side of the line',
    measured: event =>
      event.requiredLane?.lane === 'inner' &&
      event.requiredLane.strict === true &&
      event.npc?.vehicleKind === 'truck' &&
      // The gravel is what makes the crossing a bad idea rather than a rule.
      (event.effect?.grip ?? 1) < 1,
  },
  {
    id: 'level10.bus-on-the-grade',
    law: 'RA 10916',
    beat: 'a vehicle with no limiter is not a speed to match',
    answer: 'hold the posted forty',
    measured: event =>
      event.type === 'speed_limit' &&
      event.postedSpeed === 40 &&
      event.npc?.vehicleKind === 'bus' &&
      // Running away from you, which is what a missing limiter looks like.
      (event.npc.speed?.cruise ?? 1) > 1 &&
      // On a downgrade, so holding forty is an act rather than an absence.
      (event.effect?.gradient ?? 0) > 0,
  },
  {
    id: 'level10.rider-down',
    law: 'RA 10913 exemption',
    beat: 'stopping for somebody who is not your problem',
    answer: 'full stop short of the bike',
    measured: event =>
      event.correctAction === 'stop' &&
      !event.bay &&
      event.actor?.kind === 'motorcycle' &&
      // The one thing on this route the player is told to use the phone for,
      // and it has no key — so it is a real-world note, never an instruction.
      // 911, which EO 56 s. 2018 put in place of the PNP 117 RO101 prints, and
      // the Red Cross on 143. 117 is nowhere in the scenario.
      /\b911\b/.test(event.realWorldNote ?? '') &&
      /\b143\b/.test(event.realWorldNote ?? '') &&
      !/\b117\b/.test(JSON.stringify(event)),
  },
];

describe('the Level 10 curriculum', () => {
  it('covers each of the seven beats exactly once, in route order', () => {
    expect(BEATS.map(beat => beat.id)).toEqual(events.map(event => event.id));
  });

  it('asks for a different answer at every one of them', () => {
    const answers = BEATS.map(beat => beat.answer);
    expect(new Set(answers).size).toBe(answers.length);
    // And they are not all a variation on slowing down: the level has to be
    // failable by a driver whose only idea is the brake.
    const actions = new Set(events.map(event => event.correctAction));
    expect(actions.size).toBeGreaterThanOrEqual(3);
  });

  it('actually measures the behaviour each beat is about', () => {
    const unmeasured = BEATS.filter(beat => !beat.measured(byId(beat.id))).map(
      beat => `${beat.id}: nothing measures ${beat.beat}`
    );
    expect(unmeasured).toEqual([]);
  });

  it('teaches all seven of the module’s laws between the driveway and the road', () => {
    // The module names seven Acts and the level has to reach every one. Read
    // off the citations, which is where the statute is actually quoted, rather
    // than off a list kept in step by hand.
    const cited = [...events, ...hotspots]
      .map(item => item.lawCitation ?? '')
      .join(' ');
    for (const act of ['RA 8750', 'RA 11229', 'RA 10913', 'RA 10586', 'RA 8749', 'RA 8794', 'RA 10916']) {
      expect(cited, `${act} is never cited`).toContain(act);
    }
  });

  it('grades no peso amount, threshold or weight', () => {
    // Every number the syllabus quotes lives in a citation, behind a
    // disclosure. A question whose answer turns on one is a question a player
    // can only lose to a figure they had no way to look up — and several would
    // not survive it, since RA 8749's fines are ceilings, RA 10586's are ranges,
    // and the two LTO decks disagree about RA 10916's second offense.
    const asked = [...events, ...hotspots].flatMap(item => [
      item.question ?? '',
      ...(item.choices ?? []).map(choice => choice.label),
    ]);
    const priced = asked.filter(text => /php|\bkg\b|kilogram|percent|tolerance/i.test(text));
    expect(priced).toEqual([]);
  });

  it('spreads its competencies rather than repeating one', () => {
    const competencies = new Set(events.map(event => event.competency));
    expect(competencies.size).toBeGreaterThanOrEqual(3);
    for (const competency of competencies) {
      expect(['general_rules', 'hazard_awareness', 'speed_control']).toContain(competency);
    }
  });
});

describe('the Level 10 driveway', () => {
  it('is four points, walked round the car', () => {
    expect(hotspots.map(spot => spot.id)).toEqual([
      'the-keys',
      'the-front-row',
      'the-back-seat',
      'the-load',
    ]);
  });

  it('does not teach refusal: one point is a point where nothing is wrong', () => {
    // Three No-Go answers and one Go. A stage whose every correct answer is a
    // refusal trains refusal, and this one is graded on noticing that two
    // correctly worn belts need nothing done about them.
    const go = hotspots.filter(spot => spot.correctAction === 'accelerate');
    expect(go.map(spot => spot.id)).toEqual(['the-front-row']);
  });

  it('offers an over-cautious wrong answer at every point, not just a careless one', () => {
    // The other half of the same argument. A point whose only wrong answers are
    // "carry on regardless" is a point a player clears by always saying no.
    for (const spot of hotspots) {
      const wrong = spot.choices.filter(choice => choice.action !== spot.correctAction);
      expect(wrong.length, `${spot.id} has no distractors`).toBe(2);
    }
    // And the two points the module is most often misremembered at each carry
    // the misremembering as an answer.
    expect(byId('level10.the-phone-rings').choices!.map(c => c.label).join(' ')).toMatch(/red light/i);
    expect(hotspots.find(s => s.id === 'the-back-seat')!.choices.map(c => c.label).join(' ')).toMatch(
      /under twelve/i
    );
  });

  it('puts each point where that part of the car actually is', () => {
    // The driveway diagram draws the car nose-up, seen from above, so the
    // driver's door is on the left and the trunk is at the bottom. The point
    // about who takes the wheel used to sit on the front passenger seat.
    const at = (id: string) => hotspots.find(spot => spot.id === id)!;
    expect(at('the-keys').x).toBeLessThan(0.5);
    expect(at('the-front-row').x).toBeGreaterThan(0.5);
    expect(at('the-keys').y).toBeCloseTo(at('the-front-row').y, 5);
    expect(at('the-back-seat').y).toBeGreaterThan(at('the-front-row').y);
    expect(at('the-load').y).toBeGreaterThan(at('the-back-seat').y);
  });

  it('shows a drawing of the thing it is asking about', () => {
    // Every point used to come with the same cockpit close-up — a gearstick and
    // a sleeping face — including the two about how somebody is belted.
    const detail = (id: string) => hotspots.find(spot => spot.id === id)!.detail;
    expect(detail('the-front-row')).toBe('belt');
    expect(detail('the-back-seat')).toBe('child_seat');
    expect(detail('the-load')).toBe('trunk');
  });
});

describe('Level 10 copy fits on the screen it is shown on', () => {
  it('sets each situation up in one or two sentences', () => {
    for (const event of events) {
      expect(words(event.description), `${event.id} description`).toBeLessThanOrEqual(32);
      expect(sentences(event.description), `${event.id} description`).toBeLessThanOrEqual(2);
    }
  });

  it('keeps the verdicts to two short sentences', () => {
    // The long-form rule lives behind the "Why this matters" disclosure on the
    // read panel, the result card and the docked decision alike. A verdict read
    // while the next scenario is announcing itself gets two sentences — the old
    // `who-drives` penalty ran to a hundred and thirty words in a 340px column.
    for (const item of [...events, ...hotspots]) {
      expect(sentences(item.rewardMessage), `${item.id} reward`).toBeLessThanOrEqual(2);
      expect(sentences(item.penaltyMessage), `${item.id} penalty`).toBeLessThanOrEqual(2);
      expect(words(item.rewardMessage), `${item.id} reward`).toBeLessThanOrEqual(30);
      expect(words(item.penaltyMessage), `${item.id} penalty`).toBeLessThanOrEqual(30);
    }
  });

  it('asks and answers every question briefly', () => {
    const asked = [...events, ...hotspots].filter(item => item.choices?.length);
    expect(asked.length).toBe(6);
    for (const item of asked) {
      expect(words(item.question!), `${item.id} question`).toBeLessThanOrEqual(12);
      expect(sentences(item.question!), `${item.id} question`).toBeLessThanOrEqual(2);
      for (const choice of item.choices!) {
        expect(words(choice.label), choice.label).toBeLessThanOrEqual(15);
      }
    }
  });

  it('keeps each driveway observation to what can be seen at a glance', () => {
    for (const spot of hotspots) {
      expect(words(spot.observation), `${spot.id} observation`).toBeLessThanOrEqual(30);
      expect(sentences(spot.observation), `${spot.id} observation`).toBeLessThanOrEqual(2);
    }
  });

  it('puts every long legal passage behind the disclosure and nowhere else', () => {
    // A citation may be as long as the statute needs; nothing else may.
    for (const item of [...events, ...hotspots]) {
      expect(item.lawCitation, `${item.id} cites nothing`).toBeTruthy();
      expect(words(item.lawCitation!), `${item.id} citation`).toBeGreaterThan(30);
    }
  });
});

describe('the Level 10 road', () => {
  it('is an ordinary two-way national road, with a side that is not yours', () => {
    expect(level10.paint?.oncomingLanes).toBe(2);
    expect(level10.speedLimit).toBe(60);
    // On the shared arithmetic: a gap authored in seconds only means the same
    // thing on both scales if the level does not move one of them.
    expect(level10.pace).toBeUndefined();
  });

  it('paints a solid line over the whole stretch the crossing is graded on', () => {
    // The binding one. `requiredLane.strict` fails a driver who crossed the
    // center line anywhere in the window, so the center line has to be one they
    // were not allowed to cross for all of it. A broken line under a wrong-lane
    // verdict is the road contradicting the grader.
    const truck = byId('level10.losing-its-load');
    const graded = {
      from: truck.triggerAtDistance - warnings.get(truck.triggerAtDistance)!,
      to: truck.triggerAtDistance + ACTION_ZONE_EXIT,
    };
    const solid = (level10.paint?.spans ?? []).filter(span => span.art === 'double_solid_yellow');
    const covering = solid.find(span => span.from <= graded.from && span.to >= graded.to);
    expect(
      covering,
      `nothing paints a solid line over ${graded.from}-${graded.to}, where the lane is graded`
    ).toBeDefined();
  });

  it('paints nothing solid over the scenarios that are not about the line', () => {
    // A solid line under the smoke or the grade would forbid an overtake
    // neither of them is asking about, and the driver has no way to tell which
    // marking belongs to which lesson.
    const spans = level10.paint?.spans ?? [];
    for (const id of ['level10.smoke-in-the-lane', 'level10.bus-on-the-grade']) {
      const at = byId(id).triggerAtDistance;
      const over = spans.filter(span => span.from <= at && span.to >= at);
      expect(over, `${id} is under a painted span`).toEqual([]);
    }
  });

  it('asks for a lane the road actually reaches', () => {
    const truck = byId('level10.losing-its-load');
    const wanted = resolveLaneRole(truck.requiredLane!.lane, 2);
    // `inner` is the first lane on the driver's own side, and `strict` makes
    // everything outward of it acceptable too — so the requirement is a
    // prohibition on the oncoming side rather than an instruction to sit in one
    // lane. Both of the driver's lanes have to satisfy it.
    expect(wanted).toBe(2);
  });

  it('puts the turnout somewhere the wheel can reach and the paint shows', () => {
    const bay = byId('level10.out-of-her-seat').bay!;
    expect(bay.side).toBe('right');
    expect(isInBay(laneBounds(ROAD_CENTRE_X).max + 40, ROAD_CENTRE_X, 'right')).toBe(true);
    // And the driver has to still be rolling when it opens, which is what the
    // warning distance buys them.
    expect(warnings.get(byId('level10.out-of-her-seat').triggerAtDistance)!).toBeGreaterThan(
      BAY_SPAN * 4
    );
    // Drawn, and not only where a sign happens to stand beside it: the bay used
    // to be composed inside the signed lay-by scene alone, so an unsigned one
    // was graded on stopping in a space the road never showed.
    const marking = sceneAt(byId('level10.out-of-her-seat'), 0).find(
      node => node.kind === 'road-marking' && node.marking.mark === 'pull-over-bay'
    );
    expect(marking, 'the turnout is nowhere on the road').toBeDefined();
  });

  it('gives the rider a stopping distance rather than a reading distance', () => {
    const rider = byId('level10.rider-down');
    expect(rider.correctAction).toBe('stop');
    expect(warnings.get(rider.triggerAtDistance)!).toBeGreaterThanOrEqual(400);
  });
});

describe('Level 10 pacing', () => {
  /** How much road it takes to stop from the fastest this car can be driven. */
  const recoveryNeeded = stoppingDistance(speedProfileFor(level10.speedLimit).maxSpeed);

  it('gives every driven scenario a warning long enough to stop inside', () => {
    const tooLate: string[] = [];
    for (const event of events.filter(event => !event.cutscene)) {
      const warning = warnings.get(event.triggerAtDistance)!;
      const seconds = warning / (level10.speedLimit * 0.05 * 60);
      if (warning < recoveryNeeded) {
        tooLate.push(
          `${event.id}: ${warning} units of warning, ${Math.round(recoveryNeeded)} needed to stop`
        );
      }
      if (seconds < 3) tooLate.push(`${event.id}: only ${seconds.toFixed(1)}s of warning at the limit`);
    }
    expect(tooLate).toEqual([]);
  });

  it('honours the warning each scenario authored, rather than clamping it', () => {
    const clamped = events
      .filter(event => warnings.get(event.triggerAtDistance) !== event.warningDistance)
      .map(
        event =>
          `${event.id}: authored ${event.warningDistance}, got ${warnings.get(event.triggerAtDistance)}`
      );
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
    const last = events[events.length - 1];
    expect(level10.roadLength - last.triggerAtDistance).toBeGreaterThan(ACTION_ZONE_EXIT * 5);
  });

  it('has every road user it describes on the road while it is being read', () => {
    // Each driven scenario is read with the drive held, and what it describes is
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

  it('keeps the reaction band inside the solid line the truck is graded on', () => {
    // The band the wrong-lane verdict is most likely to be earned in, checked
    // separately from the whole window: a driver pulls out when they can see
    // past, which is late.
    const truck = byId('level10.losing-its-load');
    const span = (level10.paint?.spans ?? []).find(s => s.art === 'double_solid_yellow')!;
    expect(span.from).toBeLessThanOrEqual(truck.triggerAtDistance - REACTION_ZONE_ENTER);
    expect(span.to).toBeGreaterThanOrEqual(truck.triggerAtDistance + ACTION_ZONE_EXIT);
  });
});

describe('the Level 10 score', () => {
  const road = events.reduce((sum, event) => sum + event.points, 0);
  const driveway = hotspots.reduce((sum, spot) => sum + spot.points, 0);
  const total = road + driveway;

  it('is calibrated against what the mission is actually worth', () => {
    expect(road).toBe(155);
    expect(driveway).toBe(60);
    expect(total).toBe(215);
    expect(level10.requiredScore).toBeLessThan(level10.stars2);
    expect(level10.stars2).toBeLessThan(level10.stars3);
    expect(level10.stars3).toBeLessThanOrEqual(total);
    expect(level10.requiredScore / total).toBeGreaterThan(0.66);
    expect(level10.requiredScore / total).toBeLessThan(0.72);
  });

  it('keeps the driveway under a third of the mission', () => {
    // The old stage scored a hundred of two hundred and seventy-five before the
    // wheels turned. A readiness check sets the trip up; it does not win it.
    expect(driveway / total).toBeLessThan(0.3);
  });

  it('keeps the failures that would hurt somebody severe, and worth more', () => {
    const CRITICAL = [
      'level10.out-of-her-seat',
      'level10.the-checkpoint',
      'level10.rider-down',
    ];
    for (const id of CRITICAL) expect(byId(id).severity, id).toBe('critical');
    const critical = events.filter(event => event.severity === 'critical');
    expect(critical.map(event => event.id).sort()).toEqual([...CRITICAL].sort());
    // Severity and worth agree, so "one lapse is forgiven, but not this one" is
    // a rule rather than an accident of which events carry which numbers.
    expect(Math.min(...critical.map(event => event.points))).toBeGreaterThan(
      Math.max(...events.filter(event => event.severity !== 'critical').map(event => event.points))
    );
  });

  it('forgives one lapse and no more', () => {
    // Failing a decision costs its points twice: once unearned, once deducted.
    const cost = (points: number, severity: string | undefined) => {
      const weight = severity === 'critical' ? 2 : severity === 'major' ? 1.5 : 1;
      return points + Math.ceil(points * 0.5 * weight);
    };
    const costs = [...events, ...hotspots].map(item => cost(item.points, item.severity));
    const cheapest = Math.min(...costs);
    const dearest = Math.max(...costs);
    expect(total - cheapest, 'one small lapse should still scrape a pass').toBeGreaterThanOrEqual(
      level10.requiredScore
    );
    expect(total - dearest, 'and so should one bad one, once').toBeGreaterThanOrEqual(
      level10.requiredScore
    );
    expect(total - dearest * 2, 'two critical lapses should not').toBeLessThan(
      level10.requiredScore
    );
  });

  it('cannot be passed by clearing only the scenarios one habit answers', () => {
    // Arithmetic rather than a drive — `level10Drive.test.ts` does it for real,
    // through the session, and is the assertion that actually settles it.
    const cost = (id: string) => {
      const event = byId(id);
      const weight = event.severity === 'critical' ? 2 : event.severity === 'major' ? 1.5 : 1;
      return event.points + Math.ceil(event.points * 0.5 * weight);
    };
    // A driver who never steers never reaches the turnout, and one who answers
    // the phone with a brake loses that too.
    expect(
      total - cost('level10.out-of-her-seat') - cost('level10.the-phone-rings')
    ).toBeLessThan(level10.requiredScore);
    // A driver who never slows loses the smoke, the truck and the grade.
    expect(
      total -
        cost('level10.smoke-in-the-lane') -
        cost('level10.losing-its-load') -
        cost('level10.bus-on-the-grade')
    ).toBeLessThan(level10.requiredScore);
  });
});
