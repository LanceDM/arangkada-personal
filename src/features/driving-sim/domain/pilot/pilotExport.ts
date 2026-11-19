// What the pilot's participant export computes from one account's stored
// records. Pure, so every definition is tested apart from Firebase. It is the
// only copy: the export reads the records and writes what this returns, and
// the admin dashboard reads the same records and shows what this returns.
//
// The definitions, which the pre-registered analysis cites:
//
// - A participant is an account enrolled in the study's registry
//   (`participants/{code}`), named by the code the app gave it
//   (P-0001, D-0001, T-0001) and its cohort, never by a name, a username or
//   an email. Any other account an export is asked for is flagged
//   `not-enrolled`. The frozen design's group (`routing/assignment`) is still
//   read until redesign step 6; a self-enrolled participant has none.
// - The post-test is the participant's first attempt recorded as `post-test`:
//   the final exam on its one fixed roll (POST_TEST_SEED). A later one is
//   counted and flagged, never used.
// - Training is every other attempt saved before that post-test started:
//   course entries, reviews and free replays alike, because BKT reads them all.
// - A graded decision is a logged decision with a verdict (not `neutral`)
//   that is not a standing penalty, as the Optimized group's routing counts
//   its budget. Where an attempt has no decision record to tell a penalty
//   apart, every verdict counts and the participant is flagged.
// - The weakest competency is the one with the lowest BKT score over the
//   whole training history, ties to the least observed: what the Optimized
//   group's routing reads.
//   BKT reads every log, standing penalties included, as the game's does, so
//   it can be a competency whose only evidence is a penalty (no accuracy), or
//   one never met in training, at BKT's prior. The weakest practised
//   competency is the lowest among those with a graded decision in training.
// - A pass is the verdict the game handed the routing FSM (the pass mark, a
//   crash or a timeout counting as a fail); an attempt saved without a routing
//   record is judged by the same rule from its own score.
// - A timeout is an attempt whose driving time ran out (`timedOut`).
//   `timedOutAttempts` counts them in training, and any attempt that timed
//   out flags the participant `timed-out`.
// - Timeliness on the post-test reads each decision's record: a timed
//   response, or a window that closed on a scenario that asked for one
//   (censored). Questions and lapses are neither.
// - Drive time runs from the attempt's first FSM transition to its save. An
//   entry left unfinished is never saved, so it is not timed; its later
//   completion records how many times it was started.
// - How an attempt was played is its routing record's `play`: the controls
//   the car was driven with, the window, the display's median frame rate,
//   and the real time the world lost because the device could not keep up.
//   The world runs 60 steps per second of real time, so a reaction time is
//   comparable across devices except where time was lost. An attempt that
//   lost at least FELL_BEHIND_MS is flagged `fell-behind`; one saved without
//   the record, by a build that did not keep it, `play-unrecorded`.
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { StudyCohort } from '@/domain/study/participantCode';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { COMPETENCIES, getLowestScoringCompetency } from '@/domain/learner/profile';
import { stateId } from '@/domain/routing/routingTypes';
import { readStoredCursor, type RoutingGroup } from '@/features/driving-sim/domain/adaptive/courseRouting';
import { POST_TEST_LEVEL_ID } from '@/features/driving-sim/domain/adaptive/pilotPostTest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { FsmTelemetryDoc, LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import type { DecisionTelemetryDoc } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import type {
  PlayConditions,
  RoutedEntryKind,
  RoutingLogRecord,
  RoutingTelemetryDoc,
} from '@/features/driving-sim/domain/telemetry/routingTelemetry';

/** One saved attempt and the three documents beside it, as stored. */
export interface StoredAttempt {
  id: string;
  attempt: LevelAttempt;
  fsm: FsmTelemetryDoc | null;
  decisions: DecisionTelemetryDoc | null;
  routing: RoutingTelemetryDoc | null;
}


