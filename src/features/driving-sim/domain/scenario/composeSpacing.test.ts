import { describe, expect, it } from 'vitest';
import { COMPETENCY_STAGES, STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { composeDrive } from './composeDrive';
import { stageContent } from './stageContent';

/** A fixed sequence, so the drives are the same every run. */
const sequence = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

describe('scenarios added to a course drive', () => {
  it('stand far enough apart for one verdict to be read before the next is announced', () => {
    const tight: string[] = [];
    for (const levelId of COMPETENCY_STAGES) {
      // Appended: past the stage's own road, and not one of its own slot variants.
      const content = stageContent(levelId)!;
      const own = new Set(content.slots.flat().map(variant => variant.id));
      const lastAuthored = Math.max(...content.distances);
      for (let seed = 1; seed <= 6; seed++) {
        const events = [...composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: sequence(seed) }).level.events].sort(
          (a, b) => a.triggerAtDistance - b.triggerAtDistance
        );
        events.forEach((event, i) => {
          const before = events[i - 1];
          if (!before || own.has(event.id) || event.triggerAtDistance <= lastAuthored) return;
          const announced = event.triggerAtDistance - (event.warningDistance ?? WARNING_ZONE_ENTER);
          // A stop is graded at its point; anything else may run on 340 units. Then 240 of clear road.
          const needed = before.triggerAtDistance + (before.correctAction === 'stop' ? 0 : 340) + 240;
          if (announced < needed) tight.push(`L${levelId}: ${before.id} -> ${event.id}`);
        });
      }
    }
    expect(tight).toEqual([]);
  });
});
