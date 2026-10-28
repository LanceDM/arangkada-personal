/**
 * The per-competency course (redesign of 2026-10-27/28), as the game plays it:
 * sign in, diagnostic pre-test, tutorial, then each stage's module, short quiz
 * (gate), drive and repeat drives, the final exam, and the post-evaluation
 * exam. Every participant plays the same flow; there is no comparison group.
 *
 * Each function loads what it needs, applies one move of the routing FSM
 * (`@/domain/competencyRouting/course`), and saves the result in one
 * transaction before it returns: the step's own record (the drive or the
 * sitting, under a fixed id), the shared table and its log, the course log and
 * the cursor, all or nothing. What is derived from those records (the event
 * stream, the BKT log, drive telemetry) is written right after, under ids a
 * second write cannot duplicate, and is rebuilt by the next step if lost.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { buildBKTEvidence, buildBKTProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { COMPETENCIES } from '@/domain/learner/profile';
import { DRIVE_PASS_CORRECT, QUIZ_PASS_CORRECT, STAGE_COMPETENCIES, isCompetencyStage } from '@/domain/learner/stageCompetencies';
import {
  driveCompetencies,
  driveCompleted,
  finalCompleted,
  lessonsRead,
  phaseId,
  phaseLevel,
  postExamCompleted,
  quizReviewDone,
  quizSubmitted,
  quizMeasured,
  finalMeasured,
  reviewShown,
  startingCourse,
  type CompetencyMeasurement,
  type CourseCursor,
  type QuizAnswer,
} from '@/domain/competencyRouting/course';
import { drawQuiz, type QuizDraw } from '@/domain/assessment/drawQuiz';
import { DIAGNOSTIC_ITEMS, POST_EXAM_ITEMS, itemsFor, type BankItem } from '@/domain/assessment/questionBank';
import { raschEAP } from '@/domain/assessment/rasch';
import { createRng } from '@/shared/lib/rng';
import { BACKGROUND_FORM_ENABLED, BACKGROUND_FORM_VERSION, isCompleteBackground } from '@/domain/study/backgroundForm';
import type { LevelResult } from '@/domain/learner/attempt';
import type { LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import { composeDrive, type ComposedDrive } from '@/features/driving-sim/domain/scenario/composeDrive';
import { buildLevelConfig } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { competencyVerdicts, type CompetencyVerdict } from '@/features/driving-sim/domain/scoring/competencyVerdict';
import { pausedMsOf } from '@/features/driving-sim/domain/scoring/levelAttempt';
import { buildDecisionTelemetry, recordRoutedDecision } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { drivingSimDeps } from '../dependencies';
import { envelopeFor, recordBKT, recordEvents } from '../studyRecorder';
import type { QLogContext, QLogEntry } from '@/domain/study/qLog';
import type { StudyEventDraft } from '@/domain/study/studyEvent';
import { scenarioFormat, type ScenarioFormat } from '@/features/driving-sim/domain/scenario/scenarioFormat';
import { sameCursor } from '@/domain/competencyRouting/course';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import type { AssessmentSitting, CourseStep, EvidenceWrite } from '../ports';
import { CourseConflictError, OutdatedAppError } from '../errors';
import { loadEvidenceRecords } from '../studyRecorder';
import { nextAttemptSeed } from '../attemptSeed';
import { DIAGNOSTIC_RECORD_ID, fingerprintOf, orderEvidence, stepRecordId, type EvidenceRecord } from '@/domain/study/evidence';
import { newEventId } from '@/domain/study/studyEvent';
import type { AdaptivePlan } from './buildAdaptivePlan';

// --- loading ------------------------------------------------------------------

export interface CourseState {
  cursor: CourseCursor;
  diagnosticDone: boolean;
  postExamDone: boolean;
  /** Whether the background form is asked at all (muted by default). */
  backgroundRequired: boolean;
  backgroundDone: boolean;
  sittings: AssessmentSitting[];
}

export const loadCompetencyCourse = async (uid: string): Promise<CourseState> => {
  const { competencyCourse, assessments, background, backgroundFormEnabled } = drivingSimDeps();
  const backgroundRequired = backgroundFormEnabled ?? BACKGROUND_FORM_ENABLED;
  const [cursor, sittings, form] = await Promise.all([
    competencyCourse.loadCursor(uid),
    assessments.load(uid),
    backgroundRequired ? background.load(uid) : Promise.resolve(null),
  ]);
  return {
    cursor: cursor ?? startingCourse(),
    diagnosticDone: sittings.some(sitting => sitting.kind === 'diagnostic'),
    postExamDone: sittings.some(sitting => sitting.kind === 'post_exam'),
    backgroundRequired,
    backgroundDone: form !== null,
    sittings,
  };
};

/** Saves the background form (study procedure step 2). */
export const saveBackground = async (uid: string, answers: Record<string, string>): Promise<void> => {
  if (!isCompleteBackground(answers)) throw new Error('Every background question needs an answer.');
  await drivingSimDeps().background.save(uid, {
    schemaVersion: 1,
    formVersion: BACKGROUND_FORM_VERSION,
    answers,
    timestamp: Date.now(),
  });
  await recordEvents(uid, [{ type: 'background_submitted', payload: { formVersion: BACKGROUND_FORM_VERSION, answers } }]);
};