/** `users/{uid}/routing/assignment`, as far as these definitions read it. */
export interface StoredAssignment {
  group: RoutingGroup;
  assignedAt: number;
  /** `balanced` in randomized pairs; `manual` where the group was named for the account. */
  method: 'balanced' | 'manual';
}

/** Everything the export reads for one account. */
export interface ParticipantSource {
  uid: string;
  /** The account's entry in the study's registry, or null for an account outside it. */
  participant: { code: string; cohort: StudyCohort } | null;
  assignment: StoredAssignment | null;
  /** `users/{uid}/routing/cursor` as stored, or null. */
  cursor: unknown;
  attempts: StoredAttempt[];
  /** Mock Exam sittings and Daily Challenge answers: read only to flag use during the play period. */
  examSittings: ReadonlyArray<{ timestamp: number }>;
  dailyAnswers: ReadonlyArray<{ timestamp: number }>;
}

/** One saved attempt and the documents beside it, as a reader got them: each null where it does not exist. */
export interface AttemptDocuments {
  id: string;
  attempt: unknown;
  fsm: unknown;
  decisions: unknown;
  routing: unknown;
}

/** One account's documents, as a reader got them. */
export interface AccountDocuments extends Omit<ParticipantSource, 'assignment' | 'attempts'> {
  assignment: unknown;
  attempts: readonly AttemptDocuments[];
}

/**
 * Of an FSM record, all that these definitions read: that it exists, whether
 * it was cut to fit, and when its first transition was logged. The rest of the
 * log can be a large document, and nothing here reads it.
 */
export const fsmAsRead = (fsm: FsmTelemetryDoc | null): FsmTelemetryDoc | null =>
  fsm && { transitions: fsm.transitions.slice(0, 1), truncated: fsm.truncated, totalCount: fsm.totalCount };

/**
 * What `participantExport` takes, from the documents as read: each one taken
 * as the shape it was written in, and the FSM record kept only as far as it is
 * read. A reader that cannot hold every log, like the admin dashboard, passes
 * its documents through this and gets the rows the export writes.
 */
export const participantSourceOf = (documents: AccountDocuments): ParticipantSource => ({
  ...documents,
  assignment: (documents.assignment ?? null) as StoredAssignment | null,
  attempts: documents.attempts.map(stored => ({
    id: stored.id,
    attempt: stored.attempt as LevelAttempt,
    fsm: fsmAsRead((stored.fsm ?? null) as FsmTelemetryDoc | null),
    decisions: (stored.decisions ?? null) as DecisionTelemetryDoc | null,
    routing: (stored.routing ?? null) as RoutingTelemetryDoc | null,
  })),
});

/** An attempt's kind: the routing record's, `legacy` for a Legacy attempt, `unrecorded` without one. */
export type AttemptKind = RoutedEntryKind | 'legacy' | 'unrecorded';

export const attemptKind = ({ routing }: StoredAttempt): AttemptKind =>
  routing ? (routing.entry?.kind ?? 'legacy') : 'unrecorded';

const levelOf = (levelId: number) => LEVELS.find(level => level.id === levelId);

export const attemptPassed = ({ attempt, routing }: StoredAttempt): boolean => {
  if (routing?.entry) return routing.entry.outcome === 'passed';
  const level = levelOf(attempt.levelId);
  return Boolean(level) && attempt.finalScore >= level!.requiredScore && !((attempt.fsmMetrics?.crashes ?? 0) > 0) && !attempt.timedOut;
};

export const attemptCrashed = ({ attempt }: StoredAttempt): boolean => (attempt.fsmMetrics?.crashes ?? 0) > 0;

/** Whether the attempt's driving time ran out. */
export const attemptTimedOut = ({ attempt }: StoredAttempt): boolean => attempt.timedOut === true;

/** Real time an attempt may lose to a device that could not keep up before it is flagged. */
export const FELL_BEHIND_MS = 1000;

