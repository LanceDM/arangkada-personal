/**
 * Every level's road and every scenario a drive can put on it, as one table of
 * the numbers the game runs on: where it stands, how far ahead it announces
 * itself, the speed limit and any posted speed, every target it is graded
 * against, and where it comes from (the level's own road, a pool slot, a
 * garage or crash-scene point, or borrowed from an earlier stage). For the
 * admin's Scenarios page (2026-11-10), so the configuration can be read
 * without opening the level files.
 *
 * Distances along the road are given in the game's route units and in metres
 * on the speed scale: at a level's pace, a car at v km/h covers
 * 60 · v · distancePerSpeed units a second, which is v / 3.6 m/s, so a metre
 * is 216 · distancePerSpeed units (10.8 at the default pace). Seconds at the
 * limit are the same distance over the level's speed limit.
 *
 * Ported from the groupmate's repository (arangkada-personal, 2026-11-16).
 * It reads content and changes nothing: the player's screens are untouched.
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import { paceOf } from '@/features/driving-sim/domain/world/DrivingPace';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import { speedFor, speedTarget, speedTargetText } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import { UNITS_PER_METER } from '@/features/driving-sim/domain/world/routeGeometry';
import { CRAWL_SPEED_SHARE } from '@/features/driving-sim/domain/systems/standingPenalties';
import { timeLimitSecondsFor } from './levelTimeLimits';
import { getPooledSlots, LEVELS } from './levelCatalog';
import { poolFor, type PoolEntry } from './composeDrive';
import { hotspotScenarioId } from './hotspotScenarioId';
import { scenarioSupport } from './scenarioSupport';
import type { GarageHotspot, LevelConfig, ScenarioEvent } from './scenarioDefinition';

export interface LevelConfigRow {
  id: number;
  name: string;
  roadClass: string;
  speedLimit: number;
  roadLengthUnits: number;
  roadLengthM: number;
  /** Seconds to drive the road at the speed limit, without stops. */
  secondsAtLimit: number;
  timeLimitS: number | null;
  requiredScore: number;
  roadEvents: number;
  garageChecks: number;
  aftermathChecks: number;
  /** Metres per route unit on this level's speed scale. */
  metresPerUnit: number;
}

export interface ScenarioConfigRow {
  levelId: number;
  id: string;
  label: string;
  competency: string | null;
  /** Where the scenario sits: on the road, in the garage before it, or at the crash scene after it. */
  place: 'road' | 'garage' | 'aftermath';
  /** On this level's own roll, a pool slot, a stage extra, or borrowed from an earlier stage. */
  source: string;
  type: string;
  /** How it is answered: by driving, by a multiple-choice question, or by inspecting a document. */
  answeredBy: 'driving' | 'question' | 'inspection';
  correctAction: string;
  /** Road position and announcement, for road scenarios. */
  atUnits: number | null;
  atM: number | null;
  warningM: number | null;
  /** Seconds of warning at the speed limit. */
  warningS: number | null;
  speedLimit: number;
  /** A posted speed that differs from the road's limit. */
  postedSpeed: number | null;
  /** The speed the scenario applies (posted, else the limit). */
  appliesSpeed: number;
  /**
   * Every number it is graded against, read from the fields the grader reads.
   * The player's instruction names only the speed target, at h = full.
   */
  targets: string[];
  instruction: string;
  description: string;
  severity: string | null;
  points: number;
  lawCitation: string | null;
}

const metreText = (m: number): string => (m < 10 ? `${Math.round(m * 10) / 10} m` : `${Math.round(m)} m`);
const metres = (units: number): string => metreText(units / UNITS_PER_METER);
/** Metres across the road from canvas pixels: the car is drawn half a pixel per route unit. */
const metresAcross = (px: number): string => metreText(px / (UNITS_PER_METER / 2));

/** Every number a scenario is graded against, as short target sentences. Empty where nothing numeric decides it. */
export const gradedTargets = (event: ScenarioEvent, level: LevelConfig): string[] => {
  const out: string[] = [];
  const target = speedTarget(event, level);
  if (target) out.push(`Target: ${speedTargetText(target)}.`);
  if (event.maneuver?.maxSpeed !== undefined) out.push(`Target: make the turn at ${Math.round(event.maneuver.maxSpeed)} km/h or less.`);
  if (event.following) out.push(`Target: at least ${event.following.seconds} seconds behind the vehicle ahead, the whole way through.`);
  if (event.lineHold) {
    const side = event.lineHold.toward ? ` toward the ${event.lineHold.toward}` : '';
    out.push(`Target: drift no more than ${metresAcross(event.lineHold.maxDrift)} sideways${side} while it lasts.`);
  }
  if (event.coast) out.push(`Target: no long brake above ${Math.round(event.coast.brakeBelow)} km/h (taps are fine); at or below it, brake to a stop.`);
  if (event.effect?.stuckThrottle) out.push(`Target: hold the brake until the speed is ${Math.round(level.speedLimit * CRAWL_SPEED_SHARE)} km/h or less.`);
  if (event.merge) out.push(`Target: at least ${Math.round(event.merge.minSpeed)} km/h, and at least ${event.merge.safeGapSeconds} seconds behind the car you join.`);
  if (event.overtake) out.push(`Target: be ${metres(event.overtake.clearBy)} past the vehicle before you move back.`);
  if (event.noStandingWithin !== undefined) out.push(`Target: do not come to rest within ${metres(event.noStandingWithin * UNITS_PER_METER)} of it.`);
  return out;
};

