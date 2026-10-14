/**
 * A sign event, composed into scene nodes.
 *
 * Every sign event is the same two things: the road situation the sign is about,
 * and the sign standing beside it. Placing the sign against the situation —
 * rather than at a fixed offset — is what stops it floating away from what it
 * governs, and doing it here means the position is a fact about the scene
 * rather than a side effect of the order things were drawn in.
 *
 * The solids each node declares are the same bodies the collision pass tests.
 */
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { RoadScene, SignPlate } from '@/features/driving-sim/domain/scenario/scenarioScene';
import {
  BAY_WIDTH,
  CANVAS_WIDTH,
  ROAD_WIDTH,
  resolveLaneRole,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { intersectionGeometry } from '@/features/driving-sim/domain/world/junctionGeometry';
import type { EventPlacement } from '@/features/driving-sim/domain/world/eventPlacement';
import { bodyAt, bodyRect } from '@/features/driving-sim/domain/world/WorldBody';
import {
  mergeLaneGeometry,
  roadworkGeometry,
  rockfallPositions,
  twoWayOncomingPoint,
} from '@/features/driving-sim/domain/world/sceneGeometry';
import type { SceneNode } from './SceneNode';
import { junctionNode, pedestrianGroupNode } from './prefabs';

/**
 * Which side a side street branches off to.
 *
 * Taken from what the sign is actually about, not just from turns: a No Right
 * Turn sign was being drawn over a road branching left, because only manoeuvre
 * events said which way they went and prohibitions fell through to a default.
 * A sign pointing one way over a road going the other teaches nothing.
 */
export const branchSideFor = (event: ScenarioEvent): 'left' | 'right' => {
  if (event.maneuver) return event.maneuver.direction === 'right' ? 'right' : 'left';
  if (event.avoid?.includes('turn_right')) return 'right';
  return 'left';
};

/**
 * How far in from the frame's edge a sign may stand. On a bend the road swings
 * most of a lane sideways, which carried a sign on the inside of the curve half
 * off the canvas — the one moment the driver most needs to read it.
 */
const SIGN_HALF_WIDTH = 26;

export const signSceneNodes = (
  placement: EventPlacement,
  sign: SignPlate,
  scene: RoadScene,
  oncomingLanes: number,
  /**
   * Extra drivable width on the right here, from an auxiliary lane the route
   * has open at this point. A verge measured from the through lanes put the
   * merge sign on the acceleration lane it was warning about.
   */
  auxiliaryWidth: number,
  /**
   * Whether the support level shows the response (`scenarioSupport`). The
   * gantry over the graded lane is a marker of it, so below `full` it is not
   * put up; the junction, the sign and everything solid are.
   */
  showsResponse: boolean
): SceneNode[] => {
  const { event, screenY, roadX, handled } = placement;
  const { correctAction, maneuver } = event;
  const laneReq = maneuver ?? event.requiredLane;
  const roadRight = roadX + ROAD_WIDTH;
  const vergeRight = Math.min(
    CANVAS_WIDTH - SIGN_HALF_WIDTH,
    roadRight + auxiliaryWidth + 32
  );
  const vergeLeft = Math.max(SIGN_HALF_WIDTH, roadX - 32);

  const nodes: SceneNode[] = [];
  const signAt = (x: number, y: number) =>
    nodes.push({ kind: 'sign', x, y, plate: sign, cleared: handled });
  const turnLaneAt = (y: number) => {
    if (laneReq && showsResponse) {
      nodes.push({
        kind: 'road-marking',
        marking: { mark: 'turn-lane', screenY: y, lane: resolveLaneRole(laneReq.lane, oncomingLanes) },
      });
    }
  };
  const situation = (
    situationNode: Extract<SceneNode, { kind: 'road-situation' }>['situation'],
    solids?: SceneNode['solids']
  ) => nodes.push({ kind: 'road-situation', situation: situationNode, ...(solids ? { solids } : {}) });

  switch (scene) {
    case 'intersection': {
      // A turn is made from a stop line for the same reason a stop is: the
      // driver has to have arrived before deciding.
      const wantsStop = correctAction === 'stop' || Boolean(maneuver);
      nodes.push(
        junctionNode({
          roadX,
          screenY,
          control: wantsStop ? 'stop' : 'give-way',
          crossTraffic: true,
        })
      );
      const junction = intersectionGeometry(screenY);
      turnLaneAt(junction.stopLineY);
      signAt(vergeRight, junction.stopLineY - 30);
      break;
    }

    case 'signal': {
      // Declared people suppress the stock waiting car: a junction whose
      // question is about pedestrians still in the crossing should not also
      // have a prop vehicle competing for the driver's attention.
      const people = event.pedestrians ?? [];
      nodes.push(
        junctionNode({
          roadX,
          screenY,
          control: 'stop',
          crosswalk: true,
          crossTraffic: people.length === 0 && !event.npc,
        })
      );
      const junction = intersectionGeometry(screenY);
      turnLaneAt(junction.stopLineY);
      // On the curb beside the junction, so the mast stands on the verge
      // rather than dropping through the carriageway.
      signAt(roadRight + 18, junction.boxBottom - 40);
      if (people.length > 0) {
        // People the event declares are standing on the stripes the junction
        // paints. Without them a variant whose whole question is "people are
        // still in the junction" would be driveable straight through.
        nodes.push(pedestrianGroupNode(roadX, junction.boxBottom + 11, people));
      }
      break;
    }

    case 'side_road': {
      const branch = branchSideFor(event);
      nodes.push(junctionNode({ roadX, screenY, control: 'give-way', side: branch }));
      const junction = intersectionGeometry(screenY);
      turnLaneAt(junction.stopLineY);
      // Planted on the side street it governs, so the sign and the road it
      // refers to are on the same side of the carriageway.
      signAt(branch === 'right' ? vergeRight : vergeLeft, junction.boxBottom + 6);
      break;
    }

    case 'crosswalk':
      nodes.push({
        kind: 'crossing',
        style: 'regular',
        roadX,
        screenY,
        cleared: handled,
        // Who is waiting comes from the scenario, never from the sign: an
        // asset filename must not be able to move the world.
        ...(event.pedestrians?.[0] ? { pedestrian: event.pedestrians[0].kind } : {}),
      });
      signAt(vergeRight, screenY + 6);
      break;

    case 'bend':
      // Lane arrows on the road itself, marking the inside line to hold.
      turnLaneAt(screenY + 8);
      situation({ situation: 'bend', screenY });
      if (sign.art !== 'chevron') signAt(vergeLeft, screenY - 4);
      break;

    case 'roadwork': {
      const work = roadworkGeometry(roadX, screenY);
      situation({ situation: 'roadwork', roadX, screenY }, [
        bodyRect(
          work.barrier.x,
          work.barrier.y,
          work.barrier.width,
          work.barrier.height,
          'obstruction',
          'a road closure barrier'
        ),
        ...work.cones.map(cone =>
          bodyAt(cone.x, cone.y + 4, 16, 20, 'obstruction', 'a traffic cone marking the work zone')
        ),
      ]);
      if (sign.art !== 'obstruction') signAt(vergeLeft, screenY + 26);
      break;
    }

    case 'railway':
      situation({ situation: 'railway', roadX, screenY });
      signAt(vergeRight, screenY - 4);
      break;

    case 'junction_t':
      situation({ situation: 't-junction', roadX, screenY });
      // A road that ends has to say which lane turns which way, or the driver
      // only finds out at the point where they can no longer act on it.
      turnLaneAt(screenY + 8);
      signAt(vergeRight, screenY + 6);
      break;

    case 'merge': {
      const { car } = mergeLaneGeometry(roadX, screenY);
      situation({ situation: 'merge', roadX, screenY }, [
        bodyAt(car.x, car.y, 32, 44, 'vehicle', 'a vehicle merging into your lane'),
      ]);
      signAt(vergeLeft, screenY);
      break;
    }

    case 'hump':
      situation({ situation: 'hump', roadX, screenY });
      signAt(vergeRight, screenY - 46);
      break;

    case 'uneven':
      situation({ situation: 'uneven', roadX, screenY });
      signAt(vergeRight, screenY - 46);
      break;

    case 'wet':
      situation({ situation: 'wet', roadX, screenY });
      signAt(vergeRight, screenY - 40);
      break;

    case 'flood':
      situation({ situation: 'flood', screenY });
      signAt(vergeRight, screenY - 74);
      break;

    case 'gradient_up':
    case 'gradient_down':
      situation({
        situation: 'gradient',
        roadX,
        screenY,
        slope: scene === 'gradient_up' ? 'up' : 'down',
      });
      signAt(vergeRight, screenY - 20);
      break;

    case 'narrows':
      situation({ situation: 'narrows', roadX, screenY });
      signAt(vergeRight, screenY + 40);
      break;

    case 'divided_start':
    case 'divided_end':
      situation({
        situation: 'median',
        roadX,
        screenY,
        phase: scene === 'divided_start' ? 'start' : 'end',
      });
      signAt(vergeRight, screenY + 20);
      break;

    case 'bridge':
      situation({ situation: 'bridge', roadX, screenY });
      signAt(vergeRight, screenY + 60);
      break;

    case 'two_way': {
      const oncoming = twoWayOncomingPoint(roadX, screenY);
      situation({ situation: 'two-way', roadX, screenY }, [
        bodyAt(oncoming.x, oncoming.y, 30, 52, 'vehicle', 'an oncoming vehicle'),
      ]);
      signAt(vergeRight, screenY + 20);
      break;
    }

    case 'animal':
      situation({ situation: 'animal', x: roadX + ROAD_WIDTH - 52, y: screenY - 6 }, [
        bodyAt(roadX + ROAD_WIDTH - 52, screenY - 6, 56, 26, 'obstruction', 'an animal in the road'),
      ]);
      signAt(vergeLeft, screenY - 30);
      break;

    case 'rockfall':
      situation(
        { situation: 'rockfall', roadX, screenY },
        rockfallPositions(roadX, screenY).map(rock =>
          bodyAt(rock.x, rock.y, rock.radius * 2, rock.radius * 1.7, 'obstruction', 'a fallen rock in the road')
        )
      );
      signAt(vergeRight, screenY - 20);
      break;

    case 'lay_by':
      if (event.bay) {
        nodes.push({
          kind: 'road-marking',
          marking: { mark: 'pull-over-bay', roadX, screenY, bay: event.bay },
        });
      }
      // Beyond the bay, so the sign never sits on the space it governs.
      signAt(
        event.bay?.side === 'left' ? roadX - BAY_WIDTH - 26 : roadX + ROAD_WIDTH + BAY_WIDTH + 26,
        screenY - 8
      );
      break;

    case 'open_road':
      turnLaneAt(screenY + 8);
      signAt(vergeRight, screenY);
      break;

    case 'route':
      // The road here is the one the level's own `RouteLayout` describes, drawn
      // once for the whole route rather than re-invented per event. The sign is
      // the only thing this event adds: its plate, on the verge, beside a
      // carriageway that already exists.
      signAt(vergeRight, screenY);
      break;
  }

  return nodes;
};