/** How the attempt was played, where its routing record kept it. */
export const attemptPlay = ({ routing }: StoredAttempt): PlayConditions | null => routing?.play ?? null;

/** The controls a set of attempts was driven with, named once each: `keyboard`, `touch`, or both. */
const inputsUsed = (plays: readonly PlayConditions[]): string | null => {
  const used = new Set<string>();
  for (const play of plays) {
    if (play.input === 'both') {
      used.add('keyboard');
      used.add('touch');
    } else if (play.input !== 'none') {
      used.add(play.input);
    }
  }
  return used.size > 0 ? [...used].sort().join(';') : null;
};

/** When the drive began: its first FSM transition, else its first logged decision. */
export const attemptStart = ({ attempt, fsm }: StoredAttempt): number | null =>
  fsm?.transitions[0]?.timestamp ?? attempt.logs[0]?.timestamp ?? null;

export const attemptDurationMs = (stored: StoredAttempt): number | null => {
  const start = attemptStart(stored);
  return start === null ? null : Math.max(0, stored.attempt.timestamp - start);
};

export interface GradedDecision {
  competency: DrivingCompetency | null;
  correct: boolean;
}

const isCompetency = (value: unknown): value is DrivingCompetency =>
  COMPETENCIES.includes(value as DrivingCompetency);

/**
 * The attempt's graded decisions, standing penalties excluded where the
 * decision record can tell them apart. `penaltiesKnown` is false where it
 * cannot.
 */
export const gradedDecisions = ({ attempt, decisions }: StoredAttempt): { decisions: GradedDecision[]; penaltiesKnown: boolean } => {
  const penalties = new Set(
    (decisions?.decisions ?? []).filter(record => record.kind === 'penalty').map(record => record.logIndex)
  );
  const penaltiesKnown = decisions !== null && !decisions.truncated;
  return {
    penaltiesKnown,
    decisions: attempt.logs.flatMap((log, index) =>
      log.result === 'neutral' || penalties.has(index)
        ? []
        : [{ competency: isCompetency(log.competency) ? log.competency : null, correct: log.result === 'correct' }]
    ),
  };
};

const accuracy = (decisions: readonly GradedDecision[]): number | null =>
  decisions.length === 0 ? null : decisions.filter(d => d.correct).length / decisions.length;

/** Every attempt's logs in the order they were made, as `historyLogs` orders them. */
const chronologicalLogs = (attempts: readonly StoredAttempt[]): ActionLog[] =>
  attempts.flatMap(stored => stored.attempt.logs).sort((a, b) => a.timestamp - b.timestamp);

export interface CompetencyDetail {
  competency: DrivingCompetency;
  /** BKT score (0-100) at the end of training. */
  mastery: number;
  trainingDecisions: number;
  trainingAccuracy: number | null;
  postTestDecisions: number;
  postTestAccuracy: number | null;
}

/** Every flag a row can carry: what the analysis may exclude, or where the account stands. */
export const PARTICIPANT_FLAGS = [
  'no-post-test', 'repeat-post-test', 'played-after-post-test', 'post-test-not-final-exam', 'no-attempts',
  'unassigned', 'not-enrolled', 'manual-assignment',
  'missing-routing-record', 'override', 'legacy-attempts', 'played-before-assignment', 'group-mismatch',
  'truncated-telemetry', 'play-unrecorded', 'fell-behind', 'missing-fsm-record', 'missing-decision-record', 'timed-out',
  'mock-exam-during-play', 'daily-challenge-during-play', 'penalties-unknown',
] as const;

export type ParticipantFlag = (typeof PARTICIPANT_FLAGS)[number];

/** The participant's row: flat, so the CSV and the JSON carry the same fields. */
export interface ParticipantRow {
  uid: string;
  /** The participant code: the only name the data carries. Null outside the registry. */
  code: string | null;
  /** The cohort of the invite the participant joined with. */
  cohort: StudyCohort | null;
  group: string | null;
  assignedAt: string | null;
  assignmentMethod: string | null;

