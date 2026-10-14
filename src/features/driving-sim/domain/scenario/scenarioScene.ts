/**
 * What a scenario can put on the road.
 *
 * The vocabulary of the scene: sign faces and their art, the paint a
 * carriageway carries, the markings an event lays down, the surface effects a
 * stretch of road has, the scripted vehicles, the people on a crossing, and the
 * things standing in the way.
 *
 * Separate from `scenarioDefinition` because it has different readers.
 * `domain/scene` and the canvas renderers consume this and nothing else; the
 * session and the evaluation layer consume the event structure and barely touch
 * this. Neither has to know the whole of the other to be read.
 */

/**
 * The stretch of road an event is planted in. Declared rather than guessed from
 * the description so a sign always stands beside the situation it governs: a
 * junction sign gets a junction, a crossing sign gets a crossing.
 */
export type RoadScene =
  // Junctions.
  //
  // There is deliberately no Y-fork here. This view scrolls straight up a
  // corridor, and the only thing that can genuinely end or redirect a road is
  // the turn hand-off — a real fork or branch cannot be expressed at all, so
  // drawing one would depict a decision the simulation could never ask the
  // driver to make.
  //
  // 'roundabout' is not an exception to that: it is still one point on the
  // straight corridor, drawn as a fixed circulation illusion (a static island
  // plus a scripted `NpcVehicleSpec` moving on a circle around it) rather than
  // a real junction with a branch. The corridor still never forks.
  | 'intersection'
  | 'side_road'
  | 'junction_t'
  | 'merge'
  // Not a junction: a row of gates across the one road, which is why it sits
  // here beside `merge` rather than in JUNCTION_SCENES. The plaza reads its
  // open lane from the event's own lane requirement, so the green arrow always
  // hangs over the lane the grader is measuring and the red X never covers a
  // gate the driver was allowed to take.
  | 'toll'
  | 'signal'
  | 'roundabout'
  // Alignment and width
  | 'bend'
  | 'narrows'
  | 'divided_start'
  | 'divided_end'
  | 'bridge'
  | 'two_way'
  // Surface and terrain
  | 'hump'
  | 'uneven'
  | 'wet'
  | 'flood'
  | 'gradient_up'
  | 'gradient_down'
  // Hazards on the road
  | 'crosswalk'
  | 'animal'
  | 'rockfall'
  | 'roadwork'
  | 'railway'
  // Roadside
  | 'lay_by'
  | 'open_road'
  /**
   * The road the level's own `RouteLayout` describes, at this point of it.
   *
   * Not a scene of its own: it says that the sign stands beside a road the
   * route has already drawn — its lanes, its auxiliary lane, its gantries and
   * its gore all come from one typed declaration rather than from an overlay
   * this event drops beside them. The event contributes the plate and nothing
   * else.
   */
  | 'route';

/**
 * Which of the driver's own lanes something occupies, named by its role rather
 * than by an index.
 *
 * `inner` is the lane nearest the centre line — on a one-way carriageway, the
 * one against the median, which is the overtaking lane every expressway lane
 * table is written around. `curb` is the outermost. The index each resolves to
 * depends on how many lanes of opposing traffic the level declared, which is
 * why content names the role and the engine resolves the lane.
 *
 * `LaneName` in `scenarioDefinition` is this same vocabulary, aliased for the
 * readers that only see the grading half of an event.
 */
export type LaneSlot = 'inner' | 'middle' | 'curb';

/** Which sign face the canvas draws at the roadside. */

export type RoadsideSignArt =
  | 'octagon'
  | 'triangle_down'
  | 'triangle_up'
  | 'circle_bar'
  | 'circle_prohibit'
  | 'circle_limit'
  | 'diamond'
  | 'chevron'
  | 'obstruction'
  | 'crossbuck'
  | 'rect_instruction'
  | 'signal_head';

/**
 * Which lamp is lit on a signal head, for `signal_head` art.
 *
 * `green` exists for right-of-way rather than for signal recognition. Level 3
 * teaches what each aspect means, and a green light there would be a question
 * with no decision in it. The Level 5 module's own "who goes first" table needs
 * it for the opposite reason: its rule is that a green light permits you to
 * proceed — sometimes freely, sometimes only after yielding to whoever is
 * already lawfully inside the junction — which cannot be posed at all without a
 * green to proceed on.
 */
