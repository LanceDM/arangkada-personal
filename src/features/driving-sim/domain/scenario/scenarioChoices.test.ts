/**
 * The results screen names what a player answered by its choice's label
 * (`scenarioChoices`), so every question in the game must name each action
 * once, and every garage and crash-scene point must be found by the id its
 * log carries.
 */
import { describe, expect, it } from 'vitest';
import { stageContent } from './stageContent';
import { LEVELS } from './levelCatalog';
import { choiceLabel, scenarioChoices } from './scenarioChoices';
import { hotspotScenarioId } from './hotspotScenarioId';
import type { QuestionChoice } from './scenarioDefinition';

/** Every multiple-choice point in the game: pooled variants, garages and crash scenes. */
const everyQuestion = () => {
  const all: { id: string; choices: QuestionChoice[] }[] = [];
  for (let id = 0; id <= 12; id++) {
    const stage = stageContent(id);
    if (!stage) continue;
    for (const slot of stage.slots) for (const v of slot) if (v.choices) all.push({ id: v.id, choices: v.choices });
    for (const point of [...stage.garage, ...stage.aftermath]) {
      for (const v of point.variants) all.push({ id: hotspotScenarioId(v), choices: v.choices });
    }
  }
  return all;
};

describe('a question names each action once', () => {
  it('in every question of the game, so a choice label is exact', () => {
    const questions = everyQuestion();
    expect(questions.length).toBeGreaterThan(50);
    for (const q of questions) {
      const actions = q.choices.map(c => c.action);
      expect(new Set(actions).size, q.id).toBe(actions.length);
    }
  });
});

describe('scenarioChoices', () => {
  it("finds a garage point's choices by the id its log carries, and labels the answer", () => {
    const level = LEVELS.find(l => l.id === 2)!;
    const point = level.garage!.hotspots[0];
    const choices = scenarioChoices(level, hotspotScenarioId(point))!;
    expect(choices).toBe(point.choices);
    expect(choiceLabel(choices, point.correctAction)).toMatch(/^(Go|No-Go)\b/);
  });

  it('has none for a scenario driven with the car, or an unknown or missing id', () => {
    const level = LEVELS.find(l => l.events.some(e => !e.choices?.length))!;
    const driven = level.events.find(e => !e.choices?.length)!;
    expect(scenarioChoices(level, driven.id)).toBeNull();
    expect(scenarioChoices(level, 'nowhere')).toBeNull();
    expect(scenarioChoices(level, undefined)).toBeNull();
  });
});
