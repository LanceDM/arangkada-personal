/**
 * Level 9, as a drive rather than a syllabus with a road attached.
 *
 * What replaced the old roster is one journey — home over the ridge in the tail
 * of a storm — and six scenarios that ask for six different things, with the
 * four decisions the law makes on foot moved to the crash the last of them
 * requires the driver to stop at.
 *
 * The version before this ran eight road events at a uniform spacing, one per
 * section of the module, wrapped in a four-point pre-drive stage and a
 * four-point crash stage: sixteen graded decisions, eleven of them multiple
 * choice, and three of the eight road events frozen into prompts. Eighty of its
 * three hundred and fifty points were scored before the car moved.
 *
 * So the assertions below are mostly about honesty: every scenario is answered
 * with the car unless it genuinely cannot be, every scenario says what it is
 * called and what the safe move is, every claim a scenario makes about the road
 * is backed by something declared on it, and no answer is scored right for
 * naming an act the driver did not perform.
 */
import { describe, expect, it } from 'vitest';
import { level9 } from './level9';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import { SLOWED_SHARE } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { scenarioInstruction, scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import {
  BAY_SPAN,
  BRAKE_FORCE,
  ROAD_CENTRE_X,
  isInBay,
  laneBounds,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { paceOf, unitsForSeconds } from '@/features/driving-sim/domain/world/DrivingPace';
import type { RoadTraffic } from '@/features/driving-sim/domain/systems/roadTraffic';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';

const events = level9.events;
const byId = (id: string) => events.find(event => event.id === id)!;
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
        unitsForSeconds(event.npc.entryHeadway ?? 2.5, level9.speedLimit, paceOf(level9)),
      speed: level9.speedLimit * (event.npc.speed?.cruise ?? 1),
      braking: false,
    });
  }
  return composeWorldFrame(
    {
      level: level9,
      distance,
      handled: new Set<number>(),
      curves: curvesForLevel(level9),
    },
    { playerLane: 2, traffic, now: () => FROZEN_NOW }
  ).nodes;
};

describe('what Level 9 no longer is', () => {
  it('has no pre-drive stage', () => {
    // A stage inspecting a stationary car scored eighty of three hundred and
    // fifty points before the wheels turned — and it condemned a bulging tire
    // in the bay on a route that then blew a different one on the road, which
    // teaches that the inspection is decorative.
    expect(level9.garage).toBeUndefined();
  });

  it('keeps none of the events it replaced, anywhere in the game', () => {
    const REMOVED = [
      'level9.tire-blowout-response',
      'level9.heavy-rain-visibility',
      'level9.flooded-road-crossing',
      'level9.wet-bend-skid',
      'level9.jammed-accelerator-pedal',
      'level9.brake-fade-descent',
      'level9.overheating-breakdown-stop',
      'level9.arrive-at-crash-scene',
    ];
    // Across the whole roster, not just this level: Level 12 borrows content by
    // id and the remediation pool lifts variants out of every level, so a stale
    // copy would keep a deleted scenario alive somewhere else.
    const survivors = LEVELS.flatMap(level => level.events)
      .map(event => event.id)
      .filter(id => REMOVED.includes(id));
    expect(survivors).toEqual([]);
  });

  it('freezes the simulation exactly once, and only where the car cannot answer', () => {
    // The blowout and the skid used to be frozen prompts too. A blowout is a
    // `CoastRequirement` now and the skid's surface is the flooded dip, so the
    // one that is left is the one whose correct sequence — pump, downshift,
    // horn, parking brake — has no key on this keyboard.
    const frozen = events.filter(event => event.cutscene);
    expect(frozen.map(event => event.id)).toEqual(['level9.brakes-gone']);
    expect(frozen[0].emergency).toBe('brake_loss');
  });
});

describe('Level 9 identifies every scenario it grades', () => {
  it('gives each one a stable, unique id', () => {
    const ids = events.map(event => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'level9.rain-closes-in',
      'level9.flooded-dip',
      'level9.throttle-sticks-open',
      'level9.tire-blowout',
      'level9.brakes-gone',
      'level9.crash-at-the-bottom',
    ]);
  });

  it('names each one in two to five words, on the road and on the verdict', () => {
    // `scenarioLabel` is what the road prompt, the read panel and the result
    // card all call this scenario. Derived from the id where a level has not
    // authored one, which is a worse name than the level can write.
    for (const event of events) {
      expect(event.label, `${event.id} has no label`).toBeTruthy();
      expect(words(scenarioLabel(event)), `${event.id} label`).toBeLessThanOrEqual(5);
      expect(words(scenarioLabel(event)), `${event.id} label`).toBeGreaterThanOrEqual(2);
    }
  });

  it('says what to do about each one the driver actually drives, in ten words', () => {
    // The frozen prompt is excluded because it is the one scenario that never
    // shows an instruction: it carries a question and three answers instead,
    // and the read panel it would appear in is suppressed for a cutscene.
    for (const event of events.filter(event => !event.cutscene)) {
      expect(event.recommendedMove, `${event.id} has no recommended move`).toBeTruthy();
      expect(words(scenarioInstruction(event)), `${event.id} move`).toBeLessThanOrEqual(10);
    }
  });
});