/** Every graded answer BKT reads, in the order saved: drives (tutorial left out), quiz, diagnostic and post-exam answers. */
export const loadEvidence = async (uid: string): Promise<ActionLog[]> => orderEvidence(await loadEvidenceRecords(uid)).logs;

/**
 * The evidence as it will be once `record` is saved: it is numbered after
 * every record already saved, so its answers come last. A step computes its
 * BKT-based measurements from this before it commits, so the record and the
 * decisions it leads to are saved together.
 */
const evidenceWith = async (uid: string, record: Omit<EvidenceRecord, 'evidenceSeq'>): Promise<ActionLog[]> => {
  const records = await loadEvidenceRecords(uid);
  const last = Math.max(0, ...records.map(r => r.evidenceSeq ?? 0));
  return orderEvidence([...records, { ...record, evidenceSeq: last + 1 }]).logs;
};

/**
 * Refuses, writing nothing, when the site now serves a newer build than this
 * tab runs (a tab left open across a deploy). The settings version is checked
 * again inside every transaction.
 */
const ensureLatestApp = async (): Promise<void> => {
  const { latestBuild, appBuild } = drivingSimDeps();
  if (!latestBuild || !appBuild || appBuild === 'unknown') return;
  const latest = await latestBuild();
  if (latest && latest !== appBuild) throw new OutdatedAppError(appBuild, latest);
};

/** A course position's fingerprint: what an open quiz or drive is tied to. */
export const coursePosition = (cursor: CourseCursor): string => fingerprintOf(cursor);

/** The course_transition event: from, to, and what triggered it. */
const transitionEvent = (from: CourseCursor, to: CourseCursor, trigger: string): StudyEventDraft => ({
  type: 'course_transition',
  levelId: phaseLevel(to.phase),
  phase: phaseId(to.phase),
  payload: {
    from: phaseId(from.phase),
    to: phaseId(to.phase),
    trigger,
    quiz: to.quiz,
    pendingDecisions: to.pending.length,
    seq: to.seq,
    flagged: to.flagged.length,
  },
});

/** Each decision and reward mirrored into the participant's event stream, linked to its Q-log entry. */
const policyEvents = (step: CourseStep, entries: readonly QLogEntry[], context: Omit<QLogContext, 'participantCode'>): StudyEventDraft[] => {
  const byDecision = new Map(entries.map(e => [`${e.kind}:${e.decisionId}`, e]));
  return [
    ...step.rewards.map(reward => {
      const entry = byDecision.get(`learn:${reward.decisionId}`);
      return {
        type: 'reward_computed' as const,
        ...context,
        payload: { ...reward, qUpdateId: entry?.eventId ?? null, globalSeq: entry?.globalSeq ?? null, learning: entry?.learning ?? null },
      };
    }),
    ...step.decisions.map(decision => {
      const decisionId = `${decision.levelId}:${decision.competency}:${decision.seq}`;
      const entry = byDecision.get(`visit:${decisionId}`);
      return {
        type: 'policy_decision' as const,
        ...context,
        payload: { ...decision, decisionId, qUpdateId: entry?.eventId ?? null, globalSeq: entry?.globalSeq ?? null, stateAfter: entry?.statesAfter[entry.stateKey] ?? null },
      };
    }),
  ];
};

/**
 * Commits one course step: the cursor move, and with it any decisions and
 * rewards, the shared table's update and its log, and the course log entry,
 * all in one transaction (see CompetencyCourseRepository.commitStep).
 *
 * `compute` gets the newest shared table and may run more than once when
 * other participants change the table meanwhile, so it must be pure: read the
 * table, return the step, write nothing. The events are recorded after the
 * commit, from what was actually committed.
 *
 * Throws CourseConflictError when the stored cursor is no longer `from` (a
 * second tab, a double click, a step already saved).
 */
const commit = async (
  uid: string,
  from: CourseCursor,
  trigger: string,
  compute: (table: QTable) => CourseStep,
  options: {
    context?: Omit<QLogContext, 'participantCode'>;
    /** The step's own record: the drive or the sitting, saved in the same transaction. */
    evidence?: EvidenceWrite;
    /** Events about that record, recorded first once it is saved. */
    events?: StudyEventDraft[];
  } = {}
): Promise<{ step: CourseStep; entries: QLogEntry[]; table: QTable }> => {
  const context = options.context ?? { levelId: phaseLevel(from.phase), phase: phaseId(from.phase), attemptId: null };
  await ensureLatestApp();
  const now = Date.now();
  const committed = await drivingSimDeps().competencyCourse.commitStep(uid, {
    expected: from,
    compute,
    context: { ...context, participantCode: null },
    envelope: i => envelopeFor(uid, now + i),
    evidence: options.evidence ?? null,
  });
  await recordEvents(uid, [
    ...(options.events ?? []),
    ...policyEvents(committed.step, committed.entries, context),
    transitionEvent(from, committed.step.cursor, trigger),
  ]);
  // BKT reads the record just saved; its log catches up now.
  if (options.evidence) await recordBKT(uid);
  return committed;
};

