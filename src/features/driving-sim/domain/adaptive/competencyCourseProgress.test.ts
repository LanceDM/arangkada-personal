import { describe, expect, it } from 'vitest';
import { startingCourse, type CourseCursor } from '@/domain/competencyRouting/course';
import { studyStage } from '@/domain/study/studyStage';
import { competencyCourseProgressOf } from './competencyCourseProgress';

const at = (phase: CourseCursor['phase'], seq = 3): CourseCursor => ({ ...startingCourse(), phase, seq });

describe("the study flow's view of the per-competency course", () => {
  it('has not started before the first step, or with no cursor', () => {
    expect(competencyCourseProgressOf(null)).toEqual({ started: false, frontierLevel: 0, endReason: null });
    expect(competencyCourseProgressOf(startingCourse())).toEqual({ started: false, frontierLevel: 0, endReason: null });
  });

  it('names the level the participant is in, whatever part of it they are at', () => {
    for (const phase of [
      { kind: 'MODULE', level: 4 },
      { kind: 'QUIZ', level: 4 },
      { kind: 'QUIZ_REVIEW', level: 4, competencies: [] },
      { kind: 'DRIVE', level: 4 },
      { kind: 'REPEAT', level: 4 },
    ] as CourseCursor['phase'][]) {
      expect(competencyCourseProgressOf(at(phase)).frontierLevel).toBe(4);
    }
  });

  it('is at the final exam, then certified', () => {
    expect(competencyCourseProgressOf(at({ kind: 'FINAL' }))).toEqual({ started: true, frontierLevel: 12, endReason: null });
    expect(competencyCourseProgressOf(at({ kind: 'CERTIFIED' }))).toEqual({ started: true, frontierLevel: null, endReason: 'certified' });
  });

  it('gives studyStage the tutorial, the levels, the final and then the post-test', () => {
    const stage = (cursor: CourseCursor | null) =>
      studyStage({
        withdrawn: false, consented: true, background: true, deviceChecked: true, preTest: 'finished',
        course: competencyCourseProgressOf(cursor), postTest: 'none', survey: { openedAt: null, confirmedAt: null },
      });
    expect(stage(null)).toBe('tutorial');
    expect(stage(at({ kind: 'DRIVE', level: 0 }, 1))).toBe('tutorial');
    expect(stage(at({ kind: 'QUIZ', level: 5 }))).toBe('levels');
    expect(stage(at({ kind: 'FINAL' }))).toBe('final');
    expect(stage(at({ kind: 'CERTIFIED' }))).toBe('post-test');
  });
});
