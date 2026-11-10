/**
 * What a scenario shows while it is presented, at a support level h.
 *
 * h is the output half of the machine's learned parameters: theta decides where
 * the approach opens, h decides what the machine shows once it has - in the
 * paused briefing and in the prompt beside the road after it. Every
 * screen that presents a scenario asks this one function, and so does the scene
 * builder for the road's own markers of a lane, so the briefing, the
 * road prompt, the lane strip and the road cannot disagree about how much of
 * the answer is on screen.
 *
 *   full  the situation, the move to make, the real-world note, the rule, and
 *         every marker of the response being graded
 *   cue   the situation, and where to look
 *   none  the situation alone
 *
 * The situation - the description, the plate, the scenario's name - is shown at
 * every level, because it is the question. Nothing here changes what is graded,
 * and nothing here is read after a decision: feedback is built from the event
 * alone and is the same at every level.
 */
import type { SupportLevel } from '@/domain/learner/competency';
import { assertNever } from '@/shared/lib/assertNever';
import type { LevelConfig, ScenarioEvent } from './scenarioDefinition';
import { speedTarget, speedTargetText } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import type { NpcVehicleSpec, RoadActorKind, PedestrianKind, RoadScene, ScenePrefab, SignPlate, MarkingPlate } from './scenarioScene';
import { scenarioInstruction } from './scenarioCopy';
import { UNITS_PER_METER } from '@/features/driving-sim/domain/world/routeGeometry';
import { CRAWL_SPEED_SHARE } from '@/features/driving-sim/domain/systems/standingPenalties';
import { englishText, type Localized, type TextOf } from '@/shared/lib/localized';

export interface ScenarioSupport {
  support: SupportLevel;
  /** What is happening. Every level. */
  situation: string;
  /** The sign the scenario stands beside, enlarged. Every level: it is the situation. */
  sign?: SignPlate;
  /** The one thing to do. Full only. */
  instruction: string | null;
  /**
   * Where to look, never what to do. Cue only, and null where the scenario
   * declares nothing to point at - there the cue level shows what none does.
   */
  cue: string | null;
  /** What a real vehicle would also need. Full only: it is part of the answer. */
  realWorldNote: string | null;
  /** The rule behind it. Full only: a rule names the response it requires. */
  lawCitation: string | null;
  /**
   * Whether the screen may mark the response being graded: the keys that
   * perform it, the lane it has to be made from, the lane and speed a merge
   * asks for, and live advice on how it is going. Full only.
   *
   * The road reads it too. The gantry over the lane a scenario grades, the path
   * a turn is drawn taking from its lane, the pavement arrow picked out in that
   * lane and a route gantry's YOUR LANE are markers of the response, so they
   * stand on the road only where this is true. Nothing solid depends on it.
   */
  showsResponse: boolean;
}

/**
 * Whether a support level shows the response, for every scenario alike.
 *
 * The one rule `showsResponse` reads. Exported for what the road shows that
 * belongs to no one scenario - a route's lane gantry - which asks it of the
 * level's h rather than of an event.
 */
export const showsResponseAt = (support: SupportLevel): boolean => support === 'full';

/**
 * `level` lets the instruction name the speed the scenario is graded on
 * (`speedTarget`). It is part of the response, so full alone shows it.
 */
export const scenarioSupport = (
  event: ScenarioEvent,
  support: SupportLevel,
  level?: LevelConfig,
  say: TextOf = englishText
): ScenarioSupport => {
  const full = support === 'full';
  return {
    support,
    situation: event.description,
    sign: event.sign,
    instruction: full ? withSpeedTarget(scenarioInstruction(event, say), event, level, say) : null,
    cue: support === 'cue' ? supportCue(event, say) : null,
    realWorldNote: full ? event.realWorldNote ?? null : null,
    lawCitation: full ? event.lawCitation ?? null : null,
    showsResponse: showsResponseAt(support),
  };
};