/** A cursor move with nothing for the shared table. */
const moveCursor = async (uid: string, from: CourseCursor, to: CourseCursor, trigger: string): Promise<CourseCursor> =>
  (await commit(uid, from, trigger, () => ({ cursor: to, decisions: [], rewards: [], operations: [], log: null }))).step.cursor;

/**
 * Refuses early when the stored cursor has already moved on, before a step
 * does any work. The commit checks again, atomically, together with saving
 * the step's record: that check is the one that keeps a record from being
 * saved twice.
 */
const ensureCurrent = async (uid: string, cursor: CourseCursor): Promise<void> => {
  const stored = await drivingSimDeps().competencyCourse.loadCursor(uid);
  if (stored && !sameCursor(stored, JSON.parse(JSON.stringify(cursor)))) throw new CourseConflictError(stored);
};


/** One event per answered item, then one for the sitting. */
const sittingEvents = (
  kind: 'quiz' | 'diagnostic' | 'post_exam',
  items: readonly BankItem[],
  answers: readonly ActionLog[],
  context: { levelId: number | null; phase: string | null; attempt: number | null }
): StudyEventDraft[] => [
  ...answers.map((answer, i) => ({
    type: 'item_answered' as const,
    at: answer.timestamp,
    levelId: context.levelId,
    phase: context.phase,
    payload: {
      sitting: kind,
      quizAttempt: context.attempt,
      position: i + 1,
      itemId: items[i].id,
      competency: items[i].competency,
      choice: answer.action,
      expected: answer.expectedAction ?? null,
      correct: answer.result === 'correct',
      responseMs: answer.reactionTime ?? null,
    },
  })),
  {
    type: 'sitting_submitted' as const,
    levelId: context.levelId,
    phase: context.phase,
    payload: {
      sitting: kind,
      quizAttempt: context.attempt,
      items: answers.length,
      correct: answers.filter(a => a.result === 'correct').length,
      itemIds: items.map(item => item.id),
    },
  },
];

/** Every scenario of a level by id, with its format: road events, garage and aftermath points. */
const formatsOf = (level: LevelConfig | null | undefined): Map<string, ScenarioFormat> =>
  new Map<string, ScenarioFormat>([
    ...(level?.events ?? []).map(event => [event.id, scenarioFormat(event)] as const),
    ...(level?.garage?.hotspots ?? []).map(point => [point.scenarioId ?? point.id, scenarioFormat({}, 'garage')] as const),
    ...(level?.aftermath?.hotspots ?? []).map(point => [point.scenarioId ?? point.id, scenarioFormat({}, 'aftermath')] as const),
  ]);

/** One event per graded decision a drive logged, then the drive's end. */
const driveEvents = (
  result: LevelResult,
  context: { levelId: number; phase: string | null; attemptId: string | null },
  ended: Record<string, unknown>,
  formats: Map<string, ScenarioFormat> = new Map()
): StudyEventDraft[] => [
  ...result.logs.map(log => ({
    type: 'decision_made' as const,
    at: log.timestamp,
    levelId: context.levelId,
    phase: context.phase,
    attemptId: context.attemptId,
    payload: {
      scenarioId: log.scenarioId ?? null,
      format: log.scenarioId ? formats.get(log.scenarioId) ?? null : null,
      ruleId: log.ruleId ?? null,
      competency: log.competency ?? null,
      action: log.action,
      expectedAction: log.expectedAction ?? null,
      result: log.result,
      points: log.points,
      reactionMs: log.reactionTime ?? null,
      timedOut: log.reactionCensored === true,
      questionTimedOut: log.questionTimedOut === true,
      severity: log.severity ?? null,
      weight: log.weight ?? null,
      support: log.support ?? null,
    },
  })),
  {
    type: 'drive_ended' as const,
    levelId: context.levelId,
    phase: context.phase,
    attemptId: context.attemptId,
    payload: {
      completed: result.completed,
      score: result.score,
      stars: result.stars,
      violations: result.violations,
      correctActions: result.correctActions,
      crashReason: result.crashReason ?? null,
      endReason: result.crashReason ? 'crashed' : result.completed ? 'finished' : 'not_completed',
      ...ended,
    },
  },
];

// --- answering bank items -------------------------------------------------------

/** One answered bank item, as a graded log BKT reads. */
export const answerLog = (
  item: BankItem,
  choice: number | null,
  source: 'quiz' | 'diagnostic' | 'post_exam',
  at: number,
  quizAttempt?: number,
  responseMs?: number | null
): ActionLog => ({
  timestamp: at,
  action: choice === null ? 'unanswered' : `choice_${'ABCD'[choice]}`,
  result: choice === item.answer ? 'correct' : 'violation',
  points: 0,
  competency: item.competency,
  expectedAction: `choice_${'ABCD'[item.answer]}`,
  source,
  itemId: item.id,
  ...(quizAttempt !== undefined ? { quizAttempt } : {}),
  // How long the item was on screen before it was answered; BKT does not read it.
  ...(typeof responseMs === 'number' ? { reactionTime: responseMs } : {}),
});