export type SignalAspect =
  | 'red'
  | 'flashing_red'
  | 'yellow'
  | 'flashing_yellow'
  | 'green';

/**
 * The same sign shown twice: small on the road where it is easy to miss on a
 * narrow carriageway, and enlarged beside the road in the prompt panel so the
 * player can actually read what they are being asked about.
 */
export interface SignPlate {
  /**
   * File under `public/arangkada_extracted_images/level3/`, used for the
   * enlarged plate. Omitted for traffic signals, which have no sign image and
   * are drawn as a signal head instead.
   */
  image?: string;
  /** Official LTO name, worded as the level module lists it. */
  name: string;
  /** Category line, e.g. 'A. Regulatory Sign'. */
  category: string;
  /** One-line meaning, matching the module's reference table. */
  meaning: string;
  art: RoadsideSignArt;
  /** Short text or symbol painted on the sign face on the canvas. */
  glyph?: string;
  aspect?: SignalAspect;
}

/**
 * Which pavement marking the canvas paints on the road surface.
 *
 * A marking is not a sign: it has no post, no face and no roadside position. It
 * is the road itself, which is why these are drawn by their own routine rather
 * than squeezed into `RoadsideSignArt`. The vocabulary is per visual form, not
 * per official name — a Barrier Line and a Double Solid Yellow Line are two
 * names the module gives, but only one thing to paint.
 */
export type RoadMarkingArt =
  // A. Longitudinal lines — run along the direction of travel.
  | 'centre_line'
  | 'lane_line'
  | 'double_solid_yellow'
  | 'single_solid_yellow'
  | 'solid_yellow_broken_white'
  // The same marking with the solid yellow line on the near side instead of
  // the far one — named in the same left-to-right reading order as its
  // sibling, since which side of the pair the road paints solid on is exactly
  // what a driver has to be able to tell apart.
  | 'broken_white_solid_yellow'
  | 'broken_yellow'
  | 'broken_and_solid_yellow'
  | 'edge_line'
  | 'continuity_line'
  | 'transition_line'
  // B. Traverse lines — cross the carriageway.
  | 'stop_line'
  | 'give_way_line'
  | 'pedestrian_crossing'
  // The same marking at a light-controlled crossing: a signal head standing
  // over it, and a pedestrian who is actually walking rather than waiting on
  // the curb, since a light tells them when to go the same way it tells you.
  | 'pedestrian_crossing_signalized'
  // C. Other lines.
  | 'turn_line'
  | 'yellow_box'
  | 'parking_bay'
  | 'loading_bay'
  // C/D. Reserved lanes, which are read from the line that encloses them.
  | 'bus_puj_lane_line'
  | 'bus_lane'
  | 'bicycle_lane'
  | 'motorcycle_lane'
  // E. Painted curbs.
  | 'red_curb'
  | 'yellow_curb'
  // F. Object markings.
  | 'traffic_cones'
  | 'concrete_barriers'
  // G. Raised pavement markers.
  | 'cats_eye'
  // H. Other markings.
  | 'approach_markings'
  | 'chevron_marking'
  | 'rumble_strips'
  | 'railway_pavement'
  | 'pavement_arrow'
  | 'pavement_speed_limit';

/**
 * The markings that are the road rather than a feature on it.
 *
 * These run the length of the carriageway, so they cannot be drawn as an event:
 * painting a patch of double-yellow over a road that already carries its own
 * lines produces two markings at once and a visible seam at each end. Instead
 * the road asks which of these it is carrying at each point of the route, and
 * the "event" for one of them is simply the stretch where the answer changes.
 */
export type LongitudinalArt = Extract<
  RoadMarkingArt,
  | 'centre_line'
  | 'lane_line'
  | 'double_solid_yellow'
  | 'single_solid_yellow'
  | 'solid_yellow_broken_white'
  | 'broken_white_solid_yellow'
  | 'broken_yellow'
  | 'broken_and_solid_yellow'
  | 'edge_line'
  | 'cats_eye'
  | 'bus_puj_lane_line'
  | 'bus_lane'
  | 'bicycle_lane'
  | 'motorcycle_lane'
>;

/** A stretch of route carrying one longitudinal marking. */

export interface RoadPaintSpan {
  /** Distance along the route where this paint takes over. */
  from: number;
  /** Distance where it gives way to whatever comes next. */
  to: number;
  art: LongitudinalArt;
}

