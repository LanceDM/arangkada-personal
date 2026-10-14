/**
 * Scene nodes, painted.
 *
 * A registry rather than a switch over scenarios: each node kind names the
 * category renderer that draws it, and nothing here reads a `ScenarioEvent` or
 * decides where anything stands. The scene was composed by `domain/scene`
 * before this ran, so the picture cannot move the simulation and collision does
 * not depend on anything here having happened.
 *
 * Nodes arrive in painter order and are painted in that order.
 */
import type {
  RoadFurniture,
  RoadMarking,
  RoadSituation,
  SceneNode,
  VehicleFailure,
} from '@/features/driving-sim/domain/scene/SceneNode';
import { assertNever } from '@/shared/lib/assertNever';
import { CANVAS_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { RoadAt } from '@/features/driving-sim/domain/world/eventPlacement';
import {
  drawChevron,
  drawCrossingApproach,
  drawCrossingCar,
  drawFireHydrant,
  drawHazardGlyph,
  drawIntersection,
  drawLaneArrow,
  drawOncomingVehicle,
  drawOvertakingBarrier,
  drawRoadsideSign,
  drawTrafficCone,
  hatchWedge,
  paintAcross,
  paintAlong,
  paintLegend,
} from './renderPrimitives';
import {
  drawChevronIsland,
  drawConcreteBarriers,
  drawConeTaper,
  drawIslandApproach,
  drawLanePaint,
  drawPaintedCurb,
  drawParkingBay,
  drawYellowBoxMarking,
} from './renderers/markingRenderer';
import { drawDrivewayMouth, drawSignalizedCrossing, drawZebraCrossing } from './renderers/crossingRenderer';
import { drawCheckpointOfficer, drawCrossingPedestrians } from './renderers/pedestrianRenderer';
import {
  drawCrossStreet,
  drawExitGore,
  drawMainRoadJunction,
  drawMergeArrows,
  drawMergeLane,
  drawMergeTaper,
  drawLaneSeparator,
  drawOverheadGantry,
  drawRoundaboutScene,
  drawTJunction,
  drawTollPlaza,
  drawTurnLaneMarkings,
  drawTurnPath,
} from './renderers/junctionRenderer';
import {
  drawBendScene,
  drawBlowoutDebris,
  drawBridge,
  drawFloodWater,
  drawGradient,
  drawHump,
  drawMedian,
  drawNarrowing,
  drawRailwayCrossing,
  drawRailwayPavementMarking,
  drawRoadworkScene,
  drawCrashScene,
  drawRockfall,
  drawRumbleStrips,
  drawTwoWayTraffic,
  drawUnevenSurface,
  drawWetRoad,
} from './renderers/roadConditionRenderer';
import {
  drawNoEntryRoadSign,
  drawSignFace,
  drawSpeedLimitSign,
  drawStopRoadSign,
  drawTrafficSignal,
  drawWarningRoadSign,
  drawYieldRoadSign,
} from './renderers/roadFurnitureRenderer';
import { drawRearViewMirror, drawSirenGlow } from './renderers/effectRenderer';
import { ROAD_ACTOR_SPRITES } from './roadActorSprites';
import { ROAD_ACTORS } from '@/features/driving-sim/domain/world/roadActors';
import { drawCheckpointScene, drawPullOverBay, drawTrafficStopScene } from './renderers/checkpointRenderer';
import { drawAnimal, drawComplianceIcon, drawHazardLamps, drawJeepney } from './renderers/vehicleRenderer';
import { drawScriptedVehicle } from './renderers/scriptedVehicleRenderer';

const paintFurniture = (ctx: CanvasRenderingContext2D, item: RoadFurniture): void => {
  switch (item.furniture) {
    case 'stop-sign':
      drawStopRoadSign(ctx, item.x, item.y);
      break;
    case 'yield-sign':
      drawYieldRoadSign(ctx, item.x, item.y);
      break;
    case 'no-entry-sign':
      drawNoEntryRoadSign(ctx, item.x, item.y);
      break;
    case 'warning-sign':
      drawWarningRoadSign(ctx, item.x, item.y, item.legend ?? '!');
      break;
    case 'speed-limit':
      drawSpeedLimitSign(ctx, item.x, item.y, item.limit);
      break;
    case 'roadside-sign':
      drawRoadsideSign(ctx, item.x, item.y, item.top, item.bottom, item.color);
      break;
    case 'chevron':
      drawChevron(ctx, item.x, item.y);
      break;
    case 'traffic-cone':
      drawTrafficCone(ctx, item.x, item.y, item.scale);
      break;
    case 'fire-hydrant':
      drawFireHydrant(ctx, item.x, item.y);
      break;
    case 'compliance-icon':
      drawComplianceIcon(ctx, item.x, item.y, item.glyph, item.color);
      break;
    case 'checkpoint-officer':
      drawCheckpointOfficer(ctx, item.x, item.y, item.scale);
      break;
    default:
      assertNever(item, 'road furniture');
  }
};

const paintSituation = (
  ctx: CanvasRenderingContext2D,
  situation: RoadSituation,
  roadAt: RoadAt
): void => {
  switch (situation.situation) {
    case 'bend':
      drawBendScene(ctx, roadAt, situation.screenY);
      break;
    case 'roadwork':
      drawRoadworkScene(ctx, situation.roadX, situation.screenY);
      break;
    case 'railway':
      drawRailwayCrossing(ctx, situation.roadX, situation.screenY);
      break;
    case 't-junction':
      drawTJunction(ctx, situation.roadX, situation.screenY);
      break;
    case 'merge':
      drawMergeLane(ctx, situation.roadX, situation.screenY);
      break;
    case 'hump':
      drawHump(ctx, situation.roadX, situation.screenY);
      break;
    case 'uneven':
      drawUnevenSurface(ctx, situation.roadX, situation.screenY);
      break;
    case 'wet':
      drawWetRoad(ctx, situation.roadX, situation.screenY);
      break;
    case 'flood':
      drawFloodWater(ctx, situation.screenY);
      break;
    case 'gradient':
      drawGradient(ctx, situation.roadX, situation.screenY, situation.slope);
      break;
    case 'narrows':
      drawNarrowing(ctx, situation.roadX, situation.screenY);
      break;
    case 'median':
      drawMedian(ctx, situation.roadX, situation.screenY, situation.phase);
      break;
    case 'bridge':
      drawBridge(ctx, situation.roadX, situation.screenY);
      break;
    case 'two-way':
      drawTwoWayTraffic(ctx, situation.roadX, situation.screenY);
      break;
    case 'animal':
      drawAnimal(ctx, situation.x, situation.y);
      break;
    case 'rockfall':
      drawRockfall(ctx, situation.roadX, situation.screenY);
      break;
    case 'crash-scene':
      drawCrashScene(ctx, situation.roadX, situation.screenY);
      break;
    default:
      assertNever(situation, 'road situation');
  }
};

const paintMarking = (
  ctx: CanvasRenderingContext2D,
  marking: RoadMarking,
  roadAt: RoadAt
): void => {
  switch (marking.mark) {
    case 'along':
      paintAlong(ctx, roadAt, marking.topY, marking.bottomY, marking.offset, marking.stroke);
      break;
    case 'across':
      paintAcross(ctx, roadAt(marking.y), marking.y, marking.stroke);
      break;
    case 'hatch-wedge':
      hatchWedge(ctx, roadAt, marking.topY, marking.bottomY, marking.side);
      break;
    case 'island-approach':
      drawIslandApproach(ctx, roadAt, marking.screenY, marking.oncomingLanes);
      break;
    case 'turn-lane':
      drawTurnLaneMarkings(ctx, roadAt, marking.screenY, marking.lane);
      break;
    case 'chevron-island':
      drawChevronIsland(ctx, roadAt, marking.topY, marking.bottomY, marking.oncomingLanes, marking.lane);
      break;
    case 'parking-bay':
      drawParkingBay(ctx, marking.roadX, marking.screenY);
      break;
    case 'pull-over-bay':
      drawPullOverBay(ctx, marking.roadX, marking.screenY, marking.bay);
      break;
    case 'painted-curb':
      drawPaintedCurb(ctx, marking.roadX, marking.screenY, marking.color);
      break;
    case 'rumble-strips':
      drawRumbleStrips(ctx, roadAt, marking.topY, marking.bottomY);
      break;
    case 'railway-pavement':
      drawRailwayPavementMarking(ctx, marking.roadX, marking.screenY);
      break;
    case 'lane-arrow':
      if (marking.scale === undefined) {
        drawLaneArrow(ctx, marking.x, marking.y, marking.direction, marking.color);
        break;
      }
      ctx.save();
      ctx.translate(marking.x, marking.y);
      ctx.scale(marking.scale, marking.scale);
      drawLaneArrow(ctx, 0, 0, marking.direction, marking.color);
      ctx.restore();
      break;
    case 'legend':
      paintLegend(ctx, marking.x, marking.y, marking.text, marking.size);
      break;
    case 'turn-path':
      ctx.save();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 8]);
      ctx.beginPath();
      ctx.moveTo(marking.from.x, marking.from.y);
      ctx.quadraticCurveTo(marking.control.x, marking.control.y, marking.to.x, marking.to.y);
      ctx.stroke();
      ctx.restore();
      break;
    default:
      assertNever(marking, 'road marking');
  }
};

