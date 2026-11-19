import { describe, expect, it } from 'vitest';
import { LEVELS } from './levelCatalog';
import { drivePreview } from './drivePreview';
import { scenarioFormat } from './scenarioFormat';

const level = (id: number) => LEVELS.find(entry => entry.id === id)!;

describe('scenario formats', () => {
  it('classifies every scenario in the catalogue into one of the seven formats', () => {
    const formats = new Set(LEVELS.flatMap(l => l.events.map(event => scenarioFormat(event))));
    expect([...formats].every(f => ['briefed_drive', 'drive_then_question', 'frozen_question', 'emergency_question', 'park_then_question'].includes(f))).toBe(true);
    expect(formats.has('briefed_drive')).toBe(true);
  });
});

describe('the drive overview', () => {
  it('lists the garage, then the road in route order, then the aftermath, and never the answer', () => {
    const withStages = LEVELS.find(l => l.garage && l.aftermath) ?? LEVELS.find(l => l.garage)!;
    const preview = drivePreview(withStages);
    expect(preview.scenarios.map(s => s.order)).toEqual(preview.scenarios.map((_, i) => i + 1));
    const stages = preview.scenarios.map(s => s.stage);
    expect(stages.indexOf('road')).toBeGreaterThan(stages.lastIndexOf('garage'));
    if (stages.includes('aftermath')) expect(stages.indexOf('aftermath')).toBeGreaterThan(stages.lastIndexOf('road'));
    const road = preview.scenarios.filter(s => s.stage === 'road');
    const distances = road.map(s => withStages.events.find(e => e.id === s.id)!.triggerAtDistance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    const text = JSON.stringify(preview);
    for (const event of withStages.events) if (event.recommendedMove) expect(text).not.toContain(event.recommendedMove);
    expect(preview.setting.speedLimit).toBe(withStages.speedLimit);
  });

  it('marks only the composed scenarios as counted when a composition is given', () => {
    const l = level(5);
    const counted = new Set([l.events[0].id]);
    const preview = drivePreview(l, counted);
    expect(preview.scenarios.filter(s => s.counted).map(s => s.id)).toEqual([l.events[0].id]);
  });

  it('times the in-drive questions only', () => {
    const preview = drivePreview(level(5));
    for (const s of preview.scenarios) expect(s.timed).toBe(['drive_then_question', 'frozen_question', 'emergency_question', 'park_then_question'].includes(s.format));
  });
});
