/**
 * What a scenario event puts on the road, named as a value.
 *
 * Read from what the event declares - `type`, `npc`, `scene`, `actor`,
 * `pedestrians`, `maneuver`, and `scenePrefab` where none of those say - and
 * returned as a plain discriminated union. `resolvedSceneNodes` turns the name
 * into placed objects; naming and placing are separate because what a scene
 * *is* is a fact about the scenario and where its parts stand is a fact about
 * the frame.
 *
 * Nothing here reads `description`. Changing the words on screen, or
 * translating them, must not change what is on the road - `sceneDeclaration.
 * test.ts` rewrites every description in the game and asserts it does not.
 */
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { ComplianceCheck, CrossingPedestrian, LanePaintKind, RoadActorSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';

export type { LanePaintKind };

/** The four instructional overlays only the tutorial level draws. */
export type TutorialCue = 'steer_left' | 'steer_right' | 'slow_down' | 'start_drive';

/**
 * One complete scene, named. Every variant carries exactly the data its own
 * world elements need and nothing else — a traffic signal has an aspect and no
 * pedestrians, a crossing has pedestrians and no aspect — so a combination the
 * renderer could not draw cannot be built in the first place.
 */
export type ResolvedScene =
  /** Signal head, with the junction the red one is always drawn at. */
  | { kind: 'traffic-signal'; aspect: 'red' | 'yellow' }
  /** Stop sign over a junction; a declared `npc` crosses it. */
  | { kind: 'stop-sign-junction' }
  /** Footpath running across the mouth of a driveway. */
  | { kind: 'driveway-crossing' }
  /** Zebra crossing on open road, with whoever is using it. */
  | { kind: 'open-road-crossing'; pedestrians: CrossingPedestrian[] }
  | { kind: 'tutorial-cue'; cue: TutorialCue }
  /** Chevrons and a Sharp Turn board on the approach to a bend. */
  | { kind: 'bend-warning' }
  /** A vehicle or animal standing in the carriageway. */
  | { kind: 'road-actor'; actor: RoadActorSpec }
  /** Nothing specific is known — the flashing warning glyph. */
  | { kind: 'generic-hazard' }
  | { kind: 'speed-limit-sign' }
  | { kind: 'lane-paint'; paint: LanePaintKind }
  | { kind: 'merge-arrows' }
  /** Oncoming vehicle plus the barrier line, for an overtaking judgment. */
  | { kind: 'overtaking-oncoming' }
  | { kind: 'roundabout' }
  /** A scripted NPC on one of its fixed paths. */
  | { kind: 'npc-crossing-junction' }
  | { kind: 'npc-side-road' }
  | { kind: 'npc-following' }
  /** A rider coming up the line between your lanes, level with you, then gone. */
  | { kind: 'npc-filtering' }
  /** A vehicle travelling ahead of you in a lane of your own carriageway. */
  | { kind: 'npc-lead-vehicle' }
  /** A vehicle coming down an entry ramp onto the road you are already on. */
  | { kind: 'npc-merging' }
  | { kind: 'npc-oncoming' }
  | { kind: 'npc-oncoming-turning' }
  | { kind: 'npc-ambulance' }
  /** A declared junction, optionally with a turn path drawn through it. */
  | { kind: 'junction' }
  | { kind: 'give-way-junction' }
  | { kind: 'no-entry-junction' }
  /** Oncoming traffic you must let through before turning across it. */
  | { kind: 'oncoming-left-turn' }
  | { kind: 'cross-street' }
  | { kind: 'lane-arrow'; direction: 'left' | 'right' }
  /** In-cabin compliance check: seatbelt, phone, child seat, paperwork. */
  | { kind: 'compliance-icon'; glyph: string; color: string }
  | { kind: 'checkpoint-officer' }
  | { kind: 'main-road-junction' }
  /**
   * A road crash that has already happened. One scene for the whole tableau —
   * the wreck, the vehicle in the water, the debris — because they are one
   * situation and only the wreck is solid. See `crashSceneNodes`.
   */
  | { kind: 'road-crash' }
  /** A fire hydrant at the right curb. Scenery: nothing in it is solid. */
  | { kind: 'fire-hydrant' }
  /** Event draws nothing on the carriageway itself. */
  | { kind: 'nothing' };

/** Scenes that are a junction, and so must be drawn as one rather than guessed at. */
const JUNCTION_SCENES = new Set(['intersection', 'side_road', 'junction_t']);

/** The glyph and colour each in-cabin check is shown as. */
const COMPLIANCE_GLYPHS: Record<ComplianceCheck, { glyph: string; color: string }> = {
  seatbelt: { glyph: '\u{1f512}', color: '#1d4ed8' },
  child_restraint: { glyph: '\u{1f9d2}', color: '#7c3aed' },
  phone: { glyph: '\u{1f4f1}', color: '#dc2626' },
  gear: { glyph: 'N', color: '#374151' },
  documents: { glyph: '\u{1f4c4}', color: '#b45309' },
  unknown: { glyph: '\u2753', color: '#4b5563' },
};

/** Who is on this crossing. A crossing that names nobody draws one adult. */
export const pedestriansFor = (event: ScenarioEvent): CrossingPedestrian[] =>
  event.pedestrians?.length ? event.pedestrians : [{ kind: 'adult', solid: true }];

/** The scene an event names outright, when its other fields do not say. */
const prefabScene = (event: ScenarioEvent): ResolvedScene | null => {
  const declaration = event.scenePrefab;
  if (!declaration) return null;

  switch (declaration.kind) {
    case 'driveway_crossing':
      return { kind: 'driveway-crossing' };
    case 'bend_warning':
      return { kind: 'bend-warning' };
    case 'unknown_hazard':
      return { kind: 'generic-hazard' };
    case 'lane_paint':
      return { kind: 'lane-paint', paint: declaration.paint };
    case 'merge_arrows':
      return { kind: 'merge-arrows' };
    case 'overtaking_oncoming':
      return { kind: 'overtaking-oncoming' };
    case 'give_way_junction':
      return { kind: 'give-way-junction' };
    case 'no_entry_junction':
      return { kind: 'no-entry-junction' };
    case 'roundabout':
      return { kind: 'roundabout' };
    case 'oncoming_left_turn':
      return { kind: 'oncoming-left-turn' };
    case 'cross_street':
      return { kind: 'cross-street' };
    case 'lane_arrow':
      return { kind: 'lane-arrow', direction: declaration.direction };
    case 'compliance':
      return { kind: 'compliance-icon', ...COMPLIANCE_GLYPHS[declaration.check] };
    case 'checkpoint_officer':
      return { kind: 'checkpoint-officer' };
    case 'main_road_junction':
      return { kind: 'main-road-junction' };
    case 'road_crash':
      return { kind: 'road-crash' };
    case 'fire_hydrant':
      return { kind: 'fire-hydrant' };
  }
};

/**
 * What this event puts on the road.
 *
 * Only reached for events that do not own their whole scene already —
 * checkpoints, markings, signed scenes and vehicle emergencies are dispatched
 * on their declared data before this is consulted, and are not modelled here.
 */
export const resolveScene = (
  event: ScenarioEvent,
  { isTutorialLevel }: { isTutorialLevel: boolean }
): ResolvedScene => {
  // The tutorial's instructional overlays replace whatever the event would
  // otherwise be, so they are settled before anything else it declares.
  if (isTutorialLevel && event.type === 'obstacle_ahead') {
    if (event.correctAction === 'turn_left') return { kind: 'tutorial-cue', cue: 'steer_left' };
    if (event.correctAction === 'turn_right') return { kind: 'tutorial-cue', cue: 'steer_right' };
    if (event.correctAction === 'brake') return { kind: 'tutorial-cue', cue: 'slow_down' };
  }

  const declared = prefabScene(event);
  if (declared) return declared;

  switch (event.type) {
    case 'red_light':
      return { kind: 'traffic-signal', aspect: 'red' };
    case 'yellow_light':
      return { kind: 'traffic-signal', aspect: 'yellow' };
    case 'stop_sign':
      return { kind: 'stop-sign-junction' };

    case 'pedestrian_crossing':
      // A driveway mouth has a footpath running across it rather than a zebra:
      // two genuinely different pieces of road, and an event that is one says
      // so with `scenePrefab`.
      return { kind: 'open-road-crossing', pedestrians: pedestriansFor(event) };

    case 'obstacle_ahead':
      // A vehicle travelling ahead of you is the hazard, when the scenario put
      // one there: it is traffic, not something parked in the road, and the two
      // are drawn and hit as different things.
      if (event.npc?.path === 'travelling_ahead') return { kind: 'npc-lead-vehicle' };
      if (event.actor) return { kind: 'road-actor', actor: event.actor };
      return { kind: 'generic-hazard' };

    case 'speed_limit':
      return isTutorialLevel && event.correctAction === 'accelerate'
        ? { kind: 'tutorial-cue', cue: 'start_drive' }
        : { kind: 'speed-limit-sign' };

    case 'road_marking':
      return { kind: 'lane-paint', paint: 'generic_lane' };

    case 'overtaking_zone':
      return { kind: 'overtaking-oncoming' };

    case 'scenario_trigger': {
      if (event.scene === 'roundabout') return { kind: 'roundabout' };
      switch (event.npc?.path) {
        case 'crossing_from_left':
        case 'crossing_from_right':
          // A vehicle joining from a driveway or side road is not a four-way
          // crossroads: it emerges from one arm. Drawn as a one-sided side
          // road so it reads as "something is pulling out", not "you are at a
          // full intersection".
          return event.scene === 'side_road' || event.scene === 'junction_t'
            ? { kind: 'npc-side-road' }
            : { kind: 'npc-crossing-junction' };
        case 'closing_from_behind':
          return { kind: 'npc-following' };
        case 'filtering_past':
          return { kind: 'npc-filtering' };
        case 'travelling_ahead':
          return { kind: 'npc-lead-vehicle' };
        case 'merging_from_ramp':
          return { kind: 'npc-merging' };
        case 'oncoming_through':
          return { kind: 'npc-oncoming' };
        case 'oncoming_turning_left':
          return { kind: 'npc-oncoming-turning' };
      }
      // A declared junction is drawn as one, before anything is guessed.
      if (JUNCTION_SCENES.has(event.scene ?? 'open_road') || event.maneuver) {
        return { kind: 'junction' };
      }
      return { kind: 'nothing' };
    }

    case 'emergency_vehicle': {
      if (event.npc?.path === 'closing_from_behind') return { kind: 'npc-ambulance' };
      // An emergency vehicle can also arrive across your path rather than
      // behind you, and the rule then is the same one read from the other
      // side: it goes first. Routed to the junction branch so it is drawn at a
      // junction with the siren visible.
      if (event.npc?.path === 'crossing_from_left' || event.npc?.path === 'crossing_from_right') {
        return { kind: 'npc-crossing-junction' };
      }
      if (event.actor) return { kind: 'road-actor', actor: event.actor };
      return { kind: 'road-actor', actor: { kind: 'ambulance' } };
    }

    default:
      return { kind: 'nothing' };
  }
};