// --- The cue -----------------------------------------------------------------
//
// Built from what the scenario declares it puts on the road, and from which
// requirement it grades - never from `description`, `recommendedMove`, a hint,
// a label or an asset filename, and never from anything that says what the
// response is: `correctAction`, `avoid`, a lane or a direction, whether a bay
// may be stopped in, which way a speed rule runs, a gap's seconds or a merge's
// minimum speed. It names the thing to watch; the learner still has to know
// what it means.

/** `B. Warning Sign — Road Obstacle` → `Warning Sign — Road Obstacle`. */
const categoryName = (plate: SignPlate | MarkingPlate): string => plate.category.replace(/^[A-Z]\.\s*/, '');

const VEHICLE: Record<NpcVehicleSpec['vehicleKind'], Localized> = {
  car: { en: 'the car' },
  ambulance: { en: 'the ambulance' },
  jeepney: { en: 'the jeepney' },
  motorcycle: { en: 'the motorcycle' },
  truck: { en: 'the truck' },
  van: { en: 'the van' },
  bus: { en: 'the bus' },
  bicycle: { en: 'the cyclist' },
};

const npcPlace = (path: NpcVehicleSpec['path'], say: TextOf): string => {
  switch (path) {
    case 'crossing_from_left':
      return say({ en: 'coming from your left' });
    case 'crossing_from_right':
      return say({ en: 'coming from your right' });
    case 'oncoming_through':
    case 'oncoming_turning_left':
      return say({ en: 'coming the other way' });
    case 'closing_from_behind':
      return say({ en: 'behind you' });
    case 'roundabout_circulating':
      return say({ en: 'on the roundabout' });
    case 'travelling_ahead':
      return say({ en: 'ahead of you' });
    case 'merging_from_ramp':
      return say({ en: 'joining from the ramp' });
    case 'filtering_past':
      return say({ en: 'coming up beside you' });
    default:
      return assertNever(path, 'npcPlace');
  }
};

const ACTOR: Record<RoadActorKind, Localized> = {
  jeepney: { en: 'the jeepney' },
  van: { en: 'the van' },
  tricycle: { en: 'the tricycle' },
  motorcycle: { en: 'the motorcycle' },
  bicycle: { en: 'the cyclist' },
  truck: { en: 'the truck' },
  bus: { en: 'the bus' },
  smoke_belcher: { en: 'the smoking vehicle' },
  ambulance: { en: 'the ambulance' },
  broken_down: { en: 'the stopped vehicle' },
  crashed_car: { en: 'the crash' },
};

const PEDESTRIAN: Record<PedestrianKind, Localized> = {
  adult: { en: 'the person on foot' },
  child: { en: 'the child' },
  elderly: { en: 'the elderly pedestrian' },
  pwd: { en: 'the wheelchair user' },
};

const prefabPlace = (prefab: ScenePrefab, say: TextOf): string => {
  switch (prefab.kind) {
    case 'driveway_crossing':
      return say({ en: 'the footpath across the driveway' });
    case 'bend_warning':
      return say({ en: 'the bend ahead' });
    case 'unknown_hazard':
      return say({ en: 'the road ahead' });
    case 'lane_paint':
    case 'merge_arrows':
    case 'lane_arrow':
      return say({ en: 'the markings on the lanes' });
    case 'overtaking_oncoming':
    case 'oncoming_left_turn':
      return say({ en: 'the traffic coming the other way' });
    case 'give_way_junction':
    case 'cross_street':
    case 'main_road_junction':
      return say({ en: 'the junction ahead' });
    case 'no_entry_junction':
      return say({ en: 'the side street' });
    case 'roundabout':
      return say({ en: 'the roundabout' });
    case 'compliance':
      return say({ en: 'your vehicle' });
    case 'checkpoint_officer':
      return say({ en: 'the officer' });
    case 'road_crash':
      return say({ en: 'the crash ahead' });
    case 'fire_hydrant':
      return say({ en: 'the fire hydrant' });
    default:
      return assertNever(prefab, 'prefabPlace');
  }
};

