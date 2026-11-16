import { describe, expect, it } from 'vitest';
import { COMPETENCY_STAGES, STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { afterCuts, cutsFor } from './compactRoad';
import { composeDrive } from './composeDrive';
import { stageContent } from './stageContent';

const sequence = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

describe('a course drive cut to the scenarios it was given', () => {
  it('moves road past a cut back by its length, and a point inside it to where it began', () => {
    const cuts = [{ from: 1000, length: 500 }, { from: 3000, length: 200 }];
    expect(afterCuts(cuts, 800)).toBe(800);
    expect(afterCuts(cuts, 1200)).toBe(1000);
    expect(afterCuts(cuts, 2000)).toBe(1500);
    expect(afterCuts(cuts, 4000)).toBe(3300);
  });

  it('cuts only where unused slots stood, and keeps the road\'s own long gaps', () => {
    const distances = [900, 1750, 2600, 6000];
    // All used: the long authored gap before 6000 stays.
    expect(cutsFor(distances, new Set([0, 1, 2, 3]))).toEqual([]);
    // Slot 1 unused: the 1700 between 900 and 2600 closes to the 850 spacing.
    const cuts = cutsFor(distances, new Set([0, 2, 3]));
    expect(afterCuts(cuts, 2600) - afterCuts(cuts, 900)).toBe(850);
  });

  it('leaves no stretch longer than the stage\'s own spacing where a slot went unused', () => {
    const long: string[] = [];
    for (const levelId of COMPETENCY_STAGES) {
      const content = stageContent(levelId)!;
      const sorted = [...content.distances].sort((a, b) => a - b);
      const widest = Math.max(...sorted.slice(1).map((d, i) => d - sorted[i]));
      for (let seed = 1; seed <= 5; seed++) {
        const drive = composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: sequence(seed) });
        const own = new Set(content.slots.flat().map(variant => variant.id));
        // The stage's own slots: the road only gets shorter, so they stay inside its authored length.
        const events = drive.level.events
          .filter(event => own.has(event.id) && event.triggerAtDistance <= sorted[sorted.length - 1])
          .sort((a, b) => a.triggerAtDistance - b.triggerAtDistance);
        events.slice(1).forEach((event, i) => {
          const gap = event.triggerAtDistance - events[i].triggerAtDistance;
          // A cut stops short of a long announcement, so up to 100 units more may remain.
          if (gap > widest + 100) long.push(`L${levelId} seed ${seed}: ${gap} before ${event.id}`);
        });
      }
    }
    expect(long).toEqual([]);
  });
});
