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
import type { ScenarioEvent } from './scenarioDefinition';
import type { NpcVehicleSpec, RoadActorKind, PedestrianKind, RoadScene, ScenePrefab, SignPlate, MarkingPlate } from './scenarioScene';
import { scenarioInstruction } from './scenarioCopy';

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

export const scenarioSupport = (event: ScenarioEvent, support: SupportLevel): ScenarioSupport => {
  const full = support === 'full';
  return {
    support,
    situation: event.description,
    sign: event.sign,
    instruction: full ? scenarioInstruction(event) : null,
    cue: support === 'cue' ? supportCue(event) : null,
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

const VEHICLE: Record<NpcVehicleSpec['vehicleKind'], string> = {
  car: 'the car',
  ambulance: 'the ambulance',
  jeepney: 'the jeepney',
  motorcycle: 'the motorcycle',
  truck: 'the truck',
  van: 'the van',
  bus: 'the bus',
  bicycle: 'the cyclist',
};

const npcPlace = (path: NpcVehicleSpec['path']): string => {
  switch (path) {
    case 'crossing_from_left':
      return 'coming from your left';
    case 'crossing_from_right':
      return 'coming from your right';
    case 'oncoming_through':
    case 'oncoming_turning_left':
      return 'coming the other way';
    case 'closing_from_behind':
      return 'behind you';
    case 'roundabout_circulating':
      return 'on the roundabout';
    case 'travelling_ahead':
      return 'ahead of you';
    case 'merging_from_ramp':
      return 'joining from the ramp';
    case 'filtering_past':
      return 'coming up beside you';
    default:
      return assertNever(path, 'npcPlace');
  }
};

const ACTOR: Record<RoadActorKind, string> = {
  jeepney: 'the jeepney',
  van: 'the van',
  tricycle: 'the tricycle',
  motorcycle: 'the motorcycle',
  bicycle: 'the cyclist',
  truck: 'the truck',
  bus: 'the bus',
  smoke_belcher: 'the smoking vehicle',
  ambulance: 'the ambulance',
  broken_down: 'the stopped vehicle',
  crashed_car: 'the crash',
};

const PEDESTRIAN: Record<PedestrianKind, string> = {
  adult: 'the person on foot',
  child: 'the child',
  elderly: 'the elderly pedestrian',
  pwd: 'the wheelchair user',
};

const prefabPlace = (prefab: ScenePrefab): string => {
  switch (prefab.kind) {
    case 'driveway_crossing':
      return 'the footpath across the driveway';
    case 'bend_warning':
      return 'the bend ahead';
    case 'unknown_hazard':
      return 'the road ahead';
    case 'lane_paint':
    case 'merge_arrows':
    case 'lane_arrow':
      return 'the markings on the lanes';
    case 'overtaking_oncoming':
    case 'oncoming_left_turn':
      return 'the traffic coming the other way';
    case 'give_way_junction':
    case 'cross_street':
    case 'main_road_junction':
      return 'the junction ahead';
    case 'no_entry_junction':
      return 'the side street';
    case 'roundabout':
      return 'the roundabout';
    case 'compliance':
      return 'your vehicle';
    case 'checkpoint_officer':
      return 'the officer';
    case 'road_crash':
      return 'the crash ahead';
    case 'fire_hydrant':
      return 'the fire hydrant';
    default:
      return assertNever(prefab, 'prefabPlace');
  }
};

const scenePlace = (scene: RoadScene): string => {
  switch (scene) {
    case 'intersection':
    case 'side_road':
    case 'junction_t':
    case 'signal':
      return 'the junction ahead';
    case 'merge':
      return 'the merging lanes';
    case 'toll':
      return 'the toll plaza';
    case 'roundabout':
      return 'the roundabout';
    case 'bend':
      return 'the bend ahead';
    case 'narrows':
      return 'where the road narrows';
    case 'divided_start':
    case 'divided_end':
      return 'the median';
    case 'bridge':
      return 'the bridge';
    case 'two_way':
      return 'the lane coming the other way';
    case 'hump':
      return 'the hump';
    case 'uneven':
    case 'wet':
      return 'the road surface';
    case 'flood':
      return 'the water on the road';
    case 'gradient_up':
    case 'gradient_down':
      return 'the slope';
    case 'crosswalk':
      return 'the crossing';
    case 'animal':
      return 'the animal on the road';
    case 'rockfall':
      return 'the rocks on the road';
    case 'roadwork':
      return 'the work zone';
    case 'railway':
      return 'the tracks';
    case 'lay_by':
      return 'the lay-by';
    case 'open_road':
    case 'route':
      return 'the road ahead';
    default:
      return assertNever(scene, 'scenePlace');
  }
};

const effectPlace = (effect: NonNullable<ScenarioEvent['effect']>): string => {
  if (effect.visibility !== undefined) return 'how far ahead you can see';
  if (effect.grip !== undefined || effect.jarringAbove !== undefined) return 'the road surface';
  if (effect.gradient !== undefined) return 'the slope';
  if (effect.curve !== undefined) return 'the bend ahead';
  if (effect.narrowsTo !== undefined) return 'where the road narrows';
  return 'the road ahead';
};

/** The one thing on the road the scenario is about, most specific declaration first. */
const watchTarget = (event: ScenarioEvent): string | null => {
  if (event.inspection) return event.inspection.pullOver ? 'the enforcer ahead' : 'the checkpoint ahead';
  if (event.sign) {
    return event.sign.art === 'signal_head' ? 'the traffic light' : `the sign (${categoryName(event.sign)})`;
  }
  if (event.marking) {
    const where = event.marking.side ? `the marking on the ${event.marking.side}` : 'the marking on the road';
    return `${where} (${categoryName(event.marking)})`;
  }
  if (event.pedestrians?.length) {
    const kinds = new Set(event.pedestrians.map(person => person.kind));
    return kinds.size === 1 ? PEDESTRIAN[event.pedestrians[0].kind] : 'the people on foot';
  }
  if (event.actor) return ACTOR[event.actor.kind];
  if (event.npc) return `${VEHICLE[event.npc.vehicleKind]} ${npcPlace(event.npc.path)}`;
  if (event.scenePrefab) return prefabPlace(event.scenePrefab);
  if (event.scene) return scenePlace(event.scene);
  if (event.effect) return effectPlace(event.effect);
  return null;
};

/** What the graded requirement turns on, without saying what it requires. */
const checks = (event: ScenarioEvent): string[] => {
  const found: string[] = [];
  if (event.merge) found.push('the gap in the lane you are joining');
  else if (event.following) found.push('the gap to the vehicle ahead');
  if (event.overtake) found.push('the lane beside you');
  if (event.maneuver || event.requiredLane) found.push('which lane you are in');
  if (event.lineHold) found.push('your position in the lane');
  if (event.postedSpeed !== undefined || event.speedRule || event.coast || event.effect?.stuckThrottle) {
    found.push('your speed');
  }
  // A marking already names the curb it is painted on.
  if (event.bay && !event.marking) found.push(`the curb on the ${event.bay.side}`);
  if (event.rear) found.push(`${VEHICLE[event.rear.vehicleKind]} behind you`);
  return found;
};

/**
 * Where to look, in one or two short sentences, or null when the scenario
 * declares nothing to point at.
 */
export const supportCue = (event: ScenarioEvent): string | null => {
  const target = watchTarget(event);
  const also = checks(event);
  if (!target && also.length === 0) return null;
  return [target && `Watch ${target}.`, also.length > 0 && `Check ${also.join(', and ')}.`]
    .filter(Boolean)
    .join(' ');
};