const scenePlace = (scene: RoadScene, say: TextOf): string => {
  switch (scene) {
    case 'intersection':
    case 'side_road':
    case 'junction_t':
    case 'signal':
      return say({ en: 'the junction ahead' });
    case 'merge':
      return say({ en: 'the merging lanes' });
    case 'toll':
      return say({ en: 'the toll plaza' });
    case 'roundabout':
      return say({ en: 'the roundabout' });
    case 'bend':
      return say({ en: 'the bend ahead' });
    case 'narrows':
      return say({ en: 'where the road narrows' });
    case 'divided_start':
    case 'divided_end':
      return say({ en: 'the median' });
    case 'bridge':
      return say({ en: 'the bridge' });
    case 'two_way':
      return say({ en: 'the lane coming the other way' });
    case 'hump':
      return say({ en: 'the hump' });
    case 'uneven':
    case 'wet':
      return say({ en: 'the road surface' });
    case 'flood':
      return say({ en: 'the water on the road' });
    case 'gradient_up':
    case 'gradient_down':
      return say({ en: 'the slope' });
    case 'crosswalk':
      return say({ en: 'the crossing' });
    case 'animal':
      return say({ en: 'the animal on the road' });
    case 'rockfall':
      return say({ en: 'the rocks on the road' });
    case 'roadwork':
      return say({ en: 'the work zone' });
    case 'railway':
      return say({ en: 'the tracks' });
    case 'lay_by':
      return say({ en: 'the lay-by' });
    case 'open_road':
    case 'route':
      return say({ en: 'the road ahead' });
    default:
      return assertNever(scene, 'scenePlace');
  }
};

const effectPlace = (effect: NonNullable<ScenarioEvent['effect']>, say: TextOf): string => {
  if (effect.visibility !== undefined) return say({ en: 'how far ahead you can see' });
  if (effect.grip !== undefined || effect.jarringAbove !== undefined) return say({ en: 'the road surface' });
  if (effect.gradient !== undefined) return say({ en: 'the slope' });
  if (effect.curve !== undefined) return say({ en: 'the bend ahead' });
  if (effect.narrowsTo !== undefined) return say({ en: 'where the road narrows' });
  return say({ en: 'the road ahead' });
};

/** The one thing on the road the scenario is about, most specific declaration first. */
const watchTarget = (event: ScenarioEvent, say: TextOf): string | null => {
  if (event.inspection) return say(event.inspection.pullOver ? { en: 'the enforcer ahead' } : { en: 'the checkpoint ahead' });
  if (event.sign) {
    return say(event.sign.art === 'signal_head' ? { en: 'the traffic light' } : { en: `the sign (${categoryName(event.sign)})` });
  }
  if (event.marking) {
    const where = event.marking.side ? `the marking on the ${event.marking.side}` : 'the marking on the road';
    return say({ en: `${where} (${categoryName(event.marking)})` });
  }
  if (event.pedestrians?.length) {
    const kinds = new Set(event.pedestrians.map(person => person.kind));
    return say(kinds.size === 1 ? PEDESTRIAN[event.pedestrians[0].kind] : { en: 'the people on foot' });
  }
  if (event.actor) return say(ACTOR[event.actor.kind]);
  if (event.npc) return say({ en: `${say(VEHICLE[event.npc.vehicleKind])} ${npcPlace(event.npc.path, say)}` });
  if (event.scenePrefab) return prefabPlace(event.scenePrefab, say);
  if (event.scene) return scenePlace(event.scene, say);
  if (event.effect) return effectPlace(event.effect, say);
  return null;
};

/** What the graded requirement turns on, without saying what it requires. */
const checks = (event: ScenarioEvent, say: TextOf): string[] => {
  const found: string[] = [];
  if (event.merge) found.push(say({ en: 'the gap in the lane you are joining' }));
  else if (event.following) found.push(say({ en: 'the gap to the vehicle ahead' }));
  if (event.overtake) found.push(say({ en: 'the lane beside you' }));
  if (event.maneuver || event.requiredLane) found.push(say({ en: 'which lane you are in' }));
  if (event.lineHold) found.push(say({ en: 'your position in the lane' }));
  if (event.postedSpeed !== undefined || event.speedRule || event.coast || event.effect?.stuckThrottle) {
    found.push(say({ en: 'your speed' }));
  }
  // A marking already names the curb it is painted on.
  if (event.bay && !event.marking) found.push(say({ en: `the curb on the ${event.bay.side}` }));
  if (event.rear) found.push(say({ en: `${say(VEHICLE[event.rear.vehicleKind])} behind you` }));
  return found;
};

