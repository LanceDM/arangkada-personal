/**
 * The per-competency course as the game binds it:
 * its dependencies from Driving Sim's bound stores, and what is saved beside a
 * finished course drive.
 */
import type { LevelResult } from '@/domain/learner/attempt';
import type { LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import type { Language } from '@/shared/lib/localized';
import type { PlayConditions } from '@/features/driving-sim/domain/telemetry/routingTelemetry';
import { drivingSimDeps } from '../dependencies';
import type { QTableId } from '../ports';
import { completeCourseDrive, type CourseDeps, type CourseDriveRun } from './competencyCourse';
import type { CourseCursor } from '@/domain/competencyRouting/course';

export interface CourseAccount {
  uid: string;
  /** The participant's code; null for an account outside the study. */
  participantCode: string | null;
  /** The shared table this account trains (the rules allow no other). */
  table: QTableId;
}

/** A tab's session id, stamped on every log entry it writes. */
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Where the account's course stands, as the study flow reads it; null before its first step. */
export const loadCompetencyCourseCursor = (uid: string) => {
  const { competencyCourse } = drivingSimDeps();
  if (!competencyCourse) throw new Error('The course store is not bound: app/dependencies must provide it.');
  return competencyCourse.loadCursor(uid);
};

export const courseDepsFor = (account: CourseAccount): CourseDeps => {
  const { competencyCourse, bktLog, quizBank } = drivingSimDeps();
  if (!competencyCourse) throw new Error('The course store is not bound: app/dependencies must provide it.');
  return {
    course: competencyCourse,
    bktLog,
    quizBank,
    participantCode: account.participantCode,
    table: account.table,
    sessionId: SESSION_ID,
    appBuild: import.meta.env.VITE_APP_BUILD ?? 'unknown',
  };
};

/**
 * A course drive ended: the attempt and its step are committed, then the raw
 * FSM transition log is saved beside the attempt (`telemetry/fsm`), as every
 * drive's is: it is the thesis's record of the machine, never dropped. A
 * failure there is reported and never undoes the step.
 */
export const finishCourseDrive = async (
  account: CourseAccount,
  cursor: CourseCursor,
  run: CourseDriveRun,
  result: LevelResult,
  telemetry?: LevelFsmTelemetry,
  language?: Language,
  play?: PlayConditions
) => {
  const settled = await completeCourseDrive(courseDepsFor(account), account.uid, cursor, run, result, {
    ...(telemetry ? { fsmMetrics: telemetry.metrics, reactionLatencies: telemetry.reactionLatencies } : {}),
    ...(result.timedOut ? { timedOut: true as const } : {}),
    ...(language ? { language } : {}),
    ...(play ? { play } : {}),
  });
  if (telemetry) {
    try {
      await drivingSimDeps().storyAttempts.saveFsmTelemetry(account.uid, settled.attemptId, telemetry.transitions);
    } catch (failure) {
      console.error('Could not save the drive telemetry:', failure);
    }
  }
  return settled;
};