// --- module and quiz ----------------------------------------------------------------

export const markCourseLessonsRead = async (uid: string, cursor: CourseCursor): Promise<CourseCursor> => {
  return moveCursor(uid, cursor, lessonsRead(cursor), 'lessons_read');
};

/** This attempt's quiz: 3 items per competency still to pass, unseen first. */
export const drawCourseQuiz = (cursor: CourseCursor, seed: number): QuizDraw => {
  if (cursor.phase.kind !== 'QUIZ' || !cursor.quiz) throw new Error(`no quiz in ${phaseId(cursor.phase)}`);
  // The diagnostic's items count as already seen (earliest), so a quiz draws
  // items the participant has not met before and reuses a pre-test item only
  // when a thin pool runs out.
  const seen = new Map<string, number>([
    ...Object.values(DIAGNOSTIC_ITEMS).flat().map(id => [id, -1] as [string, number]),
    ...cursor.quiz.seenItems.map((id, index) => [id, index] as [string, number]),
  ]);
  return drawQuiz(cursor.phase.level, cursor.quiz.remaining, seen, createRng(seed));
};

/**
 * The quiz or drive open at this course position: the same seed on every
 * reload until the step is saved. A reopen is logged.
 */
const openCourseActivity = async (uid: string, cursor: CourseCursor, kind: 'quiz' | 'drive', freshSeed: number = nextAttemptSeed()) => {
  const activity = await drivingSimDeps().competencyCourse.openActivity(uid, {
    kind,
    position: coursePosition(cursor),
    seed: freshSeed,
    openedAt: Date.now(),
  });
  if (activity.opens > 1) {
    await recordEvents(uid, [
      {
        type: 'activity_reopened',
        levelId: phaseLevel(cursor.phase),
        phase: phaseId(cursor.phase),
        payload: { kind, seed: activity.seed, opens: activity.opens, openedAt: activity.openedAt },
      },
    ]);
  }
  return activity;
};

/** The quiz at this course position: drawn from the seed it was first opened with. */
export const openCourseQuiz = async (uid: string, cursor: CourseCursor, freshSeed?: number): Promise<QuizDraw> => {
  const { seed } = await openCourseActivity(uid, cursor, 'quiz', freshSeed);
  return drawCourseQuiz(cursor, seed);
};

export interface QuizCompetencyResult {
  competency: DrivingCompetency;
  correct: number;
  total: number;
  passed: boolean;
}

export const submitCourseQuiz = async (
  uid: string,
  cursor: CourseCursor,
  items: readonly BankItem[],
  choices: readonly (number | null)[],
  responseMs: readonly (number | null)[] = []
): Promise<{ cursor: CourseCursor; results: QuizCompetencyResult[] }> => {
  await ensureCurrent(uid, cursor);
  const at = Date.now();
  const attempt = cursor.quiz?.attempt ?? 1;
  const answers = items.map((item, i) => answerLog(item, choices[i] ?? null, 'quiz', at + i, attempt, responseMs[i]));
  const sitting: AssessmentSitting = { schemaVersion: 1, kind: 'quiz', levelId: phaseLevel(cursor.phase), attempt, answers, timestamp: at };
  const graded: QuizAnswer[] = items.map((item, i) => ({ itemId: item.id, competency: item.competency, correct: choices[i] === item.answer }));
  const competencies = [...new Set(items.map(item => item.competency))];
  const results = competencies.map(competency => {
    const mine = graded.filter(answer => answer.competency === competency);
    const correct = mine.filter(answer => answer.correct).length;
    return { competency, correct, total: mine.length, passed: correct >= QUIZ_PASS_CORRECT };
  });

  // The quiz is a measurement: pending decisions on these competencies are
  // rewarded now (Tentative; OPEN, see quizMeasured), on the newest table.
  const submitted = quizSubmitted(cursor, graded);
  const level = phaseLevel(cursor.phase);
  let measurements: CompetencyMeasurement[] = [];
  if (submitted.pending.some(p => competencies.includes(p.competency))) {
    const evidence = await evidenceWith(uid, { kind: 'quiz', levelId: level, attempt, timestamp: at, logs: answers });
    const mastery = buildBKTProfile(evidence);
    const counts = buildBKTEvidence(evidence);
    measurements = results.map(r => ({
      competency: r.competency,
      accuracy: r.total > 0 ? r.correct / r.total : 0,
      passed: r.passed,
      masteryP: mastery[r.competency],
      driveEvidence: counts[r.competency].drive,
    }));
  }
  const { step } = await commit(uid, cursor, 'quiz_submitted', table => {
    if (measurements.length === 0) return { cursor: submitted, decisions: [], rewards: [], operations: [], log: null };
    const outcome = quizMeasured(submitted, measurements, table, at);
    return {
      cursor: outcome.cursor,
      decisions: [],
      rewards: outcome.rewards,
      operations: outcome.operations,
      log: outcome.operations.length === 0 ? null : {
        schemaVersion: 1,
        kind: 'quiz',
        levelId: level ?? 0,
        phase: phaseId(cursor.phase),
        attemptId: null,
        verdicts: measurements.map((m, i) => ({
          competency: m.competency, total: results[i].total, correct: results[i].correct, passed: m.passed, masteryP: m.masteryP, driveEvidence: m.driveEvidence,
        })),
        timestamp: at,
      },
    };
  }, {
    evidence: { kind: 'sitting', id: stepRecordId('quiz', `${phaseId(cursor.phase)}-a${attempt}`, cursor), sitting },
    events: sittingEvents('quiz', items, answers, { levelId: level, phase: phaseId(cursor.phase), attempt }),
  });
  return { cursor: step.cursor, results };
};