/**
 * What the carriageway itself is painted with, and how it is laid out.
 *
 * Absent on every level that does not need the road to change, which keeps
 * those roads drawn the one way. Level 4 declares it because reading a change
 * in the paint under the wheels is the whole competency it teaches.
 */
export interface RoadPaint {
  /**
   * Lanes at the left of the carriageway carrying opposing traffic. Zero is a
   * one-way carriageway, where a yellow centre line would have nothing to
   * separate and overtaking could not mean crossing into anybody.
   */
  oncomingLanes: number;
  /** What the road carries wherever no span overrides it. */
  base: LongitudinalArt;
  spans: RoadPaintSpan[];
}

/**
 * The marking under the wheels, named and categorised the way the level module
 * names it.
 *
 * This is the marking equivalent of `SignPlate`, and it exists for the same
 * reason: the paint on a 200px carriageway is not something anyone can identify
 * by eye, so the same marking is shown enlarged in the prompt panel while the
 * event is live.
 */

/**
 * The paint a `road_marking` event lays down, for the older events that do not
 * carry a full `MarkingPlate`.
 */
export type LanePaintKind =
  | 'yellow_box'
  | 'mc_lane'
  | 'bike_lane'
  | 'bus_lane'
  | 'parking_bay'
  | 'red_curb'
  | 'yellow_curb'
  | 'generic_lane';

/** An in-cabin check, shown as a glyph rather than as something on the road. */

export type ComplianceCheck =
  | 'seatbelt'
  | 'child_restraint'
  | 'phone'
  | 'gear'
  | 'documents'
  /** Nothing more specific is known: the question-mark glyph. */
  | 'unknown';

/**
 * A reusable scene, named by the scenario that places it.
 *
 * Each of these expands to the same composition of nodes wherever it appears —
 * a level places an instance, it does not describe one. Only the older event
 * types need it: a checkpoint, a marking, a signed road situation or a vehicle
 * failure already says what it is through `inspection`, `marking`,
 * `sign`/`scene` or `emergency`.
 */
export type ScenePrefab =
  | { kind: 'driveway_crossing' }
  | { kind: 'bend_warning' }
  | { kind: 'unknown_hazard' }
  | { kind: 'lane_paint'; paint: LanePaintKind }
  | { kind: 'merge_arrows' }
  | { kind: 'overtaking_oncoming' }
  | { kind: 'give_way_junction' }
  | { kind: 'no_entry_junction' }
  | { kind: 'roundabout' }
  | { kind: 'oncoming_left_turn' }
  | { kind: 'cross_street' }
  | { kind: 'lane_arrow'; direction: 'left' | 'right' }
  | { kind: 'compliance'; check: ComplianceCheck }
  | { kind: 'checkpoint_officer' }
  | { kind: 'main_road_junction' }
  /**
   * A road crash that has already happened: the wreck across the lane, the
   * vehicle that left the road, the debris between them.
   *
   * One declaration for the whole tableau, because the parts of it are one
   * situation — see `crashSceneNodes` in `domain/scene/prefabs`. Only the wreck
   * is solid; everything else is the scene it sits in.
   */
  | { kind: 'road_crash' }
  /**
   * A fire hydrant standing at the right curb, with no sign beside it.
   *
   * The place is the rule: a car may not stand within four meters of one
   * whether or not anything is posted. On the verge
   * and nothing solid, so it is passed or stood beside, never hit.
   */
  | { kind: 'fire_hydrant' };

export interface MarkingPlate {
  /**
   * File under `public/arangkada_extracted_images/level4/`, used for the
   * enlarged plate. Optional: until the module's marking images are wired in,
   * the card falls back to drawing the marking from `art`, so the level is
   * fully playable without them.
   */
  image?: string;
  /** Official LTO name, worded as the level module lists it. */
  name: string;
  /** Category line, e.g. 'A. Longitudinal Line'. */
  category: string;
  /** One-line meaning, matching the module's reference table. */
  meaning: string;
  art: RoadMarkingArt;
  /** Text painted on the road surface, e.g. 'BUS LANE' or '60'. */
  glyph?: string;
  /**
   * Which side of the carriageway the marking occupies, for the ones that only
   * mean anything on a side: a continuity line, an edge line, a reserved lane.
   */
  side?: 'left' | 'right';
}

