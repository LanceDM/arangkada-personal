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
  distanceToScreenY,
  resolveLaneRole,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { auxiliaryAt, separatorAt } from '@/features/driving-sim/domain/world/routeGeometry';
import { tollGateBarriers } from '@/features/driving-sim/domain/world/sceneGeometry';
import { bodyRect } from '@/features/driving-sim/domain/world/WorldBody';
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
  const nodes: SceneNode[] = [];
  for (let screenY = CANVAS_HEIGHT + SEPARATOR_STEP; screenY > -SEPARATOR_STEP; screenY -= SEPARATOR_STEP) {
    const distance = view.distance + (550 - screenY) * 2;
    const separator = separatorAt(distance, view.level.route);
    if (!separator) continue;
    const roadX = roadAt(screenY);
    const x = roadX + separator.x - separator.width / 2;
    nodes.push({
      kind: 'lane-separator',
      roadX,
      screenY,
      offsetX: separator.x,
      width: separator.width,
      separator: separator.kind,
      solids: [
        bodyRect(x, screenY - SEPARATOR_STEP / 2, separator.width, SEPARATOR_STEP, 'obstruction',
          separator.kind === 'island' ? 'the curbed nose beside the slip road' : 'the gore between the exit and the carriageway'),
      ],
    });
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