export const finishCourseQuizReview = async (uid: string, cursor: CourseCursor): Promise<CourseCursor> => {
  return moveCursor(uid, cursor, quizReviewDone(cursor), 'quiz_review_done');
};

export const markCourseReviewShown = async (uid: string, cursor: CourseCursor): Promise<CourseCursor> => {
  return moveCursor(uid, cursor, reviewShown(cursor), 'review_shown');
};

// --- the drive ----------------------------------------------------------------------

export interface CourseDriveRun {
  levelId: number;
  /** The counted scenarios; null for the tutorial, which counts none. */
  composed: ComposedDrive | null;
  plan: AdaptivePlan;
  attemptSeed: number;
}

/** What every final-exam item scores, and how grave a miss is: one scale, so the pass mark means one thing. */
const FINAL_POINTS = 25;

/**
 * The drive the cursor is at: the tutorial as authored; a stage's drive with 3
 * scenarios per competency (all of them on DRIVE, the not-done ones on
 * REPEAT), unseen first; the final exam with one scenario per competency
 * (TENTATIVE), every item on one 25-point scale.
 */
export const planCourseDrive = async (uid: string, cursor: CourseCursor, freshSeed: number = nextAttemptSeed()): Promise<CourseDriveRun> => {
  const { phase } = cursor;
  // The drive open at this position keeps its seed: a reload plans the same drive.
  const { seed: attemptSeed, opens } = await openCourseActivity(uid, cursor, 'drive', freshSeed);
  const history = await loadEvidence(uid);
  const seen = new Map(Object.entries(cursor.seen));
  let level: LevelConfig;
  let composed: ComposedDrive | null = null;
  let levelId: number;

  if (phase.kind === 'DRIVE' && phase.level === 0) {
    levelId = 0;
    level = buildLevelConfig(0, undefined, null, createRng(attemptSeed))!;
  } else if ((phase.kind === 'DRIVE' || phase.kind === 'REPEAT') && isCompetencyStage(phase.level)) {
    levelId = phase.level;
    composed = composeDrive({ levelId, competencies: driveCompetencies(cursor), seen, rng: createRng(attemptSeed) });
    level = composed.level;
  } else if (phase.kind === 'FINAL') {
    levelId = 12;
    composed = composeDrive({ levelId, competencies: COMPETENCIES, seen, rng: createRng(attemptSeed), perCompetency: 1 });
    const events = composed.level.events.map(event => ({ ...event, points: FINAL_POINTS, severity: 'major' as const }));
    const total = events.length * FINAL_POINTS;
    level = { ...composed.level, events, requiredScore: Math.round(total * 0.7), stars2: Math.round(total * 0.85), stars3: Math.round(total * 0.95) };
    composed = { ...composed, level };
  } else {
    throw new Error(`no drive in ${phaseId(phase)}`);
  }

  await recordEvents(uid, [
    {
      type: 'drive_planned',
      levelId,
      phase: phaseId(phase),
      payload: {
        attemptSeed,
        // More than 1: the same drive planned again (a reload, a second tab, a restart).
        opens,
        counted: composed?.items.map(item => ({ ...item, format: formatsOf(level).get(item.scenarioId) ?? null })) ?? [],
        structural: composed?.structural ?? [],
        shortfall: composed?.shortfall ?? {},
        route: level.events.map(event => event.id),
        support: 'full',
      },
    },
  ]);

  return {
    levelId,
    composed,
    attemptSeed,
    plan: {
      weakArea: null,
      practice: null,
      level,
      support: 'full',
      record: recordRoutedDecision({ history, item: null, support: 'full' }),
      priorLogs: history,
      explanation: `competency course: ${phaseId(phase)}${composed ? `, ${composed.items.length} counted scenarios` : ''}`,
    },
  };
};

export interface CourseDriveSettled {
  cursor: CourseCursor;
  verdicts: CompetencyVerdict[];
  /** One line per competency for the results screen. */
  lines: string[];
  note: string;
}

