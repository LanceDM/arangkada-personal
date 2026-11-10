/**
 * The per-competency course as the game plays it,
 * ported from the groupmate's course onto this repository's ports: lessons,
 * the short quiz (the stage's gate), the drive and its repeat drives, then the
 * final exam.
 *
 * Each step loads what it needs, applies one move of the course machine
 * (`@/domain/competencyRouting/course`) and commits it through
 * `CompetencyCourseRepository.commitStep`: the step's own record, the shared
 * Q-table and its log, the course log and the cursor, all or nothing.
 *
 * What is evidence: drives and quiz answers, and the pre-test's seed (no
 * learning step). The post-test never reaches here: it is the study's outcome
 * measure, and rewarding decisions with it would make the outcome train the
 * policy it judges. The tutorial is not evidence.
 */
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { QUIZ_PASS_CORRECT, isCompetencyStage } from '@/domain/learner/stageCompetencies';
import {
  driveCompetencies,
  driveCompleted,
  finalCompleted,
  finalMeasured,
  lessonsRead,
  phaseId,
  phaseLevel,
  quizMeasured,
  quizReviewDone,
  quizSubmitted,
  reviewShown,
  sameCursor,
  startingCourse,
  type CompetencyMeasurement,
  type CourseCursor,
  type QuizAnswer,
} from '@/domain/competencyRouting/course';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import { buildEvidenceBKTProfile, evidenceCounts } from '@/domain/learner/mastery/evidenceBKT';
import {
  PRE_TEST_SEED_RECORD_ID,
  fingerprintOf,
  orderEvidence,
  stepRecordId,
  type EvidenceRecord,
} from '@/domain/study/evidence';
import type { StudyEnvelope } from '@/domain/study/studyEvent';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { newEventId } from '@/domain/study/studyEvent';
import { createRng } from '@/shared/lib/rng';
import { buildLevelConfig } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { composeDrive, type ComposedDrive } from '@/features/driving-sim/domain/scenario/composeDrive';
import { drawCourseQuiz, type CourseQuizDraw } from '@/features/driving-sim/domain/scenario/courseQuiz';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { QuizItemDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import { competencyVerdicts, type CompetencyVerdict } from '@/features/driving-sim/domain/scoring/competencyVerdict';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import { CourseConflictError } from '../errors';
import type {
  BKTLogRepository,
  CompetencyCourseRepository,
  CourseQuizSitting,
  CourseStep,
  EvidenceWrite,
  PreTestSeed,
  QTableId,
  QuizBankRepository,
} from '../ports';
import { buildBKTLog } from '@/domain/study/bktLog';

/** What the course reads and writes, passed in so tests can hand it a fake store. */
export interface CourseDeps {
  course: CompetencyCourseRepository;
  quizBank: QuizBankRepository;
  /** The shared Q-table this account trains (its cohort's, or `test`). */
  table: QTableId;
  /** The participant's BKT log; absent, none is written. */
  bktLog?: BKTLogRepository;
  /** The participant's code, stamped on every Q-table log entry; null for a team account. */
  participantCode: string | null;
  now?: () => number;
  random?: () => number;
  /** A fresh attempt seed, used only when nothing is open at this position. */
  newSeed?: () => number;
  /** The git commit the app was built from. */
  appBuild?: string;
  sessionId?: string;
}

const clock = (deps: CourseDeps) => deps.now ?? Date.now;
const randomOf = (deps: CourseDeps) => deps.random ?? Math.random;
const seedOf = (deps: CourseDeps) => deps.newSeed ?? (() => Math.floor(Math.random() * 2 ** 31));

// --- evidence -----------------------------------------------------------------

/**
 * The pre-test's seed as graded logs. Under P(T) = 0 the order of the answers
 * does not change BKT's result, so a correct-then-wrong run per competency is
 * the same evidence as the sitting itself.
 */
export const preTestSeedLogs = (seed: PreTestSeed): ActionLog[] =>
  COMPETENCIES.flatMap(competency => {
    const count = seed.counts[competency];
    if (!count) return [];
    return Array.from({ length: count.total }, (_, i): ActionLog => ({
      timestamp: seed.timestamp,
      action: 'pre_test',
      result: i < count.correct ? 'correct' : 'violation',
      points: 0,
      competency,
      source: 'pre_test',
    }));
  });

/** The pre-test seed is read before every drive and quiz record, whatever its number. */
const seedRecord = (seed: PreTestSeed): EvidenceRecord => ({
  kind: 'pre_test',
  levelId: null,
  attempt: null,
  evidenceSeq: 0,
  timestamp: seed.timestamp,
  logs: preTestSeedLogs(seed),
  ref: PRE_TEST_SEED_RECORD_ID,
});

/** Every graded answer BKT reads, in order, with `extra` as it will be once saved (numbered last). */
export const loadCourseEvidence = async (
  deps: CourseDeps,
  uid: string,
  extra?: Omit<EvidenceRecord, 'evidenceSeq'>
): Promise<ActionLog[]> => {
  const [records, seed] = await Promise.all([deps.course.loadEvidence(uid), deps.course.loadPreTestSeed(uid)]);
  const last = Math.max(0, ...records.map(r => r.evidenceSeq ?? 0));
  const all = [...(seed ? [seedRecord(seed)] : []), ...records, ...(extra ? [{ ...extra, evidenceSeq: last + 1 }] : [])];
  return orderEvidence(all).logs;
};

const measure = (
  logs: readonly ActionLog[],
  results: readonly { competency: DrivingCompetency; accuracy: number; passed: boolean }[]
): CompetencyMeasurement[] => {
  const mastery = buildEvidenceBKTProfile(logs);
  const counts = evidenceCounts(logs);
  return results.map(r => ({ ...r, masteryP: mastery[r.competency], driveEvidence: counts[r.competency].drive }));
};

// --- committing -----------------------------------------------------------------

export const loadCourse = async (deps: CourseDeps, uid: string): Promise<CourseCursor> =>
  (await deps.course.loadCursor(uid)) ?? startingCourse();

/** Refuses early when the stored cursor has moved on; the commit checks again, atomically. */
const ensureCurrent = async (deps: CourseDeps, uid: string, cursor: CourseCursor): Promise<void> => {
  const stored = await deps.course.loadCursor(uid);
  if (stored && !sameCursor(stored, cursor)) throw new CourseConflictError(stored);
};

const commit = async (
  deps: CourseDeps,
  uid: string,
  from: CourseCursor,
  compute: (table: QTable) => CourseStep,
  options: { attemptId?: string | null; evidence?: EvidenceWrite | null } = {}
) => {
  const at = clock(deps)();
  const random = randomOf(deps);
  const envelope = (i: number): StudyEnvelope => ({
    schemaVersion: 1,
    eventId: newEventId(at + i, random),
    uid,
    at: at + i,
    sessionId: deps.sessionId ?? 'unknown',
    appBuild: deps.appBuild ?? 'unknown',
    configVersion: RUN_CONFIG_VERSION,
  });
  const committed = await deps.course.commitStep(uid, {
    table: deps.table,
    expected: from,
    compute,
    context: { participantCode: deps.participantCode, levelId: phaseLevel(from.phase), phase: phaseId(from.phase), attemptId: options.attemptId ?? null },
    envelope,
    evidence: options.evidence ?? null,
  });
  if (options.evidence) await recordCourseBKT(deps, uid);
  return committed;
};

/**
 * Brings the participant's BKT log up to date with every saved answer: one
 * entry for each answer not yet logged, and the profile. It is rebuilt from
 * the evidence, so a write lost here is written by the next step; a failure
 * never undoes the step it follows.
 */
export const recordCourseBKT = async (deps: CourseDeps, uid: string): Promise<void> => {
  if (!deps.bktLog) return;
  try {
    const [records, seed, profile] = await Promise.all([
      deps.course.loadEvidence(uid),
      deps.course.loadPreTestSeed(uid),
      deps.bktLog.loadProfile(uid),
    ]);
    const { logs, origins } = orderEvidence([...(seed ? [seedRecord(seed)] : []), ...records]);
    const at = clock(deps)();
    const random = randomOf(deps);
    const log = buildBKTLog({
      uid,
      logs,
      origins,
      alreadyLogged: profile?.updates ?? 0,
      envelope: i => ({
        schemaVersion: 1, eventId: newEventId(at + i, random), at: at + i,
        sessionId: deps.sessionId ?? 'unknown', appBuild: deps.appBuild ?? 'unknown', configVersion: RUN_CONFIG_VERSION,
      }),
      now: at,
      configVersion: RUN_CONFIG_VERSION,
    });
    if (log.entries.length > 0) await deps.bktLog.save(uid, log.profile, log.entries);
  } catch (failure) {
    console.error('Could not write the BKT log:', failure);
  }
};

const plainMove = (to: CourseCursor) => (): CourseStep => ({ cursor: to, decisions: [], rewards: [], operations: [], log: null });

const moveCursor = async (deps: CourseDeps, uid: string, from: CourseCursor, to: CourseCursor): Promise<CourseCursor> =>
  (await commit(deps, uid, from, plainMove(to))).step.cursor;

/** A course position's fingerprint: what an open quiz or drive is tied to. */
export const coursePosition = (cursor: CourseCursor): string => fingerprintOf(cursor);

const openActivity = (deps: CourseDeps, uid: string, cursor: CourseCursor, kind: 'quiz' | 'drive') =>
  deps.course.openActivity(uid, { kind, position: coursePosition(cursor), seed: seedOf(deps)(), openedAt: clock(deps)() });

// --- module and quiz --------------------------------------------------------------

export const markCourseLessonsRead = (deps: CourseDeps, uid: string, cursor: CourseCursor) =>
  moveCursor(deps, uid, cursor, lessonsRead(cursor));

export const finishCourseQuizReview = (deps: CourseDeps, uid: string, cursor: CourseCursor) =>
  moveCursor(deps, uid, cursor, quizReviewDone(cursor));

export const markCourseReviewShown = (deps: CourseDeps, uid: string, cursor: CourseCursor) =>
  moveCursor(deps, uid, cursor, reviewShown(cursor));

/** The quiz at this course position: the same items on every reload until it is submitted. */
export const openCourseQuiz = async (
  deps: CourseDeps,
  uid: string,
  cursor: CourseCursor,
  level: Pick<LevelConfig, 'moduleId'>
): Promise<CourseQuizDraw> => {
  if (cursor.phase.kind !== 'QUIZ' || !cursor.quiz) throw new Error(`no quiz in ${phaseId(cursor.phase)}`);
  const [{ seed }, bank] = await Promise.all([openActivity(deps, uid, cursor, 'quiz'), deps.quizBank.load(level.moduleId)]);
  return drawCourseQuiz(bank.items, cursor.quiz.remaining, cursor.quiz.seenItems, createRng(seed));
};

export interface QuizCompetencyResult {
  competency: DrivingCompetency;
  correct: number;
  total: number;
  passed: boolean;
}

/** A course quiz answer as a graded log BKT reads (`choice` null: unanswered, not evidence). */
export const quizAnswerLog = (item: QuizItemDoc, choice: number | null, at: number, attempt: number): ActionLog => ({
  timestamp: at,
  action: choice === null ? 'unanswered' : `choice_${choice}`,
  result: choice === item.correctIndex ? 'correct' : 'violation',
  points: 0,
  competency: item.competency,
  expectedAction: `choice_${item.correctIndex}`,
  source: 'quiz',
  itemId: item.id,
  quizAttempt: attempt,
  ...(choice === null ? { unanswered: true as const } : {}),
});

export const submitCourseQuiz = async (
  deps: CourseDeps,
  uid: string,
  cursor: CourseCursor,
  items: readonly QuizItemDoc[],
  choices: readonly (number | null)[]
): Promise<{ cursor: CourseCursor; results: QuizCompetencyResult[] }> => {
  await ensureCurrent(deps, uid, cursor);
  const at = clock(deps)();
  const level = phaseLevel(cursor.phase) ?? 0;
  const attempt = cursor.quiz?.attempt ?? 1;
  const answers = items.map((item, i) => quizAnswerLog(item, choices[i] ?? null, at + i, attempt));
  const graded: QuizAnswer[] = items.map((item, i) => ({ itemId: item.id, competency: item.competency, correct: choices[i] === item.correctIndex }));
  const competencies = [...new Set(items.map(item => item.competency))];
  const results = competencies.map(competency => {
    const mine = graded.filter(answer => answer.competency === competency);
    const correct = mine.filter(answer => answer.correct).length;
    return { competency, correct, total: mine.length, passed: correct >= QUIZ_PASS_CORRECT };
  });

  const submitted = quizSubmitted(cursor, graded);
  const measured = submitted.pending.some(p => competencies.includes(p.competency));
  const measurements = measured
    ? measure(
        await loadCourseEvidence(deps, uid, { kind: 'quiz', levelId: level, attempt, timestamp: at, logs: answers }),
        results.map(r => ({ competency: r.competency, accuracy: r.total > 0 ? r.correct / r.total : 0, passed: r.passed }))
      )
    : [];
  const sitting: CourseQuizSitting = { schemaVersion: 1, kind: 'quiz', levelId: level, attempt, answers, timestamp: at };

  const { step } = await commit(deps, uid, cursor, table => {
    if (measurements.length === 0) return plainMove(submitted)();
    const outcome = quizMeasured(submitted, measurements, table, at);
    return {
      cursor: outcome.cursor,
      decisions: [],
      rewards: outcome.rewards,
      operations: outcome.operations,
      log: outcome.operations.length === 0 ? null : {
        schemaVersion: 1, kind: 'quiz', levelId: level, phase: phaseId(cursor.phase), attemptId: null,
        verdicts: measurements.map((m, i) => ({ competency: m.competency, total: results[i].total, correct: results[i].correct, passed: m.passed, masteryP: m.masteryP, driveEvidence: m.driveEvidence })),
        timestamp: at,
      },
    };
  }, { evidence: { kind: 'sitting', id: stepRecordId('quiz', `${phaseId(cursor.phase)}-a${attempt}`, cursor), sitting } });
  return { cursor: step.cursor, results };
};

// --- drives ---------------------------------------------------------------------

export interface CourseDriveRun {
  levelId: number;
  level: LevelConfig;
  /** The counted scenarios; null for the tutorial, which counts none. */
  composed: ComposedDrive | null;
  attemptSeed: number;
}

/** Every final-exam item scores the same, so the pass mark means one thing. */
const FINAL_POINTS = 25;

/**
 * The drive the cursor is at, the same on every reload: the tutorial as
 * authored; a stage drive with 3 scenarios per competency still to finish,
 * unseen first; the final exam with one scenario per competency (TENTATIVE),
 * every item on one 25-point scale and a 70% pass mark.
 */
export const planCourseDrive = async (deps: CourseDeps, uid: string, cursor: CourseCursor): Promise<CourseDriveRun> => {
  const { phase } = cursor;
  const { seed } = await openActivity(deps, uid, cursor, 'drive');
  const seen = new Map(Object.entries(cursor.seen));
  if (phase.kind === 'DRIVE' && phase.level === 0) {
    return { levelId: 0, level: buildLevelConfig(0, undefined, null, createRng(seed))!, composed: null, attemptSeed: seed };
  }
  if ((phase.kind === 'DRIVE' || phase.kind === 'REPEAT') && isCompetencyStage(phase.level)) {
    const composed = composeDrive({ levelId: phase.level, competencies: driveCompetencies(cursor), seen, rng: createRng(seed) });
    return { levelId: phase.level, level: composed.level, composed, attemptSeed: seed };
  }
  if (phase.kind === 'FINAL') {
    const composed = composeDrive({ levelId: 12, competencies: COMPETENCIES, seen, rng: createRng(seed), perCompetency: 1 });
    const events = composed.level.events.map(event => ({ ...event, points: FINAL_POINTS, severity: 'major' as const }));
    const total = events.length * FINAL_POINTS;
    const level = { ...composed.level, events, requiredScore: Math.round(total * 0.7), stars2: Math.round(total * 0.85), stars3: Math.round(total * 0.95) };
    return { levelId: 12, level, composed: { ...composed, level }, attemptSeed: seed };
  }
  throw new Error(`no drive in ${phaseId(phase)}`);
};

export interface CourseDriveSettled {
  cursor: CourseCursor;
  verdicts: CompetencyVerdict[];
  attemptId: string;
}

const scenarioIdsOf = (level: LevelConfig): string[] => [
  ...level.events.map(event => event.id),
  ...(level.garage?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
  ...(level.aftermath?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
];

/**
 * A course drive ended: the attempt is saved; each counted competency gets its
 * verdict (2 of 3) and, on a stage drive, its decision; pending decisions are
 * rewarded where this drive measured their competency; all in one commit.
 */
export const completeCourseDrive = async (
  deps: CourseDeps,
  uid: string,
  cursor: CourseCursor,
  run: CourseDriveRun,
  result: LevelResult,
  /** What else the attempt carries inline: the compact FSM summary, the language. */
  extras: Partial<Pick<LevelAttempt, 'fsmMetrics' | 'reactionLatencies' | 'timedOut' | 'language' | 'play'>> = {}
): Promise<CourseDriveSettled> => {
  await ensureCurrent(deps, uid, cursor);
  const now = clock(deps)();
  const attemptId = stepRecordId(cursor.phase.kind === 'FINAL' ? 'final' : 'drive', phaseId(cursor.phase), cursor);
  const attempt: LevelAttempt = {
    levelId: result.levelId,
    timestamp: now,
    finalScore: result.score,
    violations: result.violations,
    correctDecisions: result.correctActions,
    logs: result.logs,
    ...extras,
  };
  const evidence: EvidenceWrite = { kind: 'attempt', id: attemptId, attempt };
  const scenarioIds = scenarioIdsOf(run.level);
  const random = randomOf(deps);

  if (!run.composed) {
    const { step } = await commit(
      deps, uid, cursor,
      () => plainMove(driveCompleted(cursor, { measurements: [], scenarioIds, table: {}, rng: random, now }).cursor)(),
      { attemptId, evidence }
    );
    return { cursor: step.cursor, verdicts: [], attemptId };
  }

  // A crash or a timeout ends the drive unfinished: no topic is passed on it,
  // whatever it had right before (as a crash or timeout fails a level).
  const verdicts = competencyVerdicts(run.composed.items, result.logs).map(v => (result.completed ? v : { ...v, passed: false }));
  const measurements = measure(
    await loadCourseEvidence(deps, uid, { kind: 'attempt', levelId: result.levelId, attempt: null, timestamp: now, logs: result.logs }),
    verdicts.map(v => ({ competency: v.competency, accuracy: v.accuracy, passed: v.passed }))
  );
  const logged = measurements.map((m, i) => ({
    competency: m.competency, total: verdicts[i].total, correct: verdicts[i].correct, passed: m.passed, masteryP: m.masteryP, driveEvidence: m.driveEvidence,
  }));

  if (cursor.phase.kind === 'FINAL') {
    const passed = result.completed;
    const { step } = await commit(deps, uid, cursor, table => {
      const settled = finalMeasured(cursor, measurements, table, now);
      return {
        cursor: finalCompleted(settled.cursor, passed, scenarioIds),
        decisions: [],
        rewards: settled.rewards,
        operations: settled.operations,
        log: {
          schemaVersion: 1, kind: 'final', levelId: 12, phase: phaseId(cursor.phase), attemptId, verdicts: logged, timestamp: now,
          ...(passed ? { endReason: 'certified' as const } : {}),
        },
      };
    }, { attemptId, evidence });
    return { cursor: step.cursor, verdicts, attemptId };
  }

  // A competency the road could give no scenario is closed for the stage, never measured here.
  const measured = new Set(verdicts.map(v => v.competency));
  const unmeasurable = driveCompetencies(cursor).filter(competency => !measured.has(competency));
  const { step } = await commit(deps, uid, cursor, table => {
    const drive = driveCompleted(cursor, { measurements, scenarioIds, table, rng: random, now, unmeasurable });
    return {
      cursor: drive.cursor,
      decisions: drive.decisions,
      rewards: drive.rewards,
      operations: drive.operations,
      log: {
        schemaVersion: 1, kind: 'drive', levelId: run.levelId, phase: phaseId(cursor.phase), attemptId, verdicts: logged, timestamp: now,
        ...(drive.decisions.some(d => d.source === 'cap') ? { endReason: 'cap_reached' as const } : {}),
      },
    };
  }, { attemptId, evidence });
  return { cursor: step.cursor, verdicts, attemptId };
};