/**
 * How a stretch of road behaves differently from clean, level asphalt.
 *
 * A Slippery Road sign that does not lengthen your braking, or a Hump sign with
 * no hump, warns of nothing. Declaring the effect here is what lets the warning
 * sign and the road it stands on mean the same thing.
 */
export interface RoadEffect {
  /**
   * Multiplies braking force. Below 1 means the vehicle takes longer to stop,
   * which is the whole lesson of a wet, flooded or loose surface.
   */
  grip?: number;
  /**
   * Speed change per frame while inside the zone: negative drags the vehicle
   * back on a climb, positive runs it away downhill.
   */
  gradient?: number;
  /**
   * Crossing faster than this is punished physically — the vehicle is thrown
   * off line and loses speed, as it would over a hump or broken surface.
   */
  jarringAbove?: number;
  /** The usable carriageway shrinks to this fraction of its width. */
  narrowsTo?: number;
  /**
   * Which side the remaining width is on. A closure blocks one side, so the
   * default centre squeeze would drive the vehicle into it.
   */
  openSide?: 'left' | 'right' | 'centre';
  /**
   * The road genuinely bends this way. The whole carriageway sweeps sideways
   * across the screen over the effect's span, so holding a lane through the
   * bend takes steering — which is the only thing that makes a Sharp Turn or
   * Winding Road sign a driving task rather than a picture.
   */
  curve?: 'left' | 'right';
  /**
   * How sharp that bend is, as a fraction of a full-lane swing. 1 moves the
   * road by one lane width; the default suits an ordinary bend.
   */
  curveStrength?: number;
  /**
   * How much of the road ahead the driver can still see, as a fraction of the
   * normal view. Below 1 the far end of the corridor is washed out by rain,
   * fog or dust, and the hazard the driver is being asked to slow for is
   * literally the fact that they cannot see one.
   *
   * A poor-visibility warning that leaves the road perfectly legible teaches
   * the sentence rather than the condition — the same reason `grip` exists
   * rather than a Slippery Road sign that changes nothing under the wheels.
   */
  visibility?: number;
  /**
   * The throttle is stuck open for this stretch: the speed setting is pinned
   * at the top and tapping down will not bring it back.
   *
   * The brake still works, which is exactly the point. A jammed gas pedal is
   * the one mechanical failure in the module whose correct response — release,
   * neutral, then press the brake firmly — ends in something the driver can
   * actually do here, so it is driven rather than asked about.
   */
  stuckThrottle?: boolean;
  /** How far either side of the sign the effect is felt, in road units. */
  span?: number;
}

/**
 * A marked bay at the roadside that the car can pull into and stop in.
 *
 * Stopping is the one thing the simulation could already measure but had
 * nowhere to apply: lateral movement plus coming to rest, both of which the
 * telemetry grader reads today. That makes parking and stopping signs askable
 * without any new kind of motion, unlike circulating a roundabout.
 */
export interface PullOverBay {
  side: 'left' | 'right';
  /** True when the sign permits stopping here; false when it forbids it. */
  mayStop: boolean;
  /** Shown on the approach, while there is still room to pull in. */
  hint: string;
  /**
   * Parked cars fore and aft of the space, which is what makes it a *space*
   * rather than an open stretch of curb. Without them "reverse in" and "drive
   * straight in" are indistinguishable, because nothing is in the way of
   * either — the two cars are the reason the technique exists.
   */
  refCars?: boolean;
}

/**
 * Which fixed path a scripted NPC vehicle follows. Each one is a pure
 * function of the player's own distance along the road (plus wall-clock time
 * for the one path that circulates forever) — no physics, no decisions of its
 * own. Its only job is to make a right-of-way situation visible; grading
 * still runs entirely on the driver's own speed/lane/stop.
 */
