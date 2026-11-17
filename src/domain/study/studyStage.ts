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
   * Why the course is over, or null while it runs: certified, or finished
   * without the certificate by the end path (after the failed finals, or at
   * the study's deadline). Either opens the post-test.
   */
  endReason: CourseEndReason | null;
  /** Final exams failed so far (absent where the course does not count them). */
  finalFailures?: number;
}

export type CourseEndReason = 'certified' | 'finished_after_finals' | 'finished_at_deadline';

/** Failed final exams after which the home offers to finish the study (course.ts FINAL_ATTEMPTS_BEFORE_FINISH). */
export const FINISH_AFTER_FAILED_FINALS = 3;

export interface StudyFacts {
  withdrawn: boolean;
  consented: boolean;
  background: boolean;
  deviceChecked: boolean;
  preTest: TestProgress;
  course: CourseProgress;
  postTest: TestProgress;
  survey: { openedAt: number | null; confirmedAt: number | null };
  /** The admin's study deadline (ms), or null while none is set. */
  deadlineAt?: number | null;
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

/**
 * Whether the home offers "Finish the study" now, and why: after
 * FINISH_AFTER_FAILED_FINALS failed finals, or to anyone in the course not yet
 * certified once the deadline has passed. Null when it does not.
 */
export const finishOffer = (facts: StudyFacts, now: number): 'final_attempts' | 'deadline' | null => {
  const stage = studyStage(facts);
  if (!COURSE_STAGES.includes(stage)) return null;
  if (stage === 'final' && (facts.course.finalFailures ?? 0) >= FINISH_AFTER_FAILED_FINALS) return 'final_attempts';
  if (typeof facts.deadlineAt === 'number' && now >= facts.deadlineAt) return 'deadline';
  return null;
};

/** The course's stages: where a participant plays Story Mode, and nowhere else. */
export const COURSE_STAGES: readonly StudyStage[] = ['tutorial', 'levels', 'final'];

/** How far along the order a stage is, for the tracker: 0 for consent. */
export const stageIndex = (stage: StudyStage): number =>
  stage === 'withdrawn' ? -1 : STUDY_STAGES.indexOf(stage);
