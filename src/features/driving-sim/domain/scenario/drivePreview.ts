/**
 * What a drive holds, shown before it starts: the setting (the road, its speed
 * limit, its conditions, the stages before and after) and every scenario in
 * the order it will be met, with its title, its situation, its competency and
 * its format. The answer is never part of it: no correct action, no
 * recommended move, no question.
 */
import { getCompetencyLabel } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { scenarioLabel } from './scenarioCopy';
import type { GarageStage, LevelConfig, ScenarioEvent } from './scenarioDefinition';
import { SCENARIO_FORMAT_LABEL, TIMED_FORMATS, scenarioFormat, type ScenarioFormat } from './scenarioFormat';

export interface PreviewScenario {
  id: string;
  order: number;
  stage: 'garage' | 'road' | 'aftermath';
  title: string;
  description: string;
  competency: DrivingCompetency | null;
  competencyLabel: string | null;
  format: ScenarioFormat;
  formatLabel: string;
  /** The question runs on the in-drive time limit. */
  timed: boolean;
  /** Counted toward a competency's verdict in this drive (a course drive's 3 per competency). */
  counted: boolean;
}

export interface DrivePreview {
  setting: {
    name: string;
    description: string;
    speedLimit: number;
    roadEvents: number;
    /** Plain words for how the road behaves: a slippery stretch, a hump, a narrowing. */
    conditions: string[];
    garage: { plate: string; intro: string; points: number } | null;
    aftermath: { plate: string; intro: string; points: number } | null;
  };
  scenarios: PreviewScenario[];
}

const conditionsOf = (events: readonly ScenarioEvent[]): string[] => {
  const found = new Set<string>();
  for (const event of events) {
    const effect = event.effect;
    if (!effect) continue;
    if (effect.grip !== undefined && effect.grip < 1) found.add('Slippery stretch: longer braking');
    if (effect.gradient !== undefined && effect.gradient < 0) found.add('Uphill climb');
    if (effect.gradient !== undefined && effect.gradient > 0) found.add('Downhill run');
    if (effect.jarringAbove !== undefined) found.add('Rough surface or hump');
    if (effect.narrowsTo !== undefined) found.add('Road narrows');
  }
  return [...found];
};

const stageOf = (stage: GarageStage | undefined) =>
  stage ? { plate: stage.plate, intro: stage.intro, points: stage.hotspots.length } : null;

const competencyFields = (competency: DrivingCompetency | undefined) => ({
  competency: competency ?? null,
  competencyLabel: competency ? getCompetencyLabel(competency) : null,
});

/**
 * The preview of `level`. `counted` names the scenario ids that count toward
 * a verdict (a course drive's composition); absent, every graded scenario does.
 */
export const drivePreview = (level: LevelConfig, counted?: ReadonlySet<string>): DrivePreview => {
  const isCounted = (id: string, competency?: DrivingCompetency) => (counted ? counted.has(id) : Boolean(competency));
  const scenarios: Omit<PreviewScenario, 'order'>[] = [
    ...(level.garage?.hotspots ?? []).map(point => {
      const id = point.scenarioId ?? point.id;
      const format = scenarioFormat({}, 'garage');
      return {
        id, stage: 'garage' as const, title: point.label, description: point.objective ?? point.observation,
        ...competencyFields(point.competency), format, formatLabel: SCENARIO_FORMAT_LABEL[format], timed: TIMED_FORMATS.has(format),
        counted: isCounted(id, point.competency),
      };
    }),
    ...[...level.events]
      .sort((a, b) => a.triggerAtDistance - b.triggerAtDistance)
      .map(event => {
        const format = scenarioFormat(event);
        return {
          id: event.id, stage: 'road' as const, title: scenarioLabel(event), description: event.description,
          ...competencyFields(event.competency), format, formatLabel: SCENARIO_FORMAT_LABEL[format], timed: TIMED_FORMATS.has(format),
          counted: !event.neutral && isCounted(event.id, event.competency),
        };
      }),
    ...(level.aftermath?.hotspots ?? []).map(point => {
      const id = point.scenarioId ?? point.id;
      const format = scenarioFormat({}, 'aftermath');
      return {
        id, stage: 'aftermath' as const, title: point.label, description: point.objective ?? point.observation,
        ...competencyFields(point.competency), format, formatLabel: SCENARIO_FORMAT_LABEL[format], timed: TIMED_FORMATS.has(format),
        counted: isCounted(id, point.competency),
      };
    }),
  ];
  return {
    setting: {
      name: level.name,
      description: level.description,
      speedLimit: level.speedLimit,
      roadEvents: level.events.length,
      conditions: conditionsOf(level.events),
      garage: stageOf(level.garage),
      aftermath: stageOf(level.aftermath),
    },
    scenarios: scenarios.map((scenario, i) => ({ ...scenario, order: i + 1 })),
  };
};