export type NpcPathKind =
  | 'crossing_from_left'
  | 'crossing_from_right'
  | 'oncoming_through'
  | 'closing_from_behind'
  | 'roundabout_circulating'
  /**
   * Travelling the same way you are, in a lane of your own carriageway, under
   * its own power.
   *
   * The one path that is not a pure function of the player's distance. Every
   * other scripted vehicle is somewhere *because* the player is somewhere, which
   * is enough to stage a right-of-way situation and useless for a following
   * gap: a lead vehicle that only moves when you do can never be given more
   * room by slowing down, and the gap you keep is the whole lesson. So this one
   * carries its own road distance, advanced a frame at a time by
   * `advanceRoadTraffic`, and the scene reads where it has got to.
   */
  | 'travelling_ahead'
  /**
   * Travelling the acceleration lane beside you, and moving into the
   * carriageway before that lane runs out.
   *
   * Carries its own road distance for the same reason `travelling_ahead` does:
   * a merge is contested or it is nothing, and a vehicle whose position is a
   * function of yours can never be arrived at with too small a gap. Where it
   * sits across the road comes from the route — the auxiliary lane while there
   * is one, the lane it is joining once there is not.
   */
  | 'merging_from_ramp'
  /**
   * Comes up from behind on the line between your two lanes, draws level, and
   * carries on ahead.
   *
   * The one path that passes *through* the driver's own half of the road rather
   * than beside it or across it. It is what a rider filtering through slow
   * traffic actually does, and the defensive question it asks — hold your line
   * while somebody is beside you — cannot be posed by a vehicle that stays in a
   * lane of its own.
   *
   * A pure function of the player's distance, like every path but the two that
   * carry their own: it starts behind, is level at the trigger, and is clear
   * ahead by the time the window closes.
   */
  | 'filtering_past'
  // Comes down the opposing lane and peels away across your path, signalling.
  // Distinct from `oncoming_through` because the rule it illustrates is about
  // where it is going, not that it is there: RA 4136 gives an oncoming vehicle
  // turning left across you priority only if it signalled, so a driver has to
  // be able to see it turn.
  | 'oncoming_turning_left';

/**
 * How fast a scripted vehicle travels, as a share of the road's own limit.
 *
 * A share rather than a speed in km/h so one declaration means the same thing
 * on every road: "two thirds of the limit" is a slow lorry on an expressway and
 * a slow lorry on a city street, where a flat 65 km/h would be the first and
 * twice the second. It is also what lets a following-distance scenario be
 * practised in a level other than the one it was written for.
 */
export interface NpcSpeedProfile {
  /** Cruising share of the level's speed limit. */
  cruise: number;
  /**
   * The share it drops to on the run-in to the event, so a following gap is
   * tested by the vehicle ahead actually slowing rather than by the player
   * choosing to close on it.
   */
  slowsTo?: number;
  /** How far before the trigger point that drop begins, in road units. */
  slowsFrom?: number;
}

/**
 * How traffic coming up behind moves, in shares of the road's own limit.
 *
 * The emergency vehicle this path was written for crosses the frame in about a
 * second and a half, which is what a siren on your tail should feel like. An
 * ordinary sedan asked to teach "give the overtaking lane back" cannot do its
 * job at that speed: it is alongside before the driver has read why it is
 * there. Declaring the speeds makes the difference a fact about the scenario
 * rather than a constant the two have to share.
 *
 * Omitted, the path keeps the fixed screen-space motion it has always had —
 * which is what leaves the ambulance exactly as it was.
 */
export interface ClosingTrafficProfile {
  /** Speed it closes at while the lane is still blocked, as a share of the limit. */
  approach: number;
  /** Speed it passes at once the lane is clear, as a share of the limit. */
  pass: number;
  /** Seconds of gap it settles into behind a driver who will not move over. */
  holdSeconds: number;
}

/**
 * What a motorcycle is carrying, where a scenario is about exactly that.
 *
 * Drawn and nothing else. A rider with no helmet, a child riding behind, a box
 * over the tail and a tail lamp that never stops flashing are each the whole
 * cue of a scenario, and a sprite that always drew a helmeted rider alone with
 * a steady lamp put the opposite of that scenario on the road. The body the
 * collision pass hits is the motorcycle's own whatever is declared here, and
 * nothing here is graded.
 */
export interface MotorcycleRider {
  /** The rider wears no helmet. */
  bareheaded?: boolean;
  /** Somebody riding behind the rider, and whether they wear a helmet. */
  backRider?: { kind: 'adult' | 'child'; bareheaded?: boolean };
  /** A box fitted over the tail, wider than the rider's shoulders. */
  topBox?: boolean;
  /** `blinking`: the tail lamp flashes all the time, braking or not. */
  tailLamp?: 'steady' | 'blinking';
}