const UNITS_PER_METRE_AT = (level: LevelConfig) => 216 * paceOf(level).distancePerSpeed;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const levelConfigRows = (): LevelConfigRow[] =>
  LEVELS.map(level => {
    const perMetre = UNITS_PER_METRE_AT(level);
    return {
      id: level.id,
      name: level.name,
      roadClass: level.roadClass,
      speedLimit: level.speedLimit,
      roadLengthUnits: level.roadLength,
      roadLengthM: Math.round(level.roadLength / perMetre),
      secondsAtLimit: Math.round(level.roadLength / (60 * level.speedLimit * paceOf(level).distancePerSpeed)),
      timeLimitS: timeLimitSecondsFor(level.id),
      requiredScore: level.requiredScore,
      roadEvents: level.events.length,
      garageChecks: level.garage?.hotspots.length ?? 0,
      aftermathChecks: level.aftermath?.hotspots.length ?? 0,
      metresPerUnit: round1(1 / perMetre * 100) / 100,
    };
  });

const roadRow = (level: LevelConfig, event: ScenarioEvent, source: string, warning: number | null): ScenarioConfigRow => {
  const perMetre = UNITS_PER_METRE_AT(level);
  const applies = speedFor(event, level);
  const shown = scenarioSupport(event, 'full', level);
  const placed = event.triggerAtDistance > 0;
  return {
    levelId: level.id,
    id: event.id,
    label: event.label ?? event.id.split('.').slice(-1)[0],
    competency: event.competency ?? null,
    place: 'road',
    source,
    type: event.type,
    answeredBy: event.inspection ? 'inspection' : event.choices?.length ? 'question' : 'driving',
    correctAction: event.correctAction,
    atUnits: placed ? event.triggerAtDistance : null,
    atM: placed ? Math.round(event.triggerAtDistance / perMetre) : null,
    warningM: warning !== null ? Math.round(warning / perMetre) : null,
    warningS: warning !== null ? round1(warning / (60 * level.speedLimit * paceOf(level).distancePerSpeed)) : null,
    speedLimit: level.speedLimit,
    postedSpeed: event.postedSpeed ?? null,
    appliesSpeed: applies,
    targets: gradedTargets(event, level),
    instruction: shown.instruction ?? '',
    description: event.description,
    severity: event.severity ?? null,
    points: event.points,
    lawCitation: event.lawCitation ?? null,
  };
};

const pointRow = (level: LevelConfig, point: GarageHotspot, place: 'garage' | 'aftermath', source: string): ScenarioConfigRow => ({
  levelId: level.id,
  id: hotspotScenarioId(point),
  label: point.label,
  competency: point.competency ?? null,
  place,
  source,
  type: 'question',
  answeredBy: point.document ? 'inspection' : 'question',
  correctAction: point.correctAction,
  atUnits: null,
  atM: null,
  warningM: null,
  warningS: null,
  speedLimit: level.speedLimit,
  postedSpeed: null,
  appliesSpeed: level.speedLimit,
  targets: [],
  instruction: point.question,
  description: point.observation,
  severity: point.severity ?? null,
  points: point.points,
  lawCitation: point.lawCitation ?? null,
});

const sourceOf = (entry: PoolEntry): string =>
  entry.source === 'slot'
    ? `pool slot ${(entry.slot ?? 0) + 1}`
    : entry.source === 'borrowed'
      ? `borrowed from Level ${entry.sourceLevelId}`
      : entry.source === 'stage_extra'
        ? 'stage extra'
        : entry.source;

/**
 * Every scenario, level by level: the level's own road as rolled, then every
 * variant its pools and its course drives can draw, each once.
 */
export const scenarioConfigRows = (): ScenarioConfigRow[] => {
  const rows: ScenarioConfigRow[] = [];
  for (const level of LEVELS) {
    const seen = new Set<string>();
    const warnings = computeWarningDistances(level.events);
    for (const event of level.events) {
      seen.add(event.id);
      rows.push(roadRow(level, event, 'level road', warnings.get(event.triggerAtDistance) ?? null));
    }
    for (const point of level.garage?.hotspots ?? []) {
      const id = hotspotScenarioId(point);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(pointRow(level, point, level.garage?.scene === 'crash_scene' ? 'aftermath' : 'garage', 'level garage'));
    }
    for (const point of level.aftermath?.hotspots ?? []) {
      const id = hotspotScenarioId(point);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(pointRow(level, point, 'aftermath', 'level crash scene'));
    }
    for (const competency of COMPETENCIES) {
      for (const entry of poolFor(level.id, competency)) {
        if (seen.has(entry.scenarioId)) continue;
        seen.add(entry.scenarioId);
        if ('area' in entry.scenario) {
          rows.push(pointRow(level, entry.scenario as GarageHotspot, entry.source === 'aftermath' ? 'aftermath' : 'garage', sourceOf(entry)));
        } else {
          const event = { triggerAtDistance: 0, ...entry.scenario } as ScenarioEvent;
          rows.push(roadRow(level, event, sourceOf(entry), event.warningDistance ?? null));
        }
      }
    }
    // Kept in the code, never played: the road does not draw their situation
    // (`offRoad`). Listed so the team can see them, labelled as not in play.
    for (const pool of getPooledSlots(level.id)?.slots ?? []) {
      for (const variant of pool.filter(entry => entry.offRoad)) {
        if (seen.has(variant.id)) continue;
        seen.add(variant.id);
        const event = { triggerAtDistance: 0, ...variant } as ScenarioEvent;
        rows.push(roadRow(level, event, NOT_IN_PLAY, event.warningDistance ?? null));
      }
    }
  }
  return rows;
};

/** The source a scenario the road does not draw is listed under. */
export const NOT_IN_PLAY = 'not in play (the road does not draw it)';
