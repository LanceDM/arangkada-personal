/**
 * What the road itself puts on this frame.
 *
 * Everything here belongs to the route rather than to a decision: the gantry
 * numbering the lanes, the arrows where an auxiliary lane runs out, the painted
 * nose an exit leaves through, the gates across a toll plaza. They stand on the
 * road whether or not a scenario is being graded against them, which is exactly
 * why they are declared on the route and not on an event.
 *
 * That is the correction this module exists for. Level 7 used to assemble its
 * expressway out of per-event overlays — a slip road drawn beside one event, a
 * median nose beside another, a gore wedge beside a third — each of which knew
 * nothing about the road it was dropped onto or about the others. A route that
 * describes itself once produces a road the driver can follow from one end to
 * the other.
 *
 * Composed before any event's scene, so the road is underneath what stands on
 * it, and each node carries its own solids exactly as an event's does.
 */
import type {
  LanePurposeRole,
  LaneSlot,
  RouteFixture,
} from '@/features/driving-sim/domain/scenario/scenarioScene';
import { showsResponseAt } from '@/features/driving-sim/domain/scenario/scenarioSupport';
import type { FrameView } from '@/features/driving-sim/domain/world/eventPlacement';
import { roadAtFor, supportOf } from '@/features/driving-sim/domain/world/eventPlacement';
import {
  CANVAS_HEIGHT,
  SCREEN_PX_PER_UNIT,
  distanceToScreenY,
  screenYToDistance,
  resolveLaneRole,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { auxiliaryAt, separatorAt } from '@/features/driving-sim/domain/world/routeGeometry';
import { tollGateBarriers } from '@/features/driving-sim/domain/world/sceneGeometry';
import { bodyRect, type WorldBody } from '@/features/driving-sim/domain/world/WorldBody';
import { gantryNode } from './prefabs';
import type { GantryPanel, SceneNode } from './SceneNode';

/** How far above and below the frame a fixture is still composed. */
const VISIBLE_MARGIN = 220;

/**
 * What a lane panel is saying, from what the lane is for and what the driver is
 * driving.
 *
 * Only two roles carry a meaning of their own on a board: the overtaking lane
 * is a restriction wherever it is, and the lane matching the player's own
 * vehicle category is the one to be in. Everything else is a lane assignment
 * for somebody else, and says so in words rather than in colour.
 *
 * "The one to be in" is the lane a scenario grades, and no real board says
 * YOUR LANE: it is a marker of the response, picked out only where the level's
 * support level shows one (`showsResponseAt`). Below that the lane reads as the
 * table does, a lane for cars, and knowing that this car is one is the
 * driver's. The restriction stays, because the table itself says ONLY.
 */
const panelTone = (
  role: LanePurposeRole,
  vehicleRole: LanePurposeRole,
  showsResponse: boolean
): { tone: GantryPanel['tone']; badge?: string } => {
  if (showsResponse && role === vehicleRole) return { tone: 'target', badge: 'YOUR LANE' };
  if (role === 'overtaking') return { tone: 'restricted', badge: 'ONLY' };
  return { tone: 'lane' };
};

const fixtureNodes = (
  { at, fixture }: RouteFixture,
  view: FrameView,
  roadX: number,
  screenY: number
): SceneNode[] => {
  const oncomingLanes = view.level.paint?.oncomingLanes ?? 0;
  const laneOf = (slot: LaneSlot) => resolveLaneRole(slot, oncomingLanes);

  switch (fixture.kind) {
    case 'lane-gantry': {
      // One panel per lane the plan describes, hung over the lane `laneEdges`
      // divides the road into — so the panel numbering a lane is over the lane
      // the physics and the grader mean by that number.
      const plan = view.level.route?.lanePlan;
      if (!plan) return [];
      const panels: GantryPanel[] = plan.lanes.map((lane, index) => ({
        lane: (oncomingLanes + index) as GantryPanel['lane'],
        top: lane.label,
        bottom: lane.use,
        ...panelTone(lane.role, fixture.vehicleRole, showsResponseAt(supportOf(view))),
      }));
      return [gantryNode(roadX, screenY, panels)];
    }

    case 'exit-gantry':
      return [
        gantryNode(roadX, screenY, [
          {
            lane: laneOf('curb'),
            top: fixture.legend,
            bottom: fixture.sub,
            tone: 'exit',
          },
        ]),
      ];

    case 'exit-gore':
      // The nose is drawn off the outermost lane, which is the lane the exit is
      // taken from and the lane the auxiliary lane runs beside.
      return [{ kind: 'exit-gore', roadX, screenY, exitLane: laneOf('curb') }];

    case 'merge-taper': {
      const aux = auxiliaryAt(at, view.level.route);
      return [{ kind: 'merge-taper', roadX, screenY, width: aux?.width ?? 0 }];
    }

    case 'toll-plaza': {
      const openLane = laneOf(fixture.openLane);
      return [
        {
          kind: 'toll-plaza',
          roadX,
          screenY,
          openLane,
          // The barriers are the gates: the same geometry the plaza is drawn
          // from, so a Red X the driver can steer through cannot exist.
          solids: tollGateBarriers(roadX, openLane).map(gate =>
            bodyRect(gate.x, screenY - 5, gate.width, 11, 'obstruction', 'a closed toll gate barrier')
          ),
        },
      ];
    }
  }
};

/**
 * How often a run of lane separator is composed, in screen rows.
 *
 * A divider is a length of road rather than a point on it, so it is composed as
 * a row of segments butted end to end — each one carrying its own solid, so the
 * stretch the wheel cannot cross is exactly the stretch that is drawn.
 */
const SEPARATOR_STEP = 28;

/** The nose dividing the auxiliary lane from the carriageway, row by row. */
const separatorNodes = (view: FrameView, roadAt: (screenY: number) => number): SceneNode[] => {
  const route = view.level.route;
  const label = (kind: 'island' | 'gore') =>
    kind === 'island' ? 'the curbed nose beside the slip road' : 'the gore between the exit and the carriageway';

  // What can be hit: sampled row by row down the frame, exactly as every drive
  // the game has been checked against was driven.
  const bodies: WorldBody[] = [];
  for (let screenY = CANVAS_HEIGHT + SEPARATOR_STEP; screenY > -SEPARATOR_STEP; screenY -= SEPARATOR_STEP) {
    const separator = separatorAt(screenYToDistance(screenY, view.distance), route);
    if (!separator) continue;
    const x = roadAt(screenY) + separator.x - separator.width / 2;
    bodies.push(bodyRect(x, screenY - SEPARATOR_STEP / 2, separator.width, SEPARATOR_STEP, 'obstruction', label(separator.kind)));
  }

  // What is seen: lengths standing on fixed stretches of the road, clipped to
  // where the separator runs (2026-11-18). Drawn on the rows above, the gore's
  // hatching and the island's nose band stayed still on screen while the road
  // moved under them, so the marking appeared to travel with the car.
  const nodes: SceneNode[] = [];
  const step = SEPARATOR_STEP / SCREEN_PX_PER_UNIT;
  const near = screenYToDistance(CANVAS_HEIGHT + SEPARATOR_STEP, view.distance);
  const far = screenYToDistance(-SEPARATOR_STEP, view.distance);
  const runs = (d: number) => separatorAt(d, route) !== null;
  /** Where between `inside` and `outside` the separator starts or stops. */
  const edge = (inside: number, outside: number) => {
    for (let i = 0; i < 12; i++) {
      const mid = (inside + outside) / 2;
      if (runs(mid)) inside = mid;
      else outside = mid;
    }
    return inside;
  };
  const END = 1e-6;
  for (let lo = Math.floor(near / step) * step; lo <= far; lo += step) {
    const hi = lo + step;
    const startsIn = runs(lo);
    const endsIn = runs(hi - END);
    if (!startsIn && !endsIn) continue;
    const from = startsIn ? lo : edge(hi - END, lo);
    const to = endsIn ? hi : edge(lo, hi - END);
    const separator = separatorAt((from + to) / 2, route);
    if (!separator) continue;
    const top = distanceToScreenY(to, view.distance);
    const bottom = distanceToScreenY(from, view.distance);
    const screenY = (top + bottom) / 2;
    nodes.push({
      kind: 'lane-separator',
      roadX: roadAt(screenY),
      screenY,
      height: bottom - top,
      offsetX: separator.x,
      width: separator.width,
      separator: separator.kind,
      solids: [],
    });
  }

  // Each body goes with the length it lies in, so the separator is still one
  // thing that is both drawn and hit; one beyond every length goes with the
  // nearest.
  for (const body of bodies) {
    const middle = body.y + body.height / 2;
    let host = nodes[0];
    let best = Infinity;
    for (const node of nodes) {
      if (node.kind !== 'lane-separator') continue;
      const gap = Math.abs(node.screenY - middle) - node.height / 2;
      if (gap < best) {
        best = gap;
        host = node;
      }
    }
    if (host) host.solids = [...(host.solids ?? []), body];
  }
  return nodes;
};

/** Everything the route puts on this frame, farthest first. */
export const routeSceneNodes = (view: FrameView): SceneNode[] => {
  const route = view.level.route;
  if (!route) return [];
  const fixtures = route.fixtures ?? [];

  const roadAt = roadAtFor(view.distance, view.curves);
  const nodes: SceneNode[] = separatorNodes(view, roadAt);

  for (const fixture of fixtures) {
    const screenY = distanceToScreenY(fixture.at, view.distance);
    if (screenY < -VISIBLE_MARGIN || screenY > CANVAS_HEIGHT + VISIBLE_MARGIN) continue;
    nodes.push(...fixtureNodes(fixture, view, roadAt(screenY), screenY));
  }

  // Farthest first, so nearer road furniture overlays what is behind it.
  return nodes.sort((a, b) => screenYOf(a) - screenYOf(b));
};

/** The row a route node stands on, for painter order. */
const screenYOf = (node: SceneNode): number =>
  'screenY' in node && typeof node.screenY === 'number' ? node.screenY : 0;