export interface NpcVehicleSpec {
  path: NpcPathKind;
  /**
   * What is travelling, which decides the sprite it is drawn with and the body
   * it is hit at.
   *
   * `bicycle` is here for the same reason the rest are: a cyclist is a road
   * user you share a lane with, and a following gap behind one is a thing a
   * driver is taught to keep. As a `RoadActorKind` a bicycle can only stand
   * still in the carriageway, which makes "hold back until there is room" a
   * lane change rather than a gap — the one manoeuvre the rule is not about.
   */
  vehicleKind: 'car' | 'ambulance' | 'jeepney' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'bicycle';
  /** Plain-language name used in the crash report if the player hits it. */
  label: string;
  /** Road-distance span its approach plays out over; a sensible default applies per path if omitted. */
  approachSpan?: number;
  color?: string;
  /**
   * Which of the driver's own lanes it travels in, for the paths that share the
   * carriageway rather than cross it. Defaults per path; a `travelling_ahead`
   * vehicle that names none joins in the lane the car is in and keeps it, so
   * "in your lane" is true wherever the scenario is played.
   */
  lane?: LaneSlot;
  /** How fast it travels, for the paths that move under their own power. */
  speed?: NpcSpeedProfile;
  /** How a `closing_from_behind` vehicle approaches, holds and passes. */
  closing?: ClosingTrafficProfile;
  /**
   * Show this vehicle in the rear-view mirror while it is behind the driver.
   *
   * Opt-in rather than automatic: the mirror is worth the space it takes only
   * where the scenario is *about* something behind you, and a level that puts a
   * car back there for atmosphere should not get a permanent readout for it.
   */
  mirror?: boolean;
  /**
   * Its hazard lights are on, and flash.
   *
   * Declared rather than inferred, for the reason every other visual is: a
   * scenario whose cue is "its hazards are on" has to be able to put them on
   * screen, and a driver who is told to read them has to be able to see them.
   */
  hazards?: boolean;
  /**
   * It is visibly belching smoke, and is drawn with a plume behind it.
   *
   * Same bargain as `hazards`, and for the same reason: a scenario whose whole
   * cue is "that vehicle is smoking" has to be able to put the smoke on screen.
   * It was a sentence in a description before this, on a road that drew nothing
   * — and a description is exactly what nothing may read a visual out of.
   *
   * Decoration rather than a pose: it carries no state and collides with
   * nothing, so the renderer draws it from this flag without the world settling
   * anything per frame: decorative animation lives in the renderer.
   */
  smoking?: boolean;
  /**
   * Who and what it carries, for a motorcycle. Same bargain as `smoking`: the
   * renderer draws it from the declaration, and nothing reads it but the
   * renderer. Ignored for every other kind.
   */
  rider?: MotorcycleRider;
  /**
   * The gap it joins the road at, in seconds of headway at the road's own speed
   * limit — the same unit the following rule is taught in, and for the same
   * reason `speed` is a share rather than a number: three seconds of road is
   * three seconds of road on any carriageway, while three hundred metres is a
   * comfortable gap on one and most of a stopping distance on another. That is
   * what lets a following-distance scenario be practised somewhere other than
   * the level it was written for.
   */
  entryHeadway?: number;
  /**
   * Crossing-path role. The two `crossing_*` paths default to "crossing with
   * priority" — in the box as the player arrives, so a driver who fails to
   * yield hits it. These three flags select the other three readings a
   * right-of-way junction needs; at most one applies.
   *
   * `yields`: the vehicle gives way to the player. It drives up to its own
   * give-way line, stops short of the box and holds while the player takes the
   * junction — the picture a "you have priority, go" event needs.
   *
   * `emerges`: the vehicle is joining from a driveway or side road. It noses
   * out into the player's lane and stays there rather than vanishing part-way,
   * so the join is completed on screen.
   *
   * `inBox`: the vehicle is already stalled inside the box, still clearing. It
   * sits dead centre from the moment the junction is visible until the player
   * arrives, so the decision is never made over an empty junction.
   */
  yields?: boolean;
  emerges?: boolean;
  inBox?: boolean;
}

/**
 * Somebody on foot, as a scene composes them rather than as the renderer
 * guesses them.
 *
 * The four kinds are the four sprites `drawPedestrian` draws. Declared for the
 * same reason `sign`, `marking` and `npc` are: the renderer draws what the
 * level says is there, never what its prose happens to mention, so a crossing
 * can hold a group rather than whichever single person a sentence named. See
 * `pedestrians` on `ScenarioEvent`.
 */