  attempts: number;
  courseAttempts: number;
  reviews: number;
  practiceItems: number;
  freeReplays: number;
  failedCourseAttempts: number;
  timedOutAttempts: number;
  reentries: number;
  storyFirstAt: string | null;
  storyLastAt: string | null;
  storySpanMinutes: number | null;
  driveMinutes: number;
  untimedAttempts: number;

  frontier: string | null;
  highestLevelPassed: number | null;
  certified: boolean;
  gradedDecisionsSpent: number | null;
  courseFinalExamAttempts: number;
  courseFinalExamBestScore: number | null;
  courseFinalExamPassed: boolean;

  postTestAt: string | null;
  postTestScore: number | null;
  postTestPassed: boolean | null;
  postTestCrashed: boolean | null;
  postTestTimedOut: boolean | null;
  postTestMinutes: number | null;
  postTestDecisions: number | null;
  postTestAccuracy: number | null;
  postTestMinCompetencyAccuracy: number | null;
  postTestResponses: number | null;
  postTestCensored: number | null;
  postTestMedianReactionMs: number | null;
  postTestSeed: number | null;
  postTestInput: string | null;
  postTestViewport: string | null;
  postTestFrameRate: number | null;
  postTestLostMs: number | null;
  postTestPauses: number | null;

  trainingInputs: string | null;
  trainingMinFrameRate: number | null;
  trainingLostMs: number | null;

  weakestCompetency: string | null;
  weakestMastery: number | null;
  weakestTrainingDecisions: number | null;
  weakestTrainingAccuracy: number | null;
  weakestPostTestDecisions: number | null;
  weakestPostTestAccuracy: number | null;
  weakestPractisedCompetency: string | null;
  weakestPractisedMastery: number | null;
  weakestPractisedTrainingAccuracy: number | null;
  weakestPractisedPostTestAccuracy: number | null;

  routingLogEntries: number;
  flags: string;
}

/** The CSV's columns, in order. */
export const PARTICIPANT_COLUMNS: ReadonlyArray<keyof ParticipantRow> = [
  'uid', 'code', 'cohort', 'group', 'assignedAt', 'assignmentMethod',
  'attempts', 'courseAttempts', 'reviews', 'practiceItems', 'freeReplays', 'failedCourseAttempts', 'timedOutAttempts', 'reentries',
  'storyFirstAt', 'storyLastAt', 'storySpanMinutes', 'driveMinutes', 'untimedAttempts',
  'frontier', 'highestLevelPassed', 'certified', 'gradedDecisionsSpent',
  'courseFinalExamAttempts', 'courseFinalExamBestScore', 'courseFinalExamPassed',
  'postTestAt', 'postTestScore', 'postTestPassed', 'postTestCrashed', 'postTestTimedOut', 'postTestMinutes', 'postTestDecisions',
  'postTestAccuracy', 'postTestMinCompetencyAccuracy',
  'postTestResponses', 'postTestCensored', 'postTestMedianReactionMs', 'postTestSeed',
  'postTestInput', 'postTestViewport', 'postTestFrameRate', 'postTestLostMs', 'postTestPauses',
  'trainingInputs', 'trainingMinFrameRate', 'trainingLostMs',
  'weakestCompetency', 'weakestMastery', 'weakestTrainingDecisions', 'weakestTrainingAccuracy',
  'weakestPostTestDecisions', 'weakestPostTestAccuracy',
  'weakestPractisedCompetency', 'weakestPractisedMastery', 'weakestPractisedTrainingAccuracy',
  'weakestPractisedPostTestAccuracy',
  'routingLogEntries', 'flags',
];

export interface ParticipantExport {
  row: ParticipantRow;
  competencies: CompetencyDetail[];
  /** The participant's whole routing log, every attempt's entries in `seq` order. */
  routingLog: RoutingLogRecord[];
  /** The post-test's route, in road order. */
  postTestRoute: string[] | null;
}

