/**
 * Each participant's own BKT profile (`users/{uid}/bkt/profile`) and the log
 * of every update to it (`users/{uid}/bktUpdates/{updateId}`).
 *
 * One graded answer is one update. Each entry keeps the raw answer and its
 * timing, the T, S and G used, P(L) before, the predicted P(correct), the
 * posterior and P(L) after, so the panel can change a value or a grading rule
 * and the log can be replayed; and AUC and RMSE come straight from it.
 */
import type { ActionLog, EvidenceSource } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import {
  DEFAULT_BKT_MODEL,
  bktTrajectory,
  type BKTEvidenceParams,
  type BKTModel,
} from '@/domain/learner/mastery/buildBKTProfile';
import { MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING, masteryLevel, type MasteryLevel } from '@/domain/competencyRouting/mastery';
import type { StudyEnvelope } from './studyEvent';

/** Where a graded answer was given. */
export interface EvidenceOrigin {
  /** `attempt` for a drive; otherwise the sitting kind. */
  kind: 'attempt' | 'quiz' | 'diagnostic' | 'post_exam';
  levelId: number | null;
  /** The attempt or sitting id when the store gives one. */
  ref: string | null;
  /** The quiz attempt number (1-3). */
  attempt: number | null;
}

export type CountsByClass = Record<EvidenceSource, number>;

export interface BKTCompetencyProfile {
  p: number;
  level: MasteryLevel;
  /** Held below level 4 because it has fewer than 3 drive answers. */
  capped: boolean;
  /** P(L) after the diagnostic; null before it. */
  startP: number | null;
  answers: CountsByClass;
  correct: CountsByClass;
  lastUpdatedAt: number | null;
}

export interface BKTProfileDoc {
  schemaVersion: 1;
  uid: string;
  configVersion: string;
  pInit: number;
  /** Updates applied so far: the next entry's `userSeq` is this plus one. */
  updates: number;
  lastUpdateId: string | null;
  updatedAt: number;
  competencies: Record<DrivingCompetency, BKTCompetencyProfile>;
}

export interface BKTUpdateRecord extends StudyEnvelope {
  /** The participant's BKT sequence: 1, 2, 3... */
  userSeq: number;
  competency: DrivingCompetency;
  source: EvidenceSource;
  origin: EvidenceOrigin;
  scenarioId: string | null;
  itemId: string | null;
  ruleId: string | null;
  /** When the answer was given (device ms). */
  answeredAt: number;
  correct: boolean;
  /** The raw answer: the action taken or the choice. */
  action: string;
  expectedAction: string | null;
  /** Reaction (drive) or response (question) time in ms, when measured. */
  responseMs: number | null;
  timedOut: boolean;
  params: BKTEvidenceParams;
  /** pInit, written on a competency's first update only. */
  pInit: number | null;
  pBefore: number;
  predictedCorrect: number;
  posterior: number;
  pAfter: number;
  levelBefore: MasteryLevel;
  levelAfter: MasteryLevel;
  levelChanged: boolean;
  /** Whether the 3-drive-answer cap held the level below 4 after this update. */
  capApplied: boolean;
  driveAnswersAfter: number;
  /** P(L) of all 11 competencies after this update. */
  allAfter: Record<DrivingCompetency, number>;
}

const zeroCounts = (): CountsByClass => ({ drive: 0, quiz: 0, diagnostic: 0, post_exam: 0 });

export const emptyBKTProfile = (uid: string, configVersion: string, at: number, model: BKTModel = DEFAULT_BKT_MODEL): BKTProfileDoc => ({
  schemaVersion: 1,
  uid,
  configVersion,
  pInit: model.pInit,
  updates: 0,
  lastUpdateId: null,
  updatedAt: at,
  competencies: Object.fromEntries(
    COMPETENCIES.map(c => [
      c,
      { p: model.pInit, level: masteryLevel(model.pInit, 0), capped: false, startP: null, answers: zeroCounts(), correct: zeroCounts(), lastUpdatedAt: null },
    ])
  ) as Record<DrivingCompetency, BKTCompetencyProfile>,
});

/**
 * Replays every answer and returns the profile now plus the entries not yet
 * logged (those past `alreadyLogged`). Replaying from the start each time keeps
 * the profile and the log equal to what the raw answers say.
 */
export const buildBKTLog = (input: {
  uid: string;
  logs: readonly ActionLog[];
  origins: readonly EvidenceOrigin[];
  alreadyLogged: number;
  envelope: (index: number) => Omit<StudyEnvelope, 'uid'>;
  now: number;
  configVersion: string;
  model?: BKTModel;
}): { profile: BKTProfileDoc; entries: BKTUpdateRecord[] } => {
  const model = input.model ?? DEFAULT_BKT_MODEL;
  const steps = bktTrajectory([...input.logs], model);
  const profile = emptyBKTProfile(input.uid, input.configVersion, input.now, model);
  const all = Object.fromEntries(COMPETENCIES.map(c => [c, model.pInit])) as Record<DrivingCompetency, number>;
  const seen = new Set<DrivingCompetency>();
  const entries: BKTUpdateRecord[] = [];

  steps.forEach((step, i) => {
    const log = input.logs[step.logIndex];
    const origin = input.origins[step.logIndex];
    const c = profile.competencies[step.competency];
    const driveBefore = c.answers.drive;
    c.answers[step.source] += 1;
    if (step.correct) c.correct[step.source] += 1;
    const levelBefore = masteryLevel(step.pBefore, driveBefore);
    const levelAfter = masteryLevel(step.pAfter, c.answers.drive);
    c.p = step.pAfter;
    c.level = levelAfter;
    c.capped = masteryLevel(step.pAfter) === 4 && c.answers.drive < MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING;
    if (step.source === 'diagnostic') c.startP = step.pAfter;
    c.lastUpdatedAt = step.timestamp;
    all[step.competency] = step.pAfter;
    const first = !seen.has(step.competency);
    seen.add(step.competency);

    if (i < input.alreadyLogged) return;
    const envelope = input.envelope(entries.length);
    entries.push({
      ...envelope,
      uid: input.uid,
      userSeq: i + 1,
      competency: step.competency,
      source: step.source,
      origin,
      scenarioId: log.scenarioId ?? null,
      itemId: log.itemId ?? null,
      ruleId: log.ruleId ?? null,
      answeredAt: log.timestamp,
      correct: step.correct,
      action: log.action,
      expectedAction: log.expectedAction ?? null,
      responseMs: log.reactionTime ?? null,
      timedOut: log.reactionCensored === true,
      params: step.params,
      pInit: first ? model.pInit : null,
      pBefore: step.pBefore,
      predictedCorrect: step.predictedCorrect,
      posterior: step.posterior,
      pAfter: step.pAfter,
      levelBefore,
      levelAfter,
      levelChanged: levelBefore !== levelAfter,
      capApplied: c.capped,
      driveAnswersAfter: c.answers.drive,
      allAfter: { ...all },
    });
  });

  profile.updates = steps.length;
  profile.lastUpdateId = entries.at(-1)?.eventId ?? null;
  return { profile, entries };
};
