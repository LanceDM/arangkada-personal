import type { LevelConfig, QuestionChoice } from './scenarioDefinition';
import { hotspotScenarioId } from './hotspotScenarioId';

/**
 * The choices a logged decision was answered from: the scenario's own, found
 * by the id the log names (`ActionLog.scenarioId`) among the level's events,
 * garage points and crash-scene points. Null for a scenario driven with the
 * car, which has none.
 *
 * A question's `action` is only the token its choice submits (`accelerate`
 * stands for "Go — …" at a garage point), so a screen naming what was answered
 * reads the choice's label, never the token. No two choices of one question
 * share an action (`scenarioChoices.test.ts`), so the label is exact.
 */
export const scenarioChoices = (
  level: Pick<LevelConfig, 'events' | 'garage' | 'aftermath'>,
  scenarioId: string | undefined,
): readonly QuestionChoice[] | null => {
  if (!scenarioId) return null;
  const event = level.events.find(e => e.id === scenarioId);
  if (event) return event.choices?.length ? event.choices : null;
  const point = [...(level.garage?.hotspots ?? []), ...(level.aftermath?.hotspots ?? [])]
    .find(h => hotspotScenarioId(h) === scenarioId);
  return point?.choices.length ? point.choices : null;
};

/** The label of the choice that submits `action`, or null when none does. */
export const choiceLabel = (choices: readonly QuestionChoice[], action: string | undefined): string | null =>
  choices.find(c => c.action === action)?.label ?? null;