const iso = (ms: number | null | undefined): string | null => (typeof ms === 'number' ? new Date(ms).toISOString() : null);
const round = (value: number | null, places = 4): number | null =>
  value === null ? null : Math.round(value * 10 ** places) / 10 ** places;
const minutes = (ms: number | null): number | null => (ms === null ? null : round(ms / 60_000, 2));
const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** The post-test's timed responses and closed windows, from its decision record. */
const timeliness = (stored: StoredAttempt) => {
  const reactions = (stored.decisions?.decisions ?? []).map(record => record.reaction).filter(reaction => reaction !== null);
  const times = reactions.flatMap(reaction => ('ms' in reaction ? [reaction.ms] : []));
  return { responses: times.length, censored: reactions.length - times.length, median: median(times) };
};

export const participantExport = (source: ParticipantSource): ParticipantExport => {
  const flags = new Set<ParticipantFlag>();
  const attempts = [...source.attempts].sort((a, b) => a.attempt.timestamp - b.attempt.timestamp);
  const kinds = new Map(attempts.map(stored => [stored, attemptKind(stored)]));
  const kindOf = (stored: StoredAttempt) => kinds.get(stored)!;

  const postTests = attempts.filter(stored => kindOf(stored) === 'post-test');
  const postTest = postTests[0] ?? null;
  const postTestStart = postTest ? (attemptStart(postTest) ?? postTest.attempt.timestamp) : null;
  const others = attempts.filter(stored => kindOf(stored) !== 'post-test');
  const training = postTestStart === null ? others : others.filter(stored => stored.attempt.timestamp <= postTestStart);
  if (!postTest) flags.add('no-post-test');
  if (postTests.length > 1) flags.add('repeat-post-test');
  if (postTest && others.length > training.length) flags.add('played-after-post-test');
  if (postTest && postTest.attempt.levelId !== POST_TEST_LEVEL_ID) flags.add('post-test-not-final-exam');
  if (attempts.length === 0) flags.add('no-attempts');

  // Who played what, and under which group.
  const assignment = source.assignment;
  if (!assignment) flags.add('unassigned');
  if (!source.participant) flags.add('not-enrolled');
  if (assignment?.method === 'manual') flags.add('manual-assignment');
  for (const stored of attempts) {
    const routing = stored.routing;
    if (!routing) {
      flags.add('missing-routing-record');
      continue;
    }
    if (routing.override) flags.add('override');
    if (routing.mode === 'legacy' || routing.groupInEffect === 'legacy') flags.add('legacy-attempts');
    if (assignment && stored.attempt.timestamp < assignment.assignedAt) flags.add('played-before-assignment');
    else if (assignment && !routing.override && routing.groupInEffect !== 'legacy' && routing.groupInEffect !== assignment.group) {
      flags.add('group-mismatch');
    }
    if (routing.truncated) flags.add('truncated-telemetry');
  }
  for (const stored of attempts) {
    if (stored.routing && !attemptPlay(stored)) flags.add('play-unrecorded');
    if ((attemptPlay(stored)?.lostMs ?? 0) >= FELL_BEHIND_MS) flags.add('fell-behind');
    if (attemptTimedOut(stored)) flags.add('timed-out');
  }
  for (const stored of attempts) {
    if (!stored.fsm) flags.add('missing-fsm-record');
    else if (stored.fsm.truncated) flags.add('truncated-telemetry');
    if (!stored.decisions) flags.add('missing-decision-record');
    else if (stored.decisions.truncated) flags.add('truncated-telemetry');
  }

  // Training: attempts, time and progress.
  const course = training.filter(stored => kindOf(stored) === 'course');
  const reviews = training.filter(stored => kindOf(stored) === 'review');
  const durations = training.map(attemptDurationMs);
  const starts = training.map(stored => attemptStart(stored) ?? stored.attempt.timestamp);
  const storyFirst = starts.length > 0 ? Math.min(...starts) : null;
  const storyLast = training.length > 0 ? Math.max(...training.map(stored => stored.attempt.timestamp)) : null;
  const passedLevels = training.filter(attemptPassed).map(stored => stored.attempt.levelId);
  const courseFinal = training.filter(
    stored => stored.attempt.levelId === POST_TEST_LEVEL_ID && (kindOf(stored) === 'course' || kindOf(stored) === 'legacy')
  );
  const cursor = readStoredCursor(source.cursor);

  const playWindowEnd = postTestStart ?? storyLast;
  const during = (timestamp: number) =>
    storyFirst !== null && playWindowEnd !== null && timestamp >= storyFirst && timestamp <= playWindowEnd;
  if (source.examSittings.some(sitting => during(sitting.timestamp))) flags.add('mock-exam-during-play');
  if (source.dailyAnswers.some(answer => during(answer.timestamp))) flags.add('daily-challenge-during-play');

  // Competencies: BKT over training, accuracy in training and on the post-test.
  const trainingGraded = training.map(gradedDecisions);
  if (trainingGraded.some(graded => !graded.penaltiesKnown)) flags.add('penalties-unknown');
  const trainingDecisions = trainingGraded.flatMap(graded => graded.decisions);
  const postTestDecisions = postTest ? gradedDecisions(postTest).decisions : [];
  const profile = buildBKTLearnerProfile(chronologicalLogs(training));
  const competencies: CompetencyDetail[] = COMPETENCIES.map(competency => {
    const inTraining = trainingDecisions.filter(d => d.competency === competency);
    const onPostTest = postTestDecisions.filter(d => d.competency === competency);
    return {
      competency,
      mastery: profile[competency].score,
      trainingDecisions: inTraining.length,
      trainingAccuracy: round(accuracy(inTraining)),
      postTestDecisions: onPostTest.length,
      postTestAccuracy: round(accuracy(onPostTest)),
    };
  });
  const detail = (competency: DrivingCompetency | null) =>
    competency ? competencies.find(entry => entry.competency === competency)! : null;
  const weakest = training.length > 0 ? detail(getLowestScoringCompetency(profile, 'least-observed')) : null;
  // Ties to the least observed, as for the weakest.
  const practised = competencies
    .filter(entry => entry.trainingDecisions > 0)
    .sort((a, b) => a.mastery - b.mastery || a.trainingDecisions - b.trainingDecisions)[0] ?? null;
  const postTestCompetencies = competencies.filter(entry => entry.postTestAccuracy !== null);
  const postTestTimes = postTest ? timeliness(postTest) : null;
  const postTestPlay = postTest ? attemptPlay(postTest) : null;
  const trainingPlays = training.map(attemptPlay).filter((play): play is PlayConditions => play !== null);
  const trainingRates = trainingPlays.map(play => play.frameRate).filter((rate): rate is number => rate !== null);

  const routingLog = attempts
    .flatMap(stored => stored.routing?.log ?? [])
    .sort((a, b) => a.seq - b.seq);

  const row: ParticipantRow = {
    uid: source.uid,
    code: source.participant?.code ?? null,
    cohort: source.participant?.cohort ?? null,
    group: assignment?.group ?? null,
    assignedAt: iso(assignment?.assignedAt),
    assignmentMethod: assignment?.method ?? null,

    attempts: training.length,
    courseAttempts: course.length,
    reviews: reviews.length,
    practiceItems: training.filter(stored => stored.routing?.entry?.item).length,
    freeReplays: training.filter(stored => kindOf(stored) === 'free-replay').length,
    failedCourseAttempts: [...course, ...reviews].filter(stored => !attemptPassed(stored)).length,
    timedOutAttempts: training.filter(attemptTimedOut).length,
    reentries: [...course, ...reviews].reduce((sum, stored) => sum + Math.max(0, (stored.routing?.entry?.starts ?? 1) - 1), 0),
    storyFirstAt: iso(storyFirst),
    storyLastAt: iso(storyLast),
    storySpanMinutes: storyFirst !== null && storyLast !== null ? minutes(storyLast - storyFirst) : null,
    driveMinutes: minutes(durations.reduce<number>((sum, ms) => sum + (ms ?? 0), 0)) ?? 0,
    untimedAttempts: durations.filter(ms => ms === null).length,

    frontier: cursor ? stateId(cursor.state) : null,
    highestLevelPassed: passedLevels.length > 0 ? Math.max(...passedLevels) : null,
    certified: cursor?.state.kind === 'CERTIFIED',
    gradedDecisionsSpent: cursor?.decisionsSpent ?? null,
    courseFinalExamAttempts: courseFinal.length,
    courseFinalExamBestScore: courseFinal.length > 0 ? Math.max(...courseFinal.map(stored => stored.attempt.finalScore)) : null,
    courseFinalExamPassed: courseFinal.some(attemptPassed),

    postTestAt: iso(postTestStart),
    postTestScore: postTest?.attempt.finalScore ?? null,
    postTestPassed: postTest ? attemptPassed(postTest) : null,
    postTestCrashed: postTest ? attemptCrashed(postTest) : null,
    postTestTimedOut: postTest ? attemptTimedOut(postTest) : null,
    postTestMinutes: postTest ? minutes(attemptDurationMs(postTest)) : null,
    postTestDecisions: postTest ? postTestDecisions.length : null,
    postTestAccuracy: postTest ? round(accuracy(postTestDecisions)) : null,
    postTestMinCompetencyAccuracy:
      postTestCompetencies.length > 0 ? Math.min(...postTestCompetencies.map(entry => entry.postTestAccuracy!)) : null,
    postTestResponses: postTestTimes?.responses ?? null,
    postTestCensored: postTestTimes?.censored ?? null,
    postTestMedianReactionMs: postTestTimes?.median ?? null,
    postTestSeed: postTest?.decisions?.attemptSeed ?? null,
    postTestInput: postTestPlay?.input ?? null,
    postTestViewport: postTestPlay ? `${postTestPlay.viewport.width}x${postTestPlay.viewport.height}` : null,
    postTestFrameRate: postTestPlay?.frameRate ?? null,
    postTestLostMs: postTestPlay?.lostMs ?? null,
    postTestPauses: postTestPlay?.pauses ?? null,

    trainingInputs: inputsUsed(trainingPlays),
    trainingMinFrameRate: trainingRates.length > 0 ? Math.min(...trainingRates) : null,
    trainingLostMs: trainingPlays.length > 0 ? trainingPlays.reduce((sum, play) => sum + play.lostMs, 0) : null,

    weakestCompetency: weakest?.competency ?? null,
    weakestMastery: weakest?.mastery ?? null,
    weakestTrainingDecisions: weakest?.trainingDecisions ?? null,
    weakestTrainingAccuracy: weakest?.trainingAccuracy ?? null,
    weakestPostTestDecisions: postTest && weakest ? weakest.postTestDecisions : null,
    weakestPostTestAccuracy: postTest && weakest ? weakest.postTestAccuracy : null,
    weakestPractisedCompetency: practised?.competency ?? null,
    weakestPractisedMastery: practised?.mastery ?? null,
    weakestPractisedTrainingAccuracy: practised?.trainingAccuracy ?? null,
    weakestPractisedPostTestAccuracy: postTest && practised ? practised.postTestAccuracy : null,

    routingLogEntries: routingLog.length,
    flags: [...flags].sort().join(';'),
  };

  return {
    row,
    competencies,
    routingLog,
    postTestRoute: postTest?.routing?.entry?.route ?? null,
  };
};

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = <T extends object>(rows: readonly T[], columns: ReadonlyArray<keyof T>): string =>
  [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\n') + '\n';