export type PedestrianKind = 'adult' | 'child' | 'elderly' | 'pwd';

/**
 * One person on a crossing. `position` is a share of the carriageway's width
 * measured from its left edge, so a scene can place a group without knowing the
 * road's pixel width; omitting it stands them on the curb where a waiting
 * pedestrian belongs.
 *
 * Values outside 0..1 are the footpath: below 0 is the left verge, above 1 the
 * right. People waiting to cross are standing somewhere, and that somewhere is
 * off the road — drawing them on it instead would put a body in a lane nobody
 * is being asked to avoid.
 */
export interface CrossingPedestrian {
  kind: PedestrianKind;
  position?: number;
  /**
   * Solid: driving into this person ends the run. A crossing normally has
   * exactly one — the person the event is actually about — with anybody else
   * in the group standing clear as scenery, which is how a crossing scene has
   * always registered exactly one hitbox.
   */
  solid?: boolean;
}

/**
 * A vehicle or animal standing in the carriageway that the driver has to deal
 * with, named by the scenario rather than read out of its description. Same
 * rule as `PedestrianKind`: rewording or translating a sentence shown to the
 * player must not change the picture.
 */
export type RoadActorKind =
  | 'jeepney'
  /** A panel van, drawn as the van a scenario naming one should get. */
  | 'van'
  | 'tricycle'
  | 'motorcycle'
  | 'bicycle'
  | 'truck'
  | 'bus'
  | 'smoke_belcher'
  | 'ambulance'
  | 'broken_down'
  /**
   * A car that has been in a crash: slewed across the lane it was travelling
   * in, front end folded, smoking. Distinct from `broken_down`, which is a
   * working vehicle that has stopped — the two are different situations and a
   * driver has to be able to tell them apart at a glance.
   */
  | 'crashed_car';

/** Where in the carriageway a `RoadActorKind` stands. */

export interface RoadActorSpec {
  kind: RoadActorKind;
  /** Its hazard lights are on, and flash. Same bargain as `NpcVehicleSpec`. */
  hazards?: boolean;
  /**
   * Which half of the road it occupies: `curb` is the driver's own curb lane,
   * `inner` the lane against the centre line. Omitted, the renderer keeps the
   * deterministic left/right alternation it has always used for this event.
   */
  side?: 'curb' | 'inner';
}

/**
 * What stands beside a stretch of road.
 *
 * The roadside is what tells a driver which kind of road they are on before any
 * sign does: trees and shopfronts are a street, a continuous barrier and a line
 * of lamp posts are a limited-access facility.
 */
export type RoadsideTheme =
  /** Trees, poles and buildings: the ordinary street every level has always had. */
  | 'mixed'
  /**
   * A residential barangay street: low houses tight to the road, shop awnings,
   * and a covered court. Close, cluttered and slow-looking, which is the point
   * — the verge itself says "people live here" before any sign does.
   */
  | 'barangay'
  /**
   * A road running along water: a low seawall on one side with the river
   * beyond it, and acacias on the other. Open and bare, so a bend in it reads
   * as a bend rather than as more street.
   */
  | 'riverside'
  /** Median barrier, guardrails and lamp posts along both verges. */
  | 'expressway'
  /** The lit run-in to a toll plaza: barriers and lamp posts, no planting. */
  | 'toll_approach';

/** What an extra lane beside the through carriageway is there for. */
export type AuxiliaryLaneRole =
  /** Traffic joining builds speed here, then merges before it runs out. */
  | 'acceleration'
  /** Traffic leaving moves over here and slows; it becomes the exit ramp. */
  | 'deceleration';

/**
 * An extra lane running outside the through carriageway, on the driver's side.
 *
 * Width is a taper at each end and full in between, so a lane that opens and a
 * lane that closes are the same declaration with the tapers the other way
 * round. Everything that has to agree about where the road is reads it: the
 * drivable bounds, the paint, the scenery, the traffic on it, and the grading
 * that asks whether the driver got off it in time.
 */
/**
 * What stands between an auxiliary lane and the through lanes while the two are
 * still separate roads.
 *
 * `island` is a kerbed nose — concrete, with a hatched approach; `gore` is the
 * painted wedge between a carriageway and a ramp leaving it. Both are drawn and
 * both are solid; the difference is what they look like.
 */