/** The floating label over a checkpoint, sized to its own text. */
const paintCheckpointLabel = (
  ctx: CanvasRenderingContext2D,
  label: string,
  screenY: number
): void => {
  ctx.font = 'bold 10px Inter';
  ctx.textAlign = 'center';
  const labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(CANVAS_WIDTH / 2 - labelWidth / 2 - 8, screenY - 62, labelWidth + 16, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#f0c929';
  ctx.fillText(label, CANVAS_WIDTH / 2, screenY - 49);
};

const paintVehicleFailure = (
  ctx: CanvasRenderingContext2D,
  failure: VehicleFailure,
  roadX: number,
  screenY: number
): void => {
  switch (failure) {
    case 'blowout':
      drawBlowoutDebris(ctx, roadX, screenY);
      break;
    case 'skid':
      // The polished, wet surface the traction went on.
      drawWetRoad(ctx, roadX, screenY);
      break;
    case 'brake_loss':
      drawGradient(ctx, roadX, screenY, 'down');
      break;
    case 'jammed_pedal':
      // Nothing. The road is fine; the pedal is not.
      break;
    default:
      assertNever(failure, 'vehicle failure');
  }
};

const paintLaneTreatment = (
  ctx: CanvasRenderingContext2D,
  paint: Extract<SceneNode, { kind: 'lane-paint' }>['paint'],
  roadX: number,
  screenY: number
): void => {
  switch (paint) {
    case 'yellow_box':
      drawYellowBoxMarking(ctx, roadX, screenY);
      break;
    case 'mc_lane':
      drawLanePaint(ctx, roadX, screenY, 'MC LANE', '#2563eb', true);
      break;
    case 'bike_lane':
      drawLanePaint(ctx, roadX, screenY, 'BIKE LANE', '#2563eb', true);
      break;
    case 'bus_lane':
      drawLanePaint(ctx, roadX, screenY, 'BUS LANE', '#f59e0b', false);
      break;
    case 'parking_bay':
      drawParkingBay(ctx, roadX, screenY);
      break;
    case 'red_curb':
      drawPaintedCurb(ctx, roadX, screenY, '#dc2626');
      break;
    case 'yellow_curb':
      drawPaintedCurb(ctx, roadX, screenY, '#eab308');
      break;
    case 'generic_lane':
      drawLanePaint(ctx, roadX, screenY, 'LANE', '#ffffff', false);
      break;
    default:
      assertNever(paint, 'lane paint');
  }
};

/**
 * The one thing painting a scene depends on that a node cannot carry: where
 * the road is at any screen row, so paint runs with the same bend the scene was
 * placed against. Everything else, a node carries.
 */
const renderNode = (ctx: CanvasRenderingContext2D, node: SceneNode, roadAt: RoadAt): void => {
  switch (node.kind) {
    case 'road-marking':
      paintMarking(ctx, node.marking, roadAt);
      break;
    case 'junction': {
      const { shape } = node;
      drawIntersection(ctx, shape.roadX, shape.screenY, {
        ...(shape.side ? { side: shape.side } : {}),
        ...(shape.crossTraffic ? { crossTraffic: true } : {}),
        ...(shape.control === 'stop' ? { stopLine: true } : {}),
        ...(shape.control === 'give-way' ? { giveWayLine: true } : {}),
        ...(shape.crosswalk ? { crosswalk: true } : {}),
      });
      // Over the junction it belongs to, never as a node standing beside it:
      // the guide has to be painted on the box it crosses.
      if (shape.turnPath) {
        const { geometry, direction, lane } = shape.turnPath;
        drawTurnPath(ctx, shape.roadX, shape.screenY, geometry, direction, lane);
      }
      break;
    }
    case 'crossing':
      if (node.style === 'signalized') {
        drawSignalizedCrossing(ctx, node.roadX, node.screenY, node.cleared, node.walker);
      } else {
        drawZebraCrossing(ctx, node.roadX, node.screenY, node.pedestrian ?? 'adult');
      }
      break;
    case 'pedestrian-group':
      drawCrossingPedestrians(ctx, node.roadX, node.y, node.people);
      break;
    case 'sign':
      drawSignFace(ctx, node.x, node.y, node.plate, node.cleared);
      break;
    case 'road-situation':
      paintSituation(ctx, node.situation, roadAt);
      break;
    case 'checkpoint':
      drawCheckpointScene(ctx, node.roadX, node.screenY);
      if (node.label) paintCheckpointLabel(ctx, node.label, node.screenY);
      break;
    case 'traffic-stop':
      drawTrafficStopScene(ctx, node.roadX, node.screenY);
      break;
    case 'vehicle-failure':
      paintVehicleFailure(ctx, node.failure, node.roadX, node.screenY);
      break;
    case 'traffic-signal':
      drawTrafficSignal(ctx, node.x, node.y, node.aspect, node.mast ? { mast: true } : undefined);
      break;
    case 'road-furniture':
      paintFurniture(ctx, node.furniture);
      break;
    case 'crossing-approach':
      drawCrossingApproach(ctx, node.roadX, node.y, node.height);
      break;
    case 'driveway-mouth':
      drawDrivewayMouth(ctx, node.roadX, node.screenY, node.walkedOff);
      break;
    case 'road-actor': {
      const sprite = ROAD_ACTOR_SPRITES[node.actor.kind];
      sprite.draw(ctx, node.x, node.y);
      sprite.overlay?.(ctx, node.x, node.y);
      // Declared by the scenario, never inferred: a vehicle whose hazards are
      // the cue the driver is being graded on reading has to show them.
      if (node.actor.hazards) {
        const body = ROAD_ACTORS[node.actor.kind];
        drawHazardLamps(ctx, node.x, node.y + body.height / 2, node.y - body.height / 2, body.width / 2);
      }
      break;
    }
    case 'hazard-glyph':
      drawHazardGlyph(ctx, node.x, node.y, node.alpha);
      break;
    case 'lane-paint':
      paintLaneTreatment(ctx, node.paint, node.roadX, node.screenY);
      break;
    case 'merge-arrows':
      drawMergeArrows(ctx, node.roadX, node.screenY);
      break;
    case 'overhead-gantry':
      drawOverheadGantry(ctx, node.roadX, node.screenY, node.panels);
      break;
    case 'exit-gore':
      drawExitGore(ctx, node.roadX, node.screenY, node.exitLane);
      break;
    case 'merge-taper':
      drawMergeTaper(ctx, node.roadX, node.screenY, node.width);
      break;
    case 'lane-separator':
      drawLaneSeparator(ctx, node.roadX, node.screenY, node.offsetX, node.width, node.separator);
      break;
    case 'toll-plaza':
      drawTollPlaza(ctx, node.roadX, node.screenY, node.openLane);
      break;
    case 'overtaking-barrier':
      drawOvertakingBarrier(ctx, node.roadX, node.screenY);
      break;
    case 'roundabout':
      drawRoundaboutScene(ctx, node.roadX, node.screenY);
      break;
    case 'cross-street':
      drawCrossStreet(ctx, node.screenY);
      break;
    case 'main-road-junction':
      drawMainRoadJunction(ctx, node.roadX, node.screenY, node.traffic);
      break;
    case 'siren-alert':
      drawSirenGlow(ctx, node.proximity);
      drawRearViewMirror(ctx, node.roadX, node.npcX, node.proximity, node.vehicle);
      break;
    case 'rear-view':
      drawRearViewMirror(ctx, node.roadX, node.npcX, node.proximity, node.vehicle);
      break;
    case 'cone-taper':
      drawConeTaper(ctx, roadAt, node.topY, node.bottomY, node.side);
      break;
    case 'concrete-barrier':
      drawConcreteBarriers(ctx, roadAt, node.screenY, node.side);
      break;
    case 'static-vehicle':
      if (node.vehicle === 'jeepney') drawJeepney(ctx, node.x, node.y, node.scale ?? 1);
      else if (node.vehicle === 'oncoming') drawOncomingVehicle(ctx, node.x, node.y, node.scale ?? 1);
      else drawCrossingCar(ctx, node.x, node.y, node.color ?? '#dc2626');
      break;
    case 'scripted-vehicle':
      drawScriptedVehicle(ctx, node.npc, node.role, node.at);
      break;
    default:
      assertNever(node, 'scene node');
  }
};

export const renderScene = (
  ctx: CanvasRenderingContext2D,
  nodes: readonly SceneNode[],
  roadAt: RoadAt
): void => {
  for (const node of nodes) renderNode(ctx, node, roadAt);
};
