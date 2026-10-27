// The routing FSM (`src/domain/routing`) writes the course's shape down
// itself, because the shared domain may not import Driving Sim. This holds the
// two copies together, and holds the one content fact its structural rule
// about the tutorial rests on.
import { describe, it, expect } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { COURSE_LEVELS, FINAL_EXAM_LEVEL, LAST_COURSE_LEVEL, TUTORIAL_LEVEL } from '@/domain/routing/routingTypes';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import { TUTORIAL_LEVEL_ID } from '@/features/driving-sim/domain/systems/tutorial';
import { FINAL_EXAM_LEVEL_ID, adaptsLevel } from './practiceSelection';

describe("the routing FSM's course is the game's", () => {
  it('has the same levels, in the same order, with the final exam last', () => {
    expect(LEVELS.map(level => level.id)).toEqual([...COURSE_LEVELS, FINAL_EXAM_LEVEL]);
    expect(LAST_COURSE_LEVEL).toBe(FINAL_EXAM_LEVEL - 1);
  });

  it('names the same tutorial and final exam', () => {
    expect(TUTORIAL_LEVEL).toBe(TUTORIAL_LEVEL_ID);
    expect(FINAL_EXAM_LEVEL).toBe(FINAL_EXAM_LEVEL_ID);
    expect(adaptsLevel(FINAL_EXAM_LEVEL)).toBe(false);
  });

  it('has no practice content for the tutorial, which the machine never appends to', () => {
    for (const competency of COMPETENCIES) expect(remediationCandidates(competency, TUTORIAL_LEVEL)).toEqual([]);
  });
});