export type LaneSeparatorKind = 'island' | 'gore';

/**
 * The stretch over which an auxiliary lane is a *different road* from the
 * carriageway beside it, rather than a lane of the same one.
 *
 * A slip road does not become the expressway the moment its tarmac touches it.
 * It runs alongside, divided by a nose the wheel cannot cross, and only at the
 * opening do the two surfaces become one. Without this an acceleration lane is
 * a lane of the carriageway from the first frame, and "merge before it ends"
 * means nothing because the driver was never on a separate road to merge from.
 */
export interface LaneSeparator {
  kind: LaneSeparatorKind;
  /** Route distance the separation starts at. */
  from: number;
  /** Route distance it ends at — the opening. */
  to: number;
}

export interface AuxiliaryLane {
  role: AuxiliaryLaneRole;
  /** Route distance over which it opens from nothing to a full lane. */
  taperIn: number;
  /** Route distance over which it closes back to nothing. */
  taperOut: number;
  /**
   * Where the lane is divided from the through lanes. Outside it the two are
   * one surface and a driver may move across; inside it they are two roads.
   */
  separator?: LaneSeparator;
}

/**
 * One stretch of the route, and what the road does along it.
 *
 * A level made of these is a road that changes as you drive it rather than a
 * sequence of unrelated pictures dropped beside a constant one. Segments are
 * half-open (`from` inclusive, `to` exclusive) and must not overlap.
 */
export interface RouteSegment {
  from: number;
  to: number;
  roadside: RoadsideTheme;
  auxiliary?: AuxiliaryLane;
}

/** What one lane of the carriageway is for, as the road's own signage says it. */
export interface LanePurpose {
  /** How the signage numbers it — "LANE 1" against the median, outwards. */
  label: string;
  /** What it is for, in the two or three words a gantry panel holds. */
  use: string;
  /**
   * Which category it is, so grading and signage cannot disagree: the lane a
   * passenger car belongs in is the one marked `cars`, wherever that is.
   */
  role: LanePurposeRole;
}

/** The vehicle categories an expressway lane table assigns lanes to. */
export type LanePurposeRole = 'overtaking' | 'cars' | 'heavy' | 'special';

/**
 * What each lane of the carriageway is for, from the median outwards.
 *
 * One entry per lane. The gantry draws these over the lanes `laneEdges` divides
 * the road into, so the panel numbering a lane hangs over the lane the physics
 * and the grader use — which is the whole point of declaring it once.
 */
export interface LanePlan {
  lanes: LanePurpose[];
}

/** Something the road itself carries at a point of the route. */
export type RouteFixtureKind =
  /**
   * A gantry over the carriageway, one panel per lane, from the lane plan.
   *
   * `vehicleRole` is the category the player's own vehicle belongs to, so the
   * board can pick that lane out as the one to be in. It is the same role the
   * lane plan gives that lane, which is what stops the sign recommending a lane
   * the grader marks down — `level7.test.ts` asserts the two agree.
   */
  | { kind: 'lane-gantry'; vehicleRole: LanePurposeRole }
  /** An advance board over the lane an exit leaves from. */
  | { kind: 'exit-gantry'; legend: string; sub: string }
  /** The painted nose between the through lanes and an exit, with its chevrons. */
  | { kind: 'exit-gore' }
  /** A row of toll gates across the road, one of them open. */
  | { kind: 'toll-plaza'; openLane: LaneSlot }
  /** The arrows and legend where an auxiliary lane runs out. */
  | { kind: 'merge-taper' };

/** One fixture, and the point of the route it stands at. */
export interface RouteFixture {
  at: number;
  fixture: RouteFixtureKind;
}

/**
 * The road a level is driven on, declared as data.
 *
 * Absent on every level whose road never changes, which keeps those roads drawn
 * exactly as they were: a constant four-lane carriageway with an ordinary
 * roadside. A level that declares one gets a carriageway whose width, paint,
 * verge, drivable bounds and furniture all come from this one description,
 * rather than from a per-event overlay dropped beside a road that never knew
 * about it.
 */
export interface RouteLayout {
  segments: RouteSegment[];
  /** What the lanes are for, where the road says so. */
  lanePlan?: LanePlan;
  /** Signage and structures the road carries, in route order. */
  fixtures?: RouteFixture[];
}