describe('Level 9 copy fits on the screen it is shown on', () => {
  it('sets each situation up in one or two sentences', () => {
    for (const event of events) {
      expect(words(event.description), `${event.id} description`).toBeLessThanOrEqual(35);
      expect(sentences(event.description), `${event.id} description`).toBeLessThanOrEqual(2);
    }
  });

  it('keeps the verdicts to two short sentences', () => {
    // The long-form rule lives behind the "Why this matters" disclosure on both
    // the read panel and the result card. A verdict the player reads while the
    // next scenario is announcing itself gets two sentences.
    for (const event of events) {
      expect(sentences(event.rewardMessage), `${event.id} reward`).toBeLessThanOrEqual(2);
      expect(sentences(event.penaltyMessage), `${event.id} penalty`).toBeLessThanOrEqual(2);
      expect(words(event.rewardMessage), `${event.id} reward`).toBeLessThanOrEqual(30);
      expect(words(event.penaltyMessage), `${event.id} penalty`).toBeLessThanOrEqual(30);
    }
  });

  it('asks and answers the frozen prompt briefly', () => {
    const frozen = byId('level9.brakes-gone');
    expect(words(frozen.question!)).toBeLessThanOrEqual(18);
    for (const choice of frozen.choices!) {
      expect(words(choice.label), choice.label).toBeLessThanOrEqual(18);
    }
  });

  it('keeps the crash scene to four short decisions', () => {
    const hotspots = level9.aftermath!.hotspots;
    expect(hotspots.map(spot => spot.id)).toEqual([
      'burning-vehicle',
      'vehicle-in-water',
      'casualties',
      'report-and-document',
    ]);
    for (const spot of hotspots) {
      expect(words(spot.observation), `${spot.id} observation`).toBeLessThanOrEqual(28);
      expect(words(spot.question), `${spot.id} question`).toBeLessThanOrEqual(18);
      expect(sentences(spot.rewardMessage), `${spot.id} reward`).toBeLessThanOrEqual(2);
      expect(sentences(spot.penaltyMessage), `${spot.id} penalty`).toBeLessThanOrEqual(2);
      for (const choice of spot.choices) {
        expect(words(choice.label), choice.label).toBeLessThanOrEqual(18);
      }
    }
  });
});

describe('Level 9 is written in American English', () => {
  /**
   * The roster-wide check in `playerCopy.test.ts` catches the words that were
   * once in this level. These are the rest of the list this level was rewritten
   * against, asserted here rather than there because several other levels still
   * carry them in their legal citations and fixing those is a separate change.
   */
  const BRITISH = /\b(tyres?|kerbs?|licences?|manoeuvres?|centres?|windscreens?|penalised|aluminium|behaviours?|metres?)\b/i;

  const everyString = (): Array<{ where: string; text: string }> => {
    const all: Array<{ where: string; text: string }> = [];
    const push = (where: string, text?: string) => {
      if (text) all.push({ where, text });
    };
    for (const event of events) {
      push(`${event.id} description`, event.description);
      push(`${event.id} label`, event.label);
      push(`${event.id} move`, event.recommendedMove);
      push(`${event.id} reward`, event.rewardMessage);
      push(`${event.id} penalty`, event.penaltyMessage);
      push(`${event.id} law`, event.lawCitation);
      push(`${event.id} question`, event.question);
      push(`${event.id} braked`, event.coast?.brakedMessage);
      push(`${event.id} coastHint`, event.coast?.hint);
      push(`${event.id} bayHint`, event.bay?.hint);
      push(`${event.id} sign`, event.sign?.name);
      push(`${event.id} signMeaning`, event.sign?.meaning);
      event.choices?.forEach((choice, i) => push(`${event.id} choice${i}`, choice.label));
    }
    push('aftermath intro', level9.aftermath!.intro);
    for (const spot of level9.aftermath!.hotspots) {
      push(`${spot.id} label`, spot.label);
      push(`${spot.id} area`, spot.area);
      push(`${spot.id} observation`, spot.observation);
      push(`${spot.id} question`, spot.question);
      push(`${spot.id} reward`, spot.rewardMessage);
      push(`${spot.id} penalty`, spot.penaltyMessage);
      push(`${spot.id} law`, spot.lawCitation);
      spot.choices.forEach((choice, i) => push(`${spot.id} choice${i}`, choice.label));
    }
    return all;
  };

  it('covers every string the level can show, so the check below bites', () => {
    expect(everyString().length).toBeGreaterThan(70);
  });

  it('spells tire, curb, license, maneuver and center the American way', () => {
    const offenders = everyString()
      .filter(({ text }) => BRITISH.test(text))
      .map(({ where, text }) => `${where}: ${text.slice(0, 80)}`);
    expect(offenders).toEqual([]);
  });

  it('never writes the score into a sentence', () => {
    // The HUD and the result card both say what the score did; a sentence that
    // says it too is a third copy nothing keeps in step.
    const priced = everyString()
      .filter(({ text }) => /[-+−]\s*\d+\s*points/i.test(text))
      .map(({ where }) => where);
    expect(priced).toEqual([]);
  });
});