const ACTION_WORDS = {
  none: 'done',
  practice: 'practice: its scenarios again in a repeat drive',
  review: 'review: its module section, then a repeat drive',
} as const;

/**
 * A course drive ended. The attempt is saved; each counted competency gets its
 * verdict (2 of 3) and, on a stage drive, its decision; pending decisions are
 * rewarded where this drive measured their competency; the shared table is
 * updated atomically; the log and then the cursor are saved.
 */
export const completeCourseDrive = async ({
  uid,
  cursor,
  run,
  result,
  telemetry,
  startedAt,
}: {
  uid: string;
  cursor: CourseCursor;
  run: CourseDriveRun;
  result: LevelResult;
  telemetry?: LevelFsmTelemetry;
  /** When the drive began, for the attempt's timing record. */
  startedAt?: number;
}): Promise<CourseDriveSettled> => {
  await ensureCurrent(uid, cursor);
  const now = Date.now();
  const level = run.plan.level!;
  // The drive's fixed id: where in the course and the exact position it was
  // played from. The transaction that moves the course on saves it, so a
  // retried or doubled submit cannot save it twice.
  const attemptId = stepRecordId(cursor.phase.kind === 'FINAL' ? 'final' : 'drive', phaseId(cursor.phase), cursor);
  const attempt = {
    levelId: result.levelId,
    timestamp: now,
    finalScore: result.score,
    violations: result.violations,
    correctDecisions: result.correctActions,
    logs: result.logs,
    ...(telemetry ? { fsmMetrics: telemetry.metrics, reactionLatencies: telemetry.reactionLatencies } : {}),
    session: {
      startedAt: startedAt ?? now,
      endedAt: now,
      durationMs: now - (startedAt ?? now),
      pausedMs: telemetry ? pausedMsOf(telemetry.transitions, now) : 0,
      routeLength: level.roadLength,
      crashed: Boolean(result.crashReason),
      phase: phaseId(cursor.phase),
    },
  };
  const evidence: EvidenceWrite = { kind: 'attempt', id: attemptId, attempt };

  /** The telemetry beside the attempt, once the attempt is saved: fixed paths, so a rewrite lands on itself. */
  const saveTelemetry = async () => {
    if (!telemetry) return;
    const { storyAttempts } = drivingSimDeps();
    try {
      await Promise.all([
        storyAttempts.saveFsmTelemetry(uid, attemptId, telemetry.transitions),
        storyAttempts.saveDecisionTelemetry(
          uid,
          attemptId,
          buildDecisionTelemetry({
            entry: { levelId: result.levelId, attemptSeed: run.attemptSeed, route: level.events.map(e => e.id), policy: run.plan.record },
            logs: result.logs,
            traces: telemetry.decisions,
            rerolls: telemetry.rerolls,
          })
        ),
      ]);
    } catch (failure) {
      console.error('Could not save the drive telemetry:', failure);
    }
  };

  const scenarioIds = [
    ...level.events.map(event => event.id),
    ...(level.garage?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
    ...(level.aftermath?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
  ];

  // The tutorial: no verdicts, no decisions.
  if (!run.composed) {
    const { step } = await commit(
      uid,
      cursor,
      'drive_completed',
      () => ({ cursor: driveCompleted(cursor, { measurements: [], scenarioIds, table: {}, rng: Math.random, now }).cursor, decisions: [], rewards: [], operations: [], log: null }),
      {
        context: { levelId: run.levelId, phase: phaseId(cursor.phase), attemptId },
        evidence,
        events: driveEvents(result, { levelId: run.levelId, phase: phaseId(cursor.phase), attemptId }, { startedAt: startedAt ?? null, endedAt: now }, formatsOf(level)),
      }
    );
    await saveTelemetry();
    return { cursor: step.cursor, verdicts: [], lines: [], note: 'Tutorial done. Continue to Level 1.' };
  }

  const verdicts = competencyVerdicts(run.composed.items, result.logs);
  const where = { levelId: run.levelId, phase: phaseId(cursor.phase), attemptId };
  const events: StudyEventDraft[] = [
    ...driveEvents(result, where, { startedAt: startedAt ?? null, endedAt: now, routeLength: level.roadLength }, formatsOf(level)),
    ...verdicts.map(v => ({
      type: 'verdict_computed' as const,
      ...where,
      payload: { ...v, rule: cursor.phase.kind === 'FINAL' ? 'final exam: 1 item, 25-point scale' : `${DRIVE_PASS_CORRECT} of ${v.total}`, scenarios: run.composed!.items.filter(item => item.competency === v.competency).map(item => item.scenarioId) },
    })),
  ];

  // BKT with this drive's answers in it, before the drive is saved: the
  // drive, the decisions it leads to and their rewards are saved together.
  const history = await evidenceWith(uid, { kind: 'attempt', levelId: result.levelId, attempt: null, timestamp: now, logs: result.logs });
  const mastery = buildBKTProfile(history);
  const counts = buildBKTEvidence(history);
  const measurements = verdicts.map(v => ({
    competency: v.competency,
    accuracy: v.accuracy,
    passed: v.passed,
    masteryP: mastery[v.competency],
    driveEvidence: counts[v.competency].drive,
  }));
  const loggedVerdicts = measurements.map((m, i) => ({
    competency: m.competency, total: verdicts[i].total, correct: verdicts[i].correct, passed: m.passed, masteryP: m.masteryP, driveEvidence: m.driveEvidence,
  }));

  if (cursor.phase.kind === 'FINAL') {
    const passed = result.completed;
    // The final exam's decisions update BKT like any drive; it makes no
    // routing decision, but it is a measurement: pending decisions on the
    // competencies it measured are rewarded now, terminally.
    const { step } = await commit(uid, cursor, passed ? 'final_passed' : 'final_failed', table => {
      const settled = finalMeasured(cursor, measurements, table, now);
      return {
        cursor: finalCompleted(settled.cursor, passed, scenarioIds),
        decisions: [],
        rewards: settled.rewards,
        operations: settled.operations,
        log: {
          schemaVersion: 1, kind: 'final', levelId: 12, phase: phaseId(cursor.phase), attemptId,
          verdicts: loggedVerdicts,
          timestamp: now,
          ...(passed ? { endReason: 'certified' as const } : {}),
        },
      };
    }, { context: { levelId: 12, phase: phaseId(cursor.phase), attemptId }, evidence, events });
    await saveTelemetry();
    return {
      cursor: step.cursor,
      verdicts,
      lines: [],
      note: passed ? 'Final exam passed: certified. The post-evaluation exam is next.' : 'Final exam not passed. Continue to sit it again.',
    };
  }

  // The decisions are chosen from the shared table as it is when the step
  // commits: if another participant changes it first, they are chosen again.
  const { step: outcome } = await commit(uid, cursor, 'drive_completed', table => {
    const drive = driveCompleted(cursor, { measurements, scenarioIds, table, rng: Math.random, now });
    return {
      cursor: drive.cursor,
      decisions: drive.decisions,
      rewards: drive.rewards,
      operations: drive.operations,
      log: {
        schemaVersion: 1,
        kind: 'drive',
        levelId: run.levelId,
        phase: phaseId(cursor.phase),
        attemptId,
        verdicts: loggedVerdicts,
        timestamp: now,
        ...(drive.decisions.some(d => d.source === 'cap') ? { endReason: 'cap_reached' as const } : {}),
      },
    };
  }, { context: { levelId: run.levelId, phase: phaseId(cursor.phase), attemptId }, evidence, events });
  await saveTelemetry();

  const lines = verdicts.map(v => {
    const decision = outcome.decisions.find(d => d.competency === v.competency);
    const what = !decision ? '' : decision.source === 'cap' ? ' -> done (3 attempts)' : ` -> ${ACTION_WORDS[decision.action]}`;
    return `${getCompetencyLabel(v.competency)}: ${v.correct} of ${v.total} ${v.passed ? 'passed' : 'not passed'}${what}`;
  });
  const next = outcome.cursor.phase;
  const note =
    next.kind === 'REPEAT'
      ? 'A repeat drive comes next, with only the competencies still to finish.'
      : next.kind === 'FINAL'
        ? 'Every stage is done. The final exam is next.'
        : `Stage done. Continue to Level ${phaseLevel(next)}.`;
  return { cursor: outcome.cursor, verdicts, lines, note };
};

// --- the diagnostic and the post-evaluation exam ---------------------------------------

/** The 55 diagnostic items, 5 per competency, in a fixed order (TENTATIVE list). */
export const diagnosticItems = (): BankItem[] => COMPETENCIES.flatMap(c => itemsFor(DIAGNOSTIC_ITEMS[c]));

/** The 60 post-exam items (TENTATIVE list). */
export const postExamItems = (): BankItem[] => COMPETENCIES.flatMap(c => itemsFor(POST_EXAM_ITEMS[c]));

/** No feedback, one competency per item; the answers set each competency's starting mastery (T = 0). */
export const saveDiagnostic = async (
  uid: string,
  items: readonly BankItem[],
  choices: readonly (number | null)[],
  responseMs: readonly (number | null)[] = []
): Promise<'saved' | 'exists'> => {
  await ensureLatestApp();
  const at = Date.now();
  const answers = items.map((item, i) => answerLog(item, choices[i] ?? null, 'diagnostic', at + i, undefined, responseMs[i]));
  // One fixed id: a second tab or a second submit finds it saved and writes nothing.
  const saved = await drivingSimDeps().competencyCourse.saveEvidence(uid, {
    kind: 'sitting',
    id: DIAGNOSTIC_RECORD_ID,
    sitting: { schemaVersion: 1, kind: 'diagnostic', levelId: null, attempt: null, answers, timestamp: at },
  });
  if (saved === 'exists') return saved;
  await recordEvents(uid, sittingEvents('diagnostic', items, answers, { levelId: null, phase: null, attempt: null }));
  await recordBKT(uid);
  return saved;
};

/**
 * The post-evaluation exam, scored with Rasch (b = 0 until the pilot's
 * estimates). Its answers never enter BKT. Each competency's items are its
 * last measurement: decisions still waiting are rewarded on them.
 */
export const completePostExam = async (
  uid: string,
  cursor: CourseCursor,
  items: readonly BankItem[],
  choices: readonly (number | null)[],
  responseMs: readonly (number | null)[] = []
): Promise<{ cursor: CourseCursor; theta: number; se: number; correct: number }> => {
  await ensureCurrent(uid, cursor);
  const at = Date.now();
  const answers = items.map((item, i) => answerLog(item, choices[i] ?? null, 'post_exam', at + i, undefined, responseMs[i]));
  const ability = raschEAP(items.map((item, i) => ({ b: 0, correct: choices[i] === item.answer })));
  const sitting: AssessmentSitting = { schemaVersion: 1, kind: 'post_exam', levelId: null, attempt: null, answers, ability, timestamp: at };

  const byCompetency: Partial<Record<DrivingCompetency, { accuracy: number; passed: boolean }>> = {};
  for (const competency of COMPETENCIES) {
    const mine = items.map((item, i) => ({ item, i })).filter(({ item }) => item.competency === competency);
    if (mine.length === 0) continue;
    const correct = mine.filter(({ item, i }) => choices[i] === item.answer).length;
    byCompetency[competency] = { accuracy: correct / mine.length, passed: correct / mine.length >= 2 / 3 };
  }
  const { step: settled } = await commit(uid, cursor, 'post_exam_completed', table => {
    const done = postExamCompleted(cursor, byCompetency, table, at);
    return {
      cursor: done.cursor,
      decisions: [],
      rewards: done.rewards,
      operations: done.operations,
      log: { schemaVersion: 1, kind: 'post_exam', levelId: 0, phase: phaseId(cursor.phase), attemptId: null, verdicts: [], timestamp: at },
    };
  }, {
    context: { levelId: null, phase: phaseId(cursor.phase), attemptId: null },
    evidence: { kind: 'sitting', id: stepRecordId('post_exam', phaseId(cursor.phase), cursor), sitting },
    events: sittingEvents('post_exam', items, answers, { levelId: null, phase: phaseId(cursor.phase), attempt: null }),
  });
  return { cursor: settled.cursor, theta: ability.theta, se: ability.se, correct: answers.filter(a => a.result === 'correct').length };
};

/** The competencies the quiz of a stage asks. */
export const stageQuizCompetencies = (level: number): readonly DrivingCompetency[] =>
  isCompetencyStage(level) ? STAGE_COMPETENCIES[level] : [];

// --- free replay ----------------------------------------------------------------------

/**
 * A stage already finished, played again from the map, outside the routing
 * FSM: every competency the stage teaches, 3 scenarios each, and nothing moves
 * on the cursor or the table. The attempt is saved, so BKT reads it as
 * evidence like any other drive.
 */
export const planFreeReplay = async (uid: string, levelId: number, attemptSeed: number): Promise<CourseDriveRun> => {
  const history = await loadEvidence(uid);
  const composed = isCompetencyStage(levelId)
    ? composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: createRng(attemptSeed) })
    : null;
  const level = composed?.level ?? buildLevelConfig(levelId, undefined, null, createRng(attemptSeed))!;
  return {
    levelId,
    composed,
    attemptSeed,
    plan: {
      weakArea: null,
      practice: null,
      level,
      support: 'full',
      record: recordRoutedDecision({ history, item: null, support: 'full' }),
      priorLogs: history,
      explanation: `free replay of level ${levelId}, outside the routing FSM`,
    },
  };
};