/**
 * Where to look, in one or two short sentences, or null when the scenario
 * declares nothing to point at.
 */
export const supportCue = (event: ScenarioEvent, say: TextOf = englishText): string | null => {
  const target = watchTarget(event, say);
  const also = checks(event, say);
  if (!target && also.length === 0) return null;
  return [target && say({ en: `Watch ${target}.` }), also.length > 0 && say({ en: `Check ${also.join(', and ')}.` })]
    .filter(Boolean)
    .join(' ');
};

const metreText = (m: number): string => (m < 10 ? `${Math.round(m * 10) / 10} m` : `${Math.round(m)} m`);

/** Metres from the road's own units, on the scale the car is drawn at (`UNITS_PER_METER`). */
const metres = (units: number): string => metreText(units / UNITS_PER_METER);

/**
 * Metres across the road from canvas pixels: the car is drawn half a pixel per
 * route unit, so its 4.5 m length is CAR_LENGTH / 2 pixels.
 */
const metresAcross = (px: number): string => metreText(px / (UNITS_PER_METER / 2));

/**
 * Every number this scenario is graded against, as short target sentences
 * (2026-11-10, the panel's review: a scenario that asked a driver to slow down
 * did not say by how much). Read from the same fields the grader reads, so the
 * figure shown is the figure graded. Empty where nothing numeric decides it (a
 * question, an inspection, a lane, a plain stop).
 */
export const scenarioTargets = (event: ScenarioEvent, level: LevelConfig, say: TextOf = englishText): string[] => {
  const out: string[] = [];
  const target = speedTarget(event, level);
  if (target) out.push(say({ en: `Target: ${speedTargetText(target, say)} by the time you reach it.` }));
  if (event.maneuver?.maxSpeed !== undefined) {
    out.push(say({ en: `Target: make the turn at ${Math.round(event.maneuver.maxSpeed)} km/h or less.` }));
  }
  if (event.following) {
    out.push(say({ en: `Target: at least ${event.following.seconds} seconds behind the vehicle ahead, the whole way through.` }));
  }
  if (event.lineHold) {
    const side = event.lineHold.toward ? ` toward the ${event.lineHold.toward}` : '';
    out.push(say({ en: `Target: drift no more than ${metresAcross(event.lineHold.maxDrift)} sideways${side} while it lasts.` }));
  }
  if (event.coast) {
    out.push(say({ en: `Target: no long brake above ${Math.round(event.coast.brakeBelow)} km/h (taps are fine); at or below it, brake to a stop.` }));
  }
  if (event.effect?.stuckThrottle) {
    out.push(say({ en: `Target: hold the brake until the speed is ${Math.round(level.speedLimit * CRAWL_SPEED_SHARE)} km/h or less.` }));
  }
  if (event.merge) {
    out.push(say({ en: `Target: at least ${Math.round(event.merge.minSpeed)} km/h, and at least ${event.merge.safeGapSeconds} seconds behind the car you join.` }));
  }
  if (event.overtake) {
    out.push(say({ en: `Target: be ${metres(event.overtake.clearBy)} past the vehicle before you move back.` }));
  }
  if (event.noStandingWithin !== undefined) {
    out.push(say({ en: `Target: do not come to rest within ${metres(event.noStandingWithin * UNITS_PER_METER)} of it.` }));
  }
  return out;
};

/** The instruction with every number it is graded on. */
const withSpeedTarget = (instruction: string, event: ScenarioEvent, level: LevelConfig | undefined, say: TextOf): string => {
  const targets = level ? scenarioTargets(event, level, say) : [];
  if (targets.length === 0) return instruction;
  const sentence = /[.!?]$/.test(instruction.trim()) ? instruction.trim() : `${instruction.trim()}.`;
  return [sentence, ...targets].join(' ');
};