describe('Level 9 gives the emergency number in force', () => {
  // RO101 prints PNP 117. Executive Order No. 56, s. 2018 made Emergency 911 the
  // national emergency hotline in its place; the Red Cross stays on 143.
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(strings)
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(strings)
          : [];

  it('sends the driver to 911, or the Red Cross on 143, for the casualty', () => {
    const spot = level9.aftermath!.hotspots.find(hotspot => hotspot.id === 'casualties')!;
    const right = spot.choices.find(choice => choice.action === spot.correctAction)!;
    expect(right.label).toMatch(/\b911\b/);
    expect(spot.lawCitation).toMatch(/\b911\b/);
    expect(spot.lawCitation).toMatch(/\b143\b/);
  });

  it('prints 117 nowhere, the lesson included', () => {
    const printed = [...strings(level9), ...strings(getLevelModule(9))].filter(text => /\b117\b/.test(text));
    expect(printed).toEqual([]);
  });
});

describe('a Level 9 answer is scored for the act it names', () => {
  it('never lets a wrong answer satisfy the right one', () => {
    // The rule engine treats a full stop as satisfying a request to slow down,
    // which is correct on the road and a trap in a prompt: the brake failure's
    // "switch the engine off" answer was written as `stop` against a `brake`
    // answer, and scored correct. Swept over every multiple-choice answer in
    // the game, because the trap is not specific to this level.
    const offenders: string[] = [];
    const check = (id: string, correctAction: string, choices: Array<{ label: string; action: string }>) => {
      for (const choice of choices) {
        if (choice.action === correctAction) continue;
        const stub = { type: 'scenario_trigger', correctAction, points: 1 } as ScenarioEvent;
        if (evaluateWeightedRule(stub, choice.action, 0).isCorrect) {
          offenders.push(`${id}: "${choice.label}" (${choice.action}) scores as ${correctAction}`);
        }
      }
    };
    for (const level of LEVELS) {
      for (const event of level.events) {
        if (event.choices) check(event.id, event.correctAction, event.choices);
      }
      for (const spot of [...(level.garage?.hotspots ?? []), ...(level.aftermath?.hotspots ?? [])]) {
        check(`L${level.id} ${spot.id}`, spot.correctAction, spot.choices);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('offers exactly one right answer at every point that offers any', () => {
    const multipleChoice = [
      ...events.filter(event => event.choices).map(event => ({
        id: event.id,
        correctAction: event.correctAction,
        choices: event.choices!,
      })),
      ...level9.aftermath!.hotspots,
    ];
    expect(multipleChoice).not.toHaveLength(0);
    for (const point of multipleChoice) {
      const right = point.choices.filter(choice => choice.action === point.correctAction);
      expect(right, `${point.id}`).toHaveLength(1);
      expect(new Set(point.choices.map(choice => choice.action)).size).toBe(point.choices.length);
    }
  });
});

describe('the Level 9 road says what the scenarios say', () => {
  it('puts the flooded dip and its board on the road, and nothing it did not declare', () => {
    const flood = byId('level9.flooded-dip');
    const kinds = sceneAt(flood, 60).map(node => node.kind);
    expect(kinds).toContain('road-situation');
    expect(kinds).toContain('sign');
    expect(flood.scene).toBe('flood');
    expect(flood.sign?.name).toBe('Flood-Prone Area');
  });

  it('draws nothing at all for the rain, which is the point of it', () => {
    // A visibility event composes an empty scene deliberately: the veil is
    // painted over the finished frame, and a prop standing in it would put a
    // known obstacle where the lesson is that you cannot tell whether there is
    // one. So the scenario may claim nothing standing on the road — and it
    // does not.
    const rain = byId('level9.rain-closes-in');
    expect(rain.effect?.visibility).toBeLessThan(0.5);
    expect(rain.actor).toBeUndefined();
    expect(rain.npc).toBeUndefined();
    expect(rain.pedestrians).toBeUndefined();
  });

  it('puts something solid in front of the stuck throttle and the crash', () => {
    for (const id of ['level9.throttle-sticks-open', 'level9.crash-at-the-bottom']) {
      const bodies = sceneAt(byId(id), 60).flatMap(node => node.solids ?? []);
      expect(bodies.some(body => body.kind === 'vehicle'), id).toBe(true);
    }
  });

  it('never throws a correctly driven car off its line', () => {
    // `jarringAbove` is a physical punishment for carrying speed, and it moves
    // the car sideways. It must sit above the speed the level already calls
    // slowed, so every driver the road throws is a driver the grading was
    // going to fail anyway — never the other way round.
    const slowed = level9.speedLimit * SLOWED_SHARE;
    for (const event of events) {
      const jarring = event.effect?.jarringAbove;
      if (jarring === undefined) continue;
      expect(jarring, `${event.id} jars a driver who obeyed it`).toBeGreaterThanOrEqual(slowed);
    }
  });
});

describe('every Level 9 scenario is measurable by the controls it has', () => {
  it('gives the blowout enough road to be eased down and pulled off in', () => {
    const blowout = byId('level9.tire-blowout');
    const coast = blowout.coast!;
    // The brake becomes free to hold at the speed the game already calls
    // slowed, so the two definitions cannot drift apart.
    expect(coast.brakeBelow).toBe(level9.speedLimit * SLOWED_SHARE);
    // And the allowance is a real allowance: comfortably longer than a firm tap
    // of the key, and comfortably shorter than dragging the car down from the
    // limit in one application at the grip this scenario declares.
    const perFrame = BRAKE_FORCE * blowout.effect!.grip!;
    const framesToSlam = (level9.speedLimit - coast.brakeBelow) / perFrame;
    expect(coast.maxHeldFrames).toBeGreaterThan(10);
    expect(coast.maxHeldFrames).toBeLessThan(framesToSlam / 2);
    // The low grip has to cover the whole approach, or the braking happens on
    // road that still grips and the allowance means nothing.
    expect(blowout.effect!.span).toBeGreaterThanOrEqual(warnings.get(blowout.triggerAtDistance)!);
  });

  it('opens the bay wide enough for the wheel to reach it', () => {
    // The bay is off the carriageway, and `isInBay` is the whole grade here.
    // It is reachable only because the wheel is clamped to the widened bounds
    // rather than to the road's — see `driveVehicle`.
    const bay = byId('level9.tire-blowout').bay!;
    expect(bay.side).toBe('right');
    expect(bay.mayStop).toBe(true);
    const open = laneBounds(ROAD_CENTRE_X).max + 40;
    expect(isInBay(open, ROAD_CENTRE_X, 'right')).toBe(true);
    // And the driver has to still be rolling when it opens, which is what the
    // warning distance buys them.
    expect(warnings.get(byId('level9.tire-blowout').triggerAtDistance)!).toBeGreaterThan(BAY_SPAN * 4);
  });

  it('gives the crash a stopping distance rather than a reading distance', () => {
    const crash = byId('level9.crash-at-the-bottom');
    expect(crash.correctAction).toBe('stop');
    expect(warnings.get(crash.triggerAtDistance)!).toBeGreaterThanOrEqual(400);
  });
});

describe('Level 9 scores the mission it now is', () => {
  it('is worth the road plus the crash scene, and nothing before the wheels turn', () => {
    const road = events.reduce((sum, event) => sum + event.points, 0);
    const scene = level9.aftermath!.hotspots.reduce((sum, spot) => sum + spot.points, 0);
    expect(road).toBe(190);
    expect(scene).toBe(80);
    expect(level9.requiredScore).toBe(Math.round((road + scene) * 0.69));
  });

  it('keeps its star bands in order and inside the total', () => {
    const total =
      events.reduce((sum, event) => sum + event.points, 0) +
      level9.aftermath!.hotspots.reduce((sum, spot) => sum + spot.points, 0);
    expect(level9.requiredScore).toBeLessThan(level9.stars2);
    expect(level9.stars2).toBeLessThan(level9.stars3);
    expect(level9.stars3).toBeLessThanOrEqual(total);
  });

  it('leaves room past the last scenario for its window to close', () => {
    const last = Math.max(...events.map(event => event.triggerAtDistance));
    expect(level9.roadLength - last).toBeGreaterThan(400);
  });
});