export const completeFreeReplayDrive = async (uid: string, result: LevelResult, telemetry?: LevelFsmTelemetry) => {
  await ensureLatestApp();
  const { storyAttempts, competencyCourse } = drivingSimDeps();
  const now = Date.now();
  // Numbered in the evidence order like any drive; its id is its own (it moves no course step).
  const attemptId = `replay_L${result.levelId}_${newEventId(now)}`;
  await competencyCourse.saveEvidence(uid, {
    kind: 'attempt',
    id: attemptId,
    attempt: {
      levelId: result.levelId,
      timestamp: now,
      finalScore: result.score,
      violations: result.violations,
      correctDecisions: result.correctActions,
      logs: result.logs,
      ...(telemetry ? { fsmMetrics: telemetry.metrics, reactionLatencies: telemetry.reactionLatencies } : {}),
    },
  });
  if (telemetry) await storyAttempts.saveFsmTelemetry(uid, attemptId, telemetry.transitions).catch(failure => console.error('Could not save the drive telemetry:', failure));
  await recordEvents(uid, driveEvents(result, { levelId: result.levelId, phase: 'FREE_REPLAY', attemptId }, { freeReplay: true }));
  await recordBKT(uid);
};

/** Logs something that happened outside the course's own steps (a session start, a page view). */
export const logStudyEvent = (uid: string, draft: StudyEventDraft): Promise<void> => recordEvents(uid, [draft]);
