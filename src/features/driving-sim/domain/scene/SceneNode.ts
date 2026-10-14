/**
 * The things standing on the road this frame, described semantically.
 *
 * A scene node says *what* is there and *where* — a cone at this point, a
 * crossing across this row, a jeepney at this pose. It never says how to paint
 * one. No `CanvasRenderingContext2D`, no React, no Firestore: a node is data,
 * so the same list feeds the canvas renderer, the collision pass and a test.
 *
 * Nodes are emitted in painter order, farthest scene first, and each scene's
 * parts in the order they overlay each other. `renderScene` paints that order
 * and `SceneFrame.colliders` reports solids in it, which is why the first body
 * a collision test overlaps is also the nearest thing drawn.
 */
import type { LaneRequirement, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type {
  CrossingPedestrian,
  NpcVehicleSpec,
  PedestrianKind,
  PullOverBay,
  RoadActorSpec,
  SignPlate,
} from '@/features/driving-sim/domain/scenario/scenarioScene';
import type { LanePaintKind } from '@/features/driving-sim/domain/scene/ResolvedScene';
import type { MainRoadTraffic, Point } from '@/features/driving-sim/domain/world/sceneGeometry';
import type { IntersectionGeometry } from '@/features/driving-sim/domain/world/junctionGeometry';
import type { NpcTransform } from '@/features/driving-sim/domain/systems/updateNpcVehicles';
import type { WorldBody } from '@/features/driving-sim/domain/world/WorldBody';
import type { LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';

/** How a scripted vehicle is moving, which is what decides how it is drawn. */
export type ScriptedVehicleRole =
  | 'crossing'
  | 'circulating'
  | 'following'
  | 'oncoming'
  | 'oncoming-turning'
  | 'ambulance'
  | 'joining'
  /** Coming up the line between your lanes, upright and travelling your way. */
  | 'filtering'
  /** Travelling ahead of you in one of your own lanes, drawn from behind. */
  | 'leading'
  /** Coming down an entry ramp and turning onto your carriageway. */
  | 'merging';

/** How a stroke of paint is laid down. Mirrors the road's own paint vocabulary. */
export interface PaintStroke {
  color: string;
  width?: number;
  dash?: [number, number];
}

/**
 * Paint on the carriageway, and the road furniture that is painted rather than
 * built. Each variant carries only what that mark needs to be placed.
 *
 * `along` and `hatch` sample the road across a span of rows so the paint
 * follows a bend; they carry the span, and the frame carries the road's shape.
 */
export type RoadMarking =
  | { mark: 'along'; topY: number; bottomY: number; offset: number; stroke: PaintStroke }
  | { mark: 'across'; y: number; roadX: number; stroke: PaintStroke }
  | { mark: 'hatch-wedge'; topY: number; bottomY: number; side: 'left' | 'right' }
  | { mark: 'island-approach'; screenY: number; oncomingLanes: number }
  /**
   * The gantry over the lane a scenario grades, that lane picked out. A marker
   * of the response, composed only where the support level shows it
   * (`scenarioSupport`), and carrying the lane already resolved so the drawing
   * reads no requirement of its own.
   */
  | { mark: 'turn-lane'; screenY: number; lane: LaneIndex }
  | {
      mark: 'chevron-island';
      topY: number;
      bottomY: number;
      oncomingLanes: number;
      lane?: LaneRequirement['lane'];
    }
  | { mark: 'parking-bay'; roadX: number; screenY: number }
  | { mark: 'pull-over-bay'; roadX: number; screenY: number; bay: PullOverBay }
  | { mark: 'painted-curb'; roadX: number; screenY: number; color: string }
  | { mark: 'rumble-strips'; topY: number; bottomY: number }
  | { mark: 'railway-pavement'; roadX: number; screenY: number }
  | {
      mark: 'lane-arrow';
      x: number;
      y: number;
      direction: 'up' | 'left' | 'right' | 'down';
      color: string;
      /** Present only when the arrow is drawn scaled about its own centre. */
      scale?: number;
    }
  | { mark: 'legend'; x: number; y: number; text: string; size: number }
  | {
      /** The dashed curve carrying a turning vehicle through a junction. */
      mark: 'turn-path';
      from: { x: number; y: number };
      control: { x: number; y: number };
      to: { x: number; y: number };
    };

/**
 * How traffic at a junction is controlled.
 *
 * One value rather than a pair of booleans: a junction is controlled one way,
 * and a stop line painted over a give-way line is not a road anyone builds. As
 * two booleans the contradiction was constructable, and the renderer settled it
 * by preferring the stop line - drawing something nobody asked for.
 */
export type JunctionControl = 'none' | 'stop' | 'give-way';

/**
 * The guide a committed turn follows through a junction.
 *
 * It starts in the lane the turn is graded from, so it is a marker of the
 * response and is composed only where the support level shows one.
 */
export interface JunctionTurnPath {
  geometry: IntersectionGeometry;
  direction: 'left' | 'right';
  /** The lane the turn is taken from, already resolved against the road. */
  lane: LaneIndex;
}

/**
 * How much of a junction is built, and what is painted into it.
 *
 * The one junction the game has. A crossroads, a side road, a controlled
 * junction and a turn are all this shape configured differently, so a level
 * places an instance rather than implementing a junction of its own. Build one
 * with `junctionNode` — see `prefabs.ts`.
 */
export interface JunctionShape {
  roadX: number;
  screenY: number;
  /** Which side a side street reaches out to; absent means a full crossroads. */
  side?: 'left' | 'right';
  control: JunctionControl;
  crossTraffic: boolean;
  crosswalk: boolean;
  /** Present while a turn is being guided through this junction. */
  turnPath?: JunctionTurnPath;
}

/**
 * What is behind the driver, as the scenario declared it.
 *
 * Carried on the node because the mirror is a second picture of a vehicle the
 * road is already drawing, and two pictures resolved separately are two
 * pictures that can disagree. Before this the node carried a position and
 * nothing else, so the glass had no way to know what was in it and drew one
 * generic white vehicle with a red stripe for everything — which is how a
 * scenario that declared a motorcycle showed what looked like an ambulance.
 *
 * `kind` is the scenario's own `vehicleKind`, never a label, a description or
 * an event id. The emergency treatment follows from it rather than being
 * passed alongside it, so it cannot be given to something that is not an
 * emergency vehicle.
 */
export interface MirrorVehicle {
  kind: NpcVehicleSpec['vehicleKind'];
  /** Its own paint, where the scenario named one. */
  color?: string;
}

/**
 * A stretch of road in a particular condition or shape — the thing a warning
 * sign is warning about. Each variant carries only what placing it needs.
 */
export type RoadSituation =
  | { situation: 'bend'; screenY: number }
  | { situation: 'roadwork'; roadX: number; screenY: number }
  | { situation: 'railway'; roadX: number; screenY: number }
  | { situation: 't-junction'; roadX: number; screenY: number }
  | { situation: 'merge'; roadX: number; screenY: number }
  | { situation: 'hump'; roadX: number; screenY: number }
  | { situation: 'uneven'; roadX: number; screenY: number }
  | { situation: 'wet'; roadX: number; screenY: number }
  | { situation: 'flood'; screenY: number }
  | { situation: 'gradient'; roadX: number; screenY: number; slope: 'up' | 'down' }
  | { situation: 'narrows'; roadX: number; screenY: number }
  | { situation: 'median'; roadX: number; screenY: number; phase: 'start' | 'end' }
  | { situation: 'bridge'; roadX: number; screenY: number }
  | { situation: 'two-way'; roadX: number; screenY: number }
  | { situation: 'animal'; x: number; y: number }
  | { situation: 'rockfall'; roadX: number; screenY: number }
  /**
   * The setting a road crash sits in: debris across the asphalt, and the
   * vehicle that left the road lying in the water beside it.
   *
   * Scenery, and carries nothing solid. The wreck the driver can actually hit
   * is a `road-actor` composed alongside this by the same prefab, so what can
   * be seen and what can be struck come from one declaration.
   */
  | { situation: 'crash-scene'; roadX: number; screenY: number };

/**
 * Things planted on or beside the road: signs, cones, and the two glyphs that
 * stand in for a decision made inside the cabin.
 */
export type RoadFurniture =
  | { furniture: 'stop-sign'; x: number; y: number }
  | { furniture: 'yield-sign'; x: number; y: number }
  | { furniture: 'no-entry-sign'; x: number; y: number }
  | { furniture: 'warning-sign'; x: number; y: number; legend?: string }
  | { furniture: 'speed-limit'; x: number; y: number; limit: number }
  | { furniture: 'roadside-sign'; x: number; y: number; top: string; bottom: string; color: string }
  | { furniture: 'chevron'; x: number; y: number }
  | { furniture: 'traffic-cone'; x: number; y: number; scale: number }
  | { furniture: 'fire-hydrant'; x: number; y: number }
  | { furniture: 'compliance-icon'; x: number; y: number; glyph: string; color: string }
  | { furniture: 'checkpoint-officer'; x: number; y: number; scale: number };

/**
 * One panel on an overhead gantry: which lane it hangs over, what it numbers
 * that lane, and what the lane is for.
 */
export interface GantryPanel {
  lane: LaneIndex;
  /** The lane's number, as the expressway lane table numbers it. */
  top: string;
  /** What that lane is for, in two or three words. */
  bottom: string;
  /**
   * What the panel is saying, which decides both its colour and its badge.
   *
   * Three meanings, kept apart because one colour cannot carry two of them:
   * `target` is the lane this vehicle belongs in (green, the colour the rest of
   * the game uses for the right answer), `restricted` is a lane it may use only
   * for something (amber, caution), and `lane` is neither. `exit` is an exit
   * board rather than a lane assignment.
   *
   * A board that picked the overtaking lane out in the same blue the HUD uses
   * for "you are here" was read as a recommendation to sit in it — the single
   * lane this level marks a cruising car down for.
   */
  tone: 'lane' | 'target' | 'restricted' | 'exit';
  /**
   * A short word across the top of the panel, so the meaning survives without
   * colour: "YOUR LANE" on the target, "ONLY" on a restriction. Colour alone
   * fails a colour-blind reader and a washed-out screen equally.
   */
  badge?: string;
}

/** The failures a scenario can inflict on the driver's own vehicle. */
export type VehicleFailure = 'blowout' | 'skid' | 'brake_loss' | 'jammed_pedal';

/** A vehicle drawn at rest, as part of a scene rather than as a scripted actor. */
export type StaticVehicle =
  | 'jeepney'
  | 'oncoming'
  | 'crossing-car';

/**
 * What a node is, before its solidity. Split out so `SceneNode` can attach
 * `solids` to every variant without repeating the field thirteen times;
 * narrowing on `kind` still works through the intersection.
 */
type SceneNodeShape =
  | { kind: 'road-marking'; marking: RoadMarking }
  | { kind: 'junction'; shape: JunctionShape }
  /**
   * A crossing, split on how it is controlled because the two carry different
   * people: a regular crossing has someone waiting at the curb, a signalised
   * one has someone already walking across it on a green man.
   */
  | {
      kind: 'crossing';
      style: 'regular';
      roadX: number;
      screenY: number;
      cleared: boolean;
      /** Who is waiting. Nobody named means an adult. */
      pedestrian?: PedestrianKind;
    }
  | {
      kind: 'crossing';
      style: 'signalized';
      roadX: number;
      screenY: number;
      /** Turns the signal head green; the walker has stepped off by then. */
      cleared: boolean;
      /**
       * Where the walker is on the stripes this frame, or null once the
       * crossing is cleared.
       *
       * Posed by the world against the frame's own clock, and drawn from this
       * point and no other. The body in `solids` is built from the same point,
       * so the sprite and the thing you can hit are one position rather than
       * two reads of a clock that moves between them.
       */
      walker: Point | null;
    }
  /** People the scenario declares are standing on a crossing. */
  | { kind: 'pedestrian-group'; roadX: number; y: number; people: CrossingPedestrian[] }
  /** A sign plate on the verge, already placed beside the thing it governs. */
  | { kind: 'sign'; x: number; y: number; plate: SignPlate; cleared: boolean }
  | { kind: 'road-situation'; situation: RoadSituation }
  /**
   * An LTO checkpoint: the whole roadside scene plus its floating label. It is
   * suppressed once the stop has been made, and while the scene is at the very
   * top or bottom of the frame.
   */
  | { kind: 'checkpoint'; roadX: number; screenY: number; label: string | null }
  /**
   * An enforcer at the right curb flagging the car down (`inspection.pullOver`):
   * a traffic stop, not a checkpoint, so no barrier across the road and no
   * label on it. Nothing in it is solid; it is passed or pulled over beside.
   */
  | { kind: 'traffic-stop'; roadX: number; screenY: number }
  /**
   * What a failure of the driver's own vehicle leaves on the carriageway.
   *
   * Deliberately never solid: this is the cause of the emergency, not an
   * obstacle to avoid, and made solid it would end the run on contact instead
   * of opening the emergency it exists to cause.
   */
  | { kind: 'vehicle-failure'; failure: VehicleFailure; roadX: number; screenY: number }
  | { kind: 'traffic-signal'; x: number; y: number; aspect: 'red' | 'yellow'; mast: boolean }
  | { kind: 'road-furniture'; furniture: RoadFurniture }
  /** The zebra band with dropped curbs that every crossing in the game uses. */
  | { kind: 'crossing-approach'; roadX: number; y: number; height: number }
  /** A footpath across a driveway mouth, with whoever is still on it. */
  | { kind: 'driveway-mouth'; roadX: number; screenY: number; walkedOff: number }
  /** A vehicle or animal standing in the carriageway. */
  | { kind: 'road-actor'; actor: RoadActorSpec; x: number; y: number }
  /** The flashing "something is there" glyph, when nothing more specific is known. */
  | { kind: 'hazard-glyph'; x: number; y: number; alpha: number }
  | { kind: 'lane-paint'; roadX: number; screenY: number; paint: LanePaintKind }
  | { kind: 'merge-arrows'; roadX: number; screenY: number }
  /**
   * A sign gantry over the carriageway, with one panel per lane.
   *
   * The only way a lane rule can be read from the road rather than from a
   * sentence: a driver cannot be asked to keep out of Lane 1 unless the road
   * says which lane that is and what it is for.
   */
  | { kind: 'overhead-gantry'; roadX: number; screenY: number; panels: GantryPanel[] }
  /**
   * The painted nose an exit leaves through, and the chevrons inside it.
   *
   * Placed by the route rather than by the event graded at it: the nose is part
   * of the road, and it is there whether or not anybody is being marked on
   * taking the exit.
   */
  | { kind: 'exit-gore'; roadX: number; screenY: number; exitLane: LaneIndex }
  /**
   * The nose dividing an auxiliary lane from the through lanes while the two
   * are still separate roads.
   *
   * Carries its own solid, because the thing that stops the wheel crossing it
   * and the thing the driver can see are required to be one object: a slip road
   * that looks divided and steers as though it is not is the defect this node
   * exists to make impossible.
   */
  | {
      kind: 'lane-separator';
      roadX: number;
      screenY: number;
      /** Offset of the nose's centre from the carriageway's left edge. */
      offsetX: number;
      width: number;
      separator: 'island' | 'gore';
    }
  /**
   * The arrows and legend where an auxiliary lane runs out.
   *
   * `width` is the lane's own width here, taken from the route, so the arrows
   * point across exactly the tarmac that is closing.
   */
  | { kind: 'merge-taper'; roadX: number; screenY: number; width: number }
  /**
   * A row of toll gates across the road, one of them open.
   *
   * Its solids are the barriers across the closed gates, built from the same
   * geometry the plaza is drawn from — so the Red X and the thing that stops
   * you are one decision.
   */
  | { kind: 'toll-plaza'; roadX: number; screenY: number; openLane: LaneIndex }
  /** The barrier line under an overtaking judgment. */
  | { kind: 'overtaking-barrier'; roadX: number; screenY: number }
  | { kind: 'roundabout'; roadX: number; screenY: number }
  | { kind: 'cross-street'; screenY: number }
  | {
      kind: 'main-road-junction';
      roadX: number;
      screenY: number;
      /**
       * The wave crossing your path this frame, posed once by the world. The
       * renderer draws these exact vehicles and reads `clear` for its banner;
       * the bodies in `solids` are built from the same ones. Yielding is
       * already folded in — a driver who has given way sees a clear junction.
       */
      traffic: MainRoadTraffic;
    }
  /**
   * The mirror and the glow while an emergency vehicle is still behind you.
   * Without them the approach happens off the bottom of the board, so the first
   * the player knows of it is when it is already alongside — which is not a
   * right-of-way decision, it is a reaction test with the cue removed.
   */
  | { kind: 'siren-alert'; roadX: number; npcX: number; proximity: number; vehicle: MirrorVehicle }
  /**
   * The mirror, with an ordinary vehicle in it.
   *
   * The same glass the siren alert uses, without the emergency treatment. It
   * exists because a scenario about something *behind* the driver is otherwise
   * only legible for the last car-length of its approach — the board shows a
   * hundred and fifty pixels of road behind the car and nothing beyond that.
   */
  | { kind: 'rear-view'; roadX: number; npcX: number; proximity: number; vehicle: MirrorVehicle }
  | { kind: 'cone-taper'; topY: number; bottomY: number; side: 'left' | 'right' }
  | { kind: 'concrete-barrier'; screenY: number; side: 'left' | 'right' }
  | {
      kind: 'static-vehicle';
      vehicle: StaticVehicle;
      x: number;
      y: number;
      scale?: number;
      color?: string;
    }
  /** A vehicle the scenario scripts, already posed for this frame by the world. */
  | {
      kind: 'scripted-vehicle';
      role: ScriptedVehicleRole;
      npc: NonNullable<ScenarioEvent['npc']>;
      at: NpcTransform;
    };

/**
 * One thing standing on the road, and whatever of it can be hit.
 *
 * `solids` is what makes the scene model the single answer to both questions a
 * frame asks: the renderer paints the node, the collision pass tests its
 * bodies, and neither can move without the other.
 */
export type SceneNode = SceneNodeShape & { solids?: WorldBody[] };
