/**
 * Writes the study logs: the participant's event stream and their BKT
 * profile and update log. Each record carries the same envelope (event id,
 * device time, session, build, settings version).
 *
 * A failed log write never stops play: the error is reported on the console
 * and the game continues. The raw data (attempts, sittings, course log) is
 * saved separately, so a lost event can be rebuilt from it.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import { buildBKTLog, type EvidenceOrigin } from '@/domain/study/bktLog';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { newEventId, type StudyEnvelope, type StudyEventDraft } from '@/domain/study/studyEvent';
import { drivingSimDeps } from './dependencies';
import { TUTORIAL_LEVEL_ID, loadLearnerHistory } from './learnerHistory';

/** One per app load: every record written in this sitting shares it. */
const SESSION_ID = newEventId(Date.now());

export const studySessionId = () => SESSION_ID;

/** The envelope for a record about `uid` made at `at`. */
export const envelopeFor = (uid: string, at: number = Date.now()): StudyEnvelope => ({
  schemaVersion: 1,
  eventId: newEventId(at),
  uid,
  at,
  sessionId: SESSION_ID,
  appBuild: drivingSimDeps().appBuild ?? 'unknown',
  configVersion: RUN_CONFIG_VERSION,
});

/** Appends events to the participant's stream, in the order given. */
export const recordEvents = async (uid: string, drafts: readonly StudyEventDraft[]): Promise<void> => {
  if (drafts.length === 0) return;
  const now = Date.now();
  const events = drafts.map((draft, i) => ({
    ...envelopeFor(uid, draft.at ?? now + i),
    type: draft.type,
    levelId: draft.levelId ?? null,
    phase: draft.phase ?? null,
    attemptId: draft.attemptId ?? null,
    payload: draft.payload,
  }));
  try {
    await drivingSimDeps().studyEvents.append(uid, events);
  } catch (failure) {
    console.error('Could not write study events:', failure);
  }
};

/**
 * Every graded answer BKT reads, oldest first, each with where it came from:
 * drives (tutorial left out) and quiz, diagnostic and post-exam answers.
 * `loadEvidence` returns the same logs in the same order.
 */
export const loadTaggedEvidence = async (uid: string): Promise<{ logs: ActionLog[]; origins: EvidenceOrigin[] }> => {
  const [history, sittings] = await Promise.all([loadLearnerHistory(uid), drivingSimDeps().assessments.load(uid)]);
  const tagged: { log: ActionLog; origin: EvidenceOrigin }[] = [
    ...history.attempts
      .filter(attempt => attempt.levelId !== TUTORIAL_LEVEL_ID)
      .flatMap(attempt =>
        attempt.logs.map(log => ({ log, origin: { kind: 'attempt' as const, levelId: attempt.levelId, ref: null, attempt: null } }))
      ),
    ...sittings.flatMap(sitting =>
      sitting.answers.map(log => ({ log, origin: { kind: sitting.kind, levelId: sitting.levelId, ref: null, attempt: sitting.attempt } }))
    ),
  ];
  // Stable sort by the answer's own time, as historyLogs does.
  tagged.sort((a, b) => a.log.timestamp - b.log.timestamp);
  return { logs: tagged.map(t => t.log), origins: tagged.map(t => t.origin) };
};

/**
 * Brings the participant's BKT profile and update log up to date with every
 * answer saved so far. Call it after anything that saves graded answers.
 */
export const recordBKT = async (uid: string): Promise<void> => {
  try {
    const { bktLog } = drivingSimDeps();
    const [{ logs, origins }, previous] = await Promise.all([loadTaggedEvidence(uid), bktLog.loadProfile(uid)]);
    const now = Date.now();
    const alreadyLogged = previous && previous.configVersion === RUN_CONFIG_VERSION ? Math.min(previous.updates, logs.length) : 0;
    const { profile, entries } = buildBKTLog({
      uid,
      logs,
      origins,
      // A new settings version replays the whole history into new entries.
      alreadyLogged,
      envelope: i => {
        const envelope = envelopeFor(uid, now + i);
        return { schemaVersion: envelope.schemaVersion, eventId: envelope.eventId, at: envelope.at, sessionId: envelope.sessionId, appBuild: envelope.appBuild, configVersion: envelope.configVersion };
      },
      now,
      configVersion: RUN_CONFIG_VERSION,
    });
    if (entries.length === 0 && previous) return;
    await bktLog.record(uid, { ...profile, lastUpdateId: profile.lastUpdateId ?? previous?.lastUpdateId ?? null }, entries);
  } catch (failure) {
    console.error('Could not write the BKT log:', failure);
  }
};
