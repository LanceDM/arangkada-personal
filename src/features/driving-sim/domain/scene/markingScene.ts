/**
 * A marking event, composed into scene nodes.
 *
 * This is the half of `renderEvents`'s marking switch that decides *what a
 * marking puts on the road* — the paint itself, plus the road furniture the
 * marking implies: a junction behind a stop line, a bay beside a painted curb.
 * Deciding it here rather than while drawing is what lets the same composition
 * answer "what is solid" and "what is painted" from one set of numbers.
 *
 * The order nodes are emitted in is the order they are painted in, and it is
 * load-bearing: a stop line goes down before the crossing it sits behind.
 */
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { MarkingPlate } from '@/features/driving-sim/domain/scenario/scenarioScene';
import {
  LANE_COUNT,
  LANE_WIDTH,
  ROAD_WIDTH,
  CANVAS_WIDTH,
  laneEdges,
  resolveLaneRole,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { intersectionGeometry } from '@/features/driving-sim/domain/world/junctionGeometry';
import { MARKING_REACH, ownLaneX, type EventPlacement } from '@/features/driving-sim/domain/world/eventPlacement';
import { bodyAt, bodyRect } from '@/features/driving-sim/domain/world/WorldBody';
import {
  chevronIslandGeometry,
  concreteBarrierGeometry,
  coneTaperPositions,
  islandApproachCentreX,
  signalCrossingPedestrian,
} from '@/features/driving-sim/domain/world/sceneGeometry';
import type { SceneNode } from './SceneNode';
import { junctionNode } from './prefabs';

const WHITE = '#f8fafc';

const pedestrianBody = (x: number, y: number) =>
  bodyAt(x, y, 18, 34, 'pedestrian', 'a pedestrian on the crossing');

/**
 * Markings the carriageway itself carries. The road is painted from the route,
 * so the change of paint *is* the event: anything drawn on top would put a
 * second marking over the one the driver is being asked to read.
 */
const CARRIED_BY_THE_ROAD = new Set<MarkingPlate['art']>([
  'centre_line',
  'lane_line',
  'double_solid_yellow',
  'single_solid_yellow',
  'solid_yellow_broken_white',
  'broken_white_solid_yellow',
  'broken_yellow',
  'broken_and_solid_yellow',
  'edge_line',
  'cats_eye',
  'bus_puj_lane_line',
  'bus_lane',
  'bicycle_lane',
  'motorcycle_lane',
]);

/**
 * The slow vehicle and the oncoming stream a two-way stretch puts on the road.
 *
 * A line about overtaking is meaningless without something to overtake:
 * declaring the stretch two-way is what makes refusing to pass cost the driver
 * something, so the paint is the only thing that decides whether it should.
 * Once the call is made the slow vehicle pulls away, or "stay behind it" would
 * be answered correctly and then punished with an unavoidable collision.
 */
export const twoWayTrafficNodes = (
  roadX: number,
  screenY: number,
  oncomingLanes: number,
  cleared: boolean
): SceneNode[] => {
  // The driver's own lane, the one beside the centre line — by lane role, so a
  // four-lane road does not put the lead vehicle in the oncoming traffic.
  const leadX = ownLaneX(roadX, oncomingLanes, -1);
  const oncomingX = roadX + LANE_WIDTH / 2;
  return [
    {
      kind: 'static-vehicle',
      vehicle: 'jeepney',
      x: leadX,
      y: cleared ? screenY - 190 : screenY - 66,
      scale: 0.95,
      solids: cleared
        ? []
        : [bodyAt(leadX, screenY - 66, 38, 56, 'vehicle', 'the slow vehicle ahead of you')],
    },
    {
      kind: 'static-vehicle',
      vehicle: 'oncoming',
      x: oncomingX,
      y: screenY - 150,
      scale: 0.85,
      solids: cleared ? [] : [bodyAt(oncomingX, screenY - 150, 28, 48, 'vehicle', 'an oncoming vehicle')],
    },
  ];
};

export const markingSceneNodes = (
  placement: EventPlacement,
  marking: MarkingPlate,
  level: LevelConfig,
  oncomingLanes: number,
  now: number,
  /**
   * Whether the support level shows the response (`scenarioSupport`). The
   * gantry over the graded lane and the arrow picked out in it are markers of
   * it, so below `full` neither is: the paint itself, and anything solid, is.
   */
  showsResponse: boolean
): SceneNode[] => {
  const { event, screenY, roadX, handled } = placement;
  const nodes: SceneNode[] = [];
  const topY = screenY - MARKING_REACH;
  const bottomY = screenY + MARKING_REACH;
  const side = marking.side ?? 'right';
  // Markings never carry a `maneuver` — only signs do — so a lane requirement
  // here is always a plain `requiredLane`.
  const laneReq = event.requiredLane;
  // The lane the road may mark as the one graded, or none where the support
  // level withholds the response.
  const markedLane = laneReq && showsResponse ? resolveLaneRole(laneReq.lane, oncomingLanes) : null;

  const across = (y: number, stroke: { color: string; width?: number; dash?: [number, number] }) =>
    nodes.push({ kind: 'road-marking', marking: { mark: 'across', y, roadX, stroke } });
  const turnLaneOverlay = () => {
    if (markedLane !== null) {
      nodes.push({
        kind: 'road-marking',
        marking: { mark: 'turn-lane', screenY: screenY + 8, lane: markedLane },
      });
    }
  };

  if (!CARRIED_BY_THE_ROAD.has(marking.art)) {
    switch (marking.art) {
      case 'continuity_line':
        // The lane on `side` is running out: its outer edge closes in on the
        // through lane, and the wedge left over is hatched off.
        nodes.push({ kind: 'road-marking', marking: { mark: 'hatch-wedge', topY, bottomY, side } });
        nodes.push({
          kind: 'road-marking',
          marking: {
            mark: 'along',
            topY,
            bottomY,
            offset: side === 'left' ? LANE_WIDTH : ROAD_WIDTH - LANE_WIDTH,
            stroke: { color: WHITE, width: 5, dash: [20, 10] },
          },
        });
        break;

      case 'transition_line':
      case 'approach_markings':
        nodes.push({
          kind: 'road-marking',
          marking: { mark: 'island-approach', screenY, oncomingLanes },
          solids: [
            bodyAt(
              islandApproachCentreX(roadX, oncomingLanes),
              screenY - 14,
              30,
              60,
              'obstruction',
              'a raised traffic island'
            ),
          ],
        });
        turnLaneOverlay();
        break;

      // Traverse lines, painted straight across the driver's own lane. A stop
      // line is a line on the road you are already on, not a junction of its
      // own — building the full crossroads here would paint a second yellow-box
      // look-alike wherever a stop line happened to be rolled.
      case 'stop_line':
        across(screenY + 8, { color: WHITE, width: 9 });
        break;

      // Give-way is different: "yield to traffic from somewhere else" needs a
      // somewhere else, so it gets one arm — not a full crossroads, so it still
      // reads as its own thing beside the yellow box.
      case 'give_way_line': {
        nodes.push(junctionNode({ roadX, screenY, side: 'right' }));
        const { stopLineY } = intersectionGeometry(screenY);
        across(stopLineY, { color: WHITE, width: 4, dash: [11, 9] });
        across(stopLineY - 9, { color: WHITE, width: 4, dash: [11, 9] });
        break;
      }

      case 'pedestrian_crossing':
        // The stop line sits behind the crossing, which is the whole
        // positioning lesson: you hold at the line, not on the stripes.
        across(screenY + 26, { color: WHITE, width: 8 });
        nodes.push({
          kind: 'crossing',
          style: 'regular',
          roadX,
          screenY,
          cleared: handled,
          solids: [pedestrianBody(roadX + ROAD_WIDTH - 15, screenY - 4)],
        });
        break;

      case 'pedestrian_crossing_signalized': {
        // The walker is only in the road while the crossing is still live.
        const walker = handled ? null : signalCrossingPedestrian(roadX, screenY, now);
        nodes.push({
          kind: 'crossing',
          style: 'signalized',
          roadX,
          screenY,
          cleared: handled,
          walker,
          solids: walker
            ? [bodyAt(walker.x, walker.y, 18, 34, 'pedestrian', 'a pedestrian crossing on the signal')]
            : [],
        });
        break;
      }

      case 'turn_line': {
        nodes.push(junctionNode({ roadX, screenY, crossTraffic: true }));
        const junction = intersectionGeometry(screenY);
        across(junction.stopLineY, { color: WHITE, width: 8 });
        nodes.push({
          kind: 'road-marking',
          marking: {
            mark: 'turn-path',
            from: { x: roadX + ROAD_WIDTH - LANE_WIDTH / 2, y: junction.stopLineY },
            control: { x: roadX + ROAD_WIDTH - LANE_WIDTH / 2, y: junction.boxBottom - 20 },
            to: { x: CANVAS_WIDTH, y: junction.boxBottom - 34 },
          },
        });
        break;
      }

      case 'yellow_box':
        // The box and its X are painted into every junction already; this
        // marking just needs its stop line. No static prop: the traffic — a
        // scripted vehicle, the backed-up queue, a declared actor stopped in
        // the box — is composed beside it in `SceneBuilder`, and only where
        // the scenario asks for it, so a "clear exit" box reads as clear.
        nodes.push(junctionNode({ roadX, screenY, control: 'stop' }));
        break;

      case 'parking_bay':
      case 'loading_bay':
        nodes.push(
          event.bay
            ? { kind: 'road-marking', marking: { mark: 'pull-over-bay', roadX, screenY, bay: event.bay } }
            : { kind: 'road-marking', marking: { mark: 'parking-bay', roadX, screenY } }
        );
        break;

      // Painted curbs. The bay is what makes these a decision: without
      // somewhere to pull into, "may I park here?" is answered by driving on.
      case 'red_curb':
      case 'yellow_curb':
        if (event.bay) {
          nodes.push({
            kind: 'road-marking',
            marking: { mark: 'pull-over-bay', roadX, screenY, bay: event.bay },
          });
        }
        nodes.push({
          kind: 'road-marking',
          marking: {
            mark: 'painted-curb',
            roadX,
            screenY,
            color: marking.art === 'red_curb' ? '#dc2626' : '#eab308',
          },
        });
        break;

      case 'traffic_cones':
        nodes.push({
          kind: 'cone-taper',
          topY,
          bottomY,
          side,
          solids: coneTaperPositions(placement.roadAt, topY, bottomY, side).map(cone =>
            bodyAt(cone.x, cone.y + 6, 22, 26, 'obstruction', 'a traffic cone closing the lane')
          ),
        });
        break;

      case 'concrete_barriers': {
        const barrier = concreteBarrierGeometry(placement.roadAt, screenY, side);
        nodes.push({
          kind: 'concrete-barrier',
          screenY,
          side,
          solids: [
            bodyRect(barrier.x, barrier.y, barrier.width, barrier.height, 'obstruction', 'a concrete barrier'),
          ],
        });
        break;
      }

      case 'chevron_marking': {
        const { island } = chevronIslandGeometry(placement.roadAt, topY, bottomY, oncomingLanes, laneReq?.lane);
        nodes.push({
          kind: 'road-marking',
          marking: { mark: 'chevron-island', topY, bottomY, oncomingLanes, lane: laneReq?.lane },
          solids: [
            bodyRect(
              island.centreX - island.width / 2,
              island.tipY,
              island.width,
              island.baseY - island.tipY,
              'obstruction',
              'a raised traffic island'
            ),
          ],
        });
        turnLaneOverlay();
        break;
      }

      case 'rumble_strips':
        nodes.push({ kind: 'road-marking', marking: { mark: 'rumble-strips', topY, bottomY } });
        break;

      case 'railway_pavement':
        nodes.push({ kind: 'road-marking', marking: { mark: 'railway-pavement', roadX, screenY } });
        break;

      case 'pavement_arrow': {
        // One arrow per lane. Where the support level shows the response, the
        // lane this event requires is picked out, so the paint says the same
        // thing the grader is measuring; below it every arrow is the white
        // paint a real road carries.
        const edges = laneEdges(roadX);
        for (let lane = 0; lane < LANE_COUNT; lane++) {
          nodes.push({
            kind: 'road-marking',
            marking: {
              mark: 'lane-arrow',
              x: (edges[lane] + edges[lane + 1]) / 2,
              y: screenY,
              direction: 'up',
              color: markedLane === lane ? '#facc15' : 'rgba(248,250,252,0.75)',
              scale: 0.7,
            },
          });
        }
        break;
      }

      case 'pavement_speed_limit':
        nodes.push({
          kind: 'road-marking',
          marking: {
            mark: 'legend',
            x: roadX + ROAD_WIDTH / 2,
            y: screenY + 10,
            text: marking.glyph ?? '60',
            size: 40,
          },
        });
        break;
    }
  }

  if (event.scene === 'two_way') {
    nodes.push(...twoWayTrafficNodes(roadX, screenY, oncomingLanes, handled));
  }

  void level;
  return nodes;
};
