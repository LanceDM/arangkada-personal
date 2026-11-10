/**
 * Where a participant stands in the study's gated order:
 *
 *   consent → background → device check → pre-test → tutorial (Level 0)
 *   → Levels 1–11 → final exam (Level 12) → post-test → survey → done
 *
 * One pure function, read by the participant's home and by the admin's
 * Participants page, so the two never disagree. It is told facts and decides
 * nothing else: the course reaches it only as `CourseProgress` (whether it
 * has started, the level Continue enters, whether it is finished), so no BKT,
 * Q-table or policy is read here, whatever redesign steps 2–6 make of them.
 */

export type TestProgress = 'none' | 'open' | 'finished';

/** The course, as the study's order reads it: the narrow seam to Driving Sim's routing. */
export interface CourseProgress {
  /** Continue has been pressed at least once. */
  started: boolean;
  /** The level the next Continue enters; null once the course is finished. */
  frontierLevel: number | null;
  /**
   * Why the course is over, or null while it runs. `certified` is the only
   * reason today; the stopping rule and the retry cap add theirs later.
   */
  endReason: 'certified' | null;
}

export interface StudyFacts {
  withdrawn: boolean;
  consented: boolean;
  background: boolean;
  deviceChecked: boolean;
  preTest: TestProgress;
  course: CourseProgress;
  postTest: TestProgress;
  survey: { openedAt: number | null; confirmedAt: number | null };
}

export const STUDY_STAGES = [
  'consent',
  'background',
  'device',
  'pre-test',
  'tutorial',
  'levels',
  'final',
  'post-test',
  'survey',
  'done',
] as const;
export type StudyStage = (typeof STUDY_STAGES)[number] | 'withdrawn';

/** The final exam's level id: the course's last entry before certification. */
export const FINAL_EXAM_LEVEL = 12;

export const studyStage = (facts: StudyFacts): StudyStage => {
  if (facts.withdrawn) return 'withdrawn';
  if (!facts.consented) return 'consent';
  if (!facts.background) return 'background';
  if (!facts.deviceChecked) return 'device';
  if (facts.preTest !== 'finished') return 'pre-test';
  if (facts.course.endReason === null) {
    const level = facts.course.frontierLevel;
    if (!facts.course.started || level === null || level === 0) return 'tutorial';
    return level >= FINAL_EXAM_LEVEL ? 'final' : 'levels';
  }
  if (facts.postTest !== 'finished') return 'post-test';
  if (facts.survey.confirmedAt === null) return 'survey';
  return 'done';
};

/** The course's stages: where a participant plays Story Mode, and nowhere else. */
export const COURSE_STAGES: readonly StudyStage[] = ['tutorial', 'levels', 'final'];

/** How far along the order a stage is, for the tracker: 0 for consent. */
export const stageIndex = (stage: StudyStage): number =>
  stage === 'withdrawn' ? -1 : STUDY_STAGES.indexOf(stage);
