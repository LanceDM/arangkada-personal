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
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import { paceOf } from '@/features/driving-sim/domain/world/DrivingPace';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import { speedFor } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import { timeLimitSecondsFor } from './levelTimeLimits';
import { LEVELS } from './levelCatalog';
import { poolFor, type PoolEntry } from './composeDrive';
import { scenarioSupport, scenarioTargets } from './scenarioSupport';
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
  targets: string[];
  instruction: string;
  description: string;
  severity: string | null;
  points: number;
  lawCitation: string | null;
}

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
    targets: scenarioTargets(event, level),
    instruction: shown.instruction ?? '',
    description: event.description,
    severity: event.severity ?? null,
    points: event.points,
    lawCitation: event.lawCitation ?? null,
  };
};

const pointRow = (level: LevelConfig, point: GarageHotspot, place: 'garage' | 'aftermath', source: string): ScenarioConfigRow => ({
  levelId: level.id,
  id: point.scenarioId ?? point.id,
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
      const id = point.scenarioId ?? point.id;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(pointRow(level, point, level.garage?.scene === 'crash_scene' ? 'aftermath' : 'garage', 'level garage'));
    }
    for (const point of level.aftermath?.hotspots ?? []) {
      const id = point.scenarioId ?? point.id;
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
  }
  return rows;
};
