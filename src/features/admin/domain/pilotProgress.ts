/**
 * What the Participants page says about each enrolled participant:
 * where they are in the study's order, where they are in the course, how many
 * drives they have saved, and when they were last active.
 *
 * It shows progress and never a result. That is enforced by the input: an
 * attempt reaches this module as its level and its time, a test as whether
 * it is open or finished, and no score, verdict or accuracy is ever carried
 * in. It shows the participant's name, age and username from their consent,
 * and their background answers, so the team knows who to help (the
 * developers' decisions of 2026-11-04 and 2026-11-07); the export and the
 * study's records carry the code and the age band alone.
 *
 * - **Stage** is `studyStage`, the function the participant's own home reads
 *   (amendment 2), so the two never disagree.
 * - **Place** is the level the next Continue enters: the cursor's frontier,
 *   or the one after it once the frontier is passed, since the move is made
 *   at Continue.
 */
import { LAST_COURSE_LEVEL } from '@/domain/routing/routingTypes';
import { compareParticipantCodes, type StudyCohort } from '@/domain/study/participantCode';
import { FINAL_EXAM_LEVEL, studyStage, type CourseProgress, type StudyStage, type TestProgress } from '@/domain/study/studyStage';
import type { DeviceType, GamingFrequency } from '@/domain/study/consentRecords';

export type PilotGroup = 'conventional' | 'optimized';

/** One saved attempt, stripped to what progress needs. */
export interface PilotAttemptSummary {
  id: string;
  levelId: number;
  /** When it was saved: the end of the drive. */
  savedAt: number;
}

/** The course cursor, as far as progress reads it. */
export interface PilotCursor {
  state: { kind: string; level?: number };
  /** The verdict on the frontier, before the next Continue moves on from it. */
  outcome: 'passed' | 'failed' | null;
  updatedAt: number;
}

/** The participant's own steps in the study's order, as recorded: when each was taken, null before. */
export interface PilotSteps {
  consentedAt: number | null;
  backgroundAt: number | null;
  deviceCheckedAt: number | null;
  preTest: TestProgress;
  postTest: TestProgress;
  surveyOpenedAt: number | null;
  surveyConfirmedAt: number | null;
}

export const NO_STEPS: PilotSteps = {
  consentedAt: null,
  backgroundAt: null,
  deviceCheckedAt: null,
  preTest: 'none',
  postTest: 'none',
  surveyOpenedAt: null,
  surveyConfirmedAt: null,
};

/** The device check as it was measured. */
export interface PilotDeviceCheck {
  touch: boolean;
  medianFps: number;
  slow: boolean;
  width: number;
  height: number;
}

/**
 * What the participant told the study about themselves, for the team alone:
 * the admin-only consent record (age, username, which text) and the
 * background form. Null before each was given.
 */
export interface PilotProfile {
  username: string | null;
  age: number | null;
  consentVersion: string | null;
  gaming: GamingFrequency | null;
  device: DeviceType | null;
  deviceCheck: PilotDeviceCheck | null;
}

export const NO_PROFILE: PilotProfile = { username: null, age: null, consentVersion: null, gaming: null, device: null, deviceCheck: null };

export interface PilotAccountProgress {
  code: string;
  /** The name given at consent, read from the admin-only record; null before consent. */
  name: string | null;
  profile: PilotProfile;
  cohort: StudyCohort;
  uid: string;
  enrolledAt: number;
  /** When the participant withdrew; null while they take part. */
  withdrawnAt: number | null;
  steps: PilotSteps;
  /** The frozen design's group, until redesign step 6; a self-enrolled participant has none. */
  group: PilotGroup | null;
  cursor: PilotCursor | null;
  attempts: readonly PilotAttemptSummary[];
}

export interface PilotRow {
  code: string;
  /** Shown to the team so it can help a participant; never in the export, nor is the profile. */
  name: string | null;
  profile: PilotProfile;
  steps: PilotSteps;
  withdrawnAt: number | null;
  cohort: StudyCohort;
  group: PilotGroup | null;
  stage: StudyStage;
  place: string;
  storyAttempts: number;
  enrolledAt: number;
  lastActivityAt: number | null;
}

/**
 * The course as the study's order reads it, from the cursor as stored: the
 * same answer Driving Sim's `courseProgressOf` gives, which this module
 * cannot import (`pilotProgress.test.ts` holds the two together). A cursor
 * is saved at the first Continue, so one that exists has started.
 */
export const courseProgressOfCursor = (cursor: PilotCursor | null): CourseProgress => {
  if (!cursor) return { started: false, frontierLevel: 0, endReason: null };
  switch (cursor.state.kind) {
    case 'CERTIFIED':
      return { started: true, frontierLevel: null, endReason: 'certified' };
    case 'FINAL':
      return { started: true, frontierLevel: FINAL_EXAM_LEVEL, endReason: null };
    default: {
      const level = cursor.state.level ?? 0;
      const next = cursor.outcome === 'passed' ? (level === LAST_COURSE_LEVEL ? FINAL_EXAM_LEVEL : level + 1) : level;
      return { started: true, frontierLevel: next, endReason: null };
    }
  }
};

export const stageOf = (account: Pick<PilotAccountProgress, 'withdrawnAt' | 'steps' | 'cursor'>): StudyStage =>
  studyStage({
    withdrawn: account.withdrawnAt !== null,
    consented: account.steps.consentedAt !== null,
    background: account.steps.backgroundAt !== null,
    deviceChecked: account.steps.deviceCheckedAt !== null,
    preTest: account.steps.preTest,
    course: courseProgressOfCursor(account.cursor),
    postTest: account.steps.postTest,
    survey: { openedAt: account.steps.surveyOpenedAt, confirmedAt: account.steps.surveyConfirmedAt },
  });

export const placeLabel = (cursor: PilotCursor | null): string => {
  if (!cursor) return 'Not in the course yet';
  switch (cursor.state.kind) {
    case 'DRIVE': {
      const level = cursor.state.level ?? 0;
      if (cursor.outcome !== 'passed') return level === 0 ? 'Level 0 (tutorial)' : `Level ${level}`;
      return level === LAST_COURSE_LEVEL ? 'Final Mission' : `Level ${level + 1}`;
    }
    case 'FINAL':
      return 'Final Mission';
    case 'CERTIFIED':
      return 'Certified';
    default:
      return cursor.state.kind;
  }
};

export const pilotRow = (account: PilotAccountProgress): PilotRow => {
  const { steps } = account;
  const activity = [
    account.enrolledAt,
    ...account.attempts.map(attempt => attempt.savedAt),
    ...(account.cursor ? [account.cursor.updatedAt] : []),
    ...[steps.consentedAt, steps.backgroundAt, steps.deviceCheckedAt, steps.surveyOpenedAt, steps.surveyConfirmedAt, account.withdrawnAt].filter(
      (at): at is number => at !== null
    ),
  ];
  return {
    code: account.code,
    name: account.name,
    profile: account.profile,
    steps: account.steps,
    withdrawnAt: account.withdrawnAt,
    cohort: account.cohort,
    group: account.group,
    stage: stageOf(account),
    place: placeLabel(account.cursor),
    storyAttempts: account.attempts.length,
    enrolledAt: account.enrolledAt,
    lastActivityAt: Math.max(...activity),
  };
};

export const pilotRows = (accounts: readonly PilotAccountProgress[]): PilotRow[] =>
  accounts.map(pilotRow).sort((a, b) => compareParticipantCodes(a.code, b.code));

/** "just now", "4 min ago", "2 h ago", "3 d ago". */
export const formatAgo = (at: number, now: number): string => {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (24 * 60))} d ago`;
};
