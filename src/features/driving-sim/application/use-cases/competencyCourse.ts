/**
 * The per-competency course (redesign of 2026-10-27/28), as the game plays it:
 * sign in, diagnostic pre-test, tutorial, then each stage's module, short quiz
 * (gate), drive and repeat drives, the final exam, and the post-evaluation
 * exam. Every participant plays the same flow; there is no comparison group.
 *
 * Each function loads what it needs, applies one move of the routing FSM
 * (`@/domain/competencyRouting/course`), and saves the result before it
 * returns: the attempt first, then the shared table and the course log, then
 * the cursor, so a cursor never names a move whose evidence is missing.
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
  reviewShown,
  startingCourse,
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
import { pairQOperations, type QLogContext, type QLogEntry } from '@/domain/study/qLog';
import type { StudyEventDraft } from '@/domain/study/studyEvent';
import { isLikert, type SurveyResponse } from '@/domain/study/survey';
import type { DecisionRecord, QOperation, RewardRecord } from '@/domain/competencyRouting/course';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import { historyLogs, loadLearnerHistory } from '../learnerHistory';
import type { AssessmentSitting } from '../ports';
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

/** Every graded answer BKT reads, oldest first: drives (tutorial left out), quiz, diagnostic and post-exam answers. */
export const loadEvidence = async (uid: string): Promise<ActionLog[]> => {
  const [history, sittings] = await Promise.all([loadLearnerHistory(uid), drivingSimDeps().assessments.load(uid)]);
  const answers = sittings.flatMap(s => s.answers);
  return historyLogs(history, answers);
};

/** Saves the cursor and logs the transition: from, to, and what triggered it. */
const moveCursor = async (uid: string, from: CourseCursor, to: CourseCursor, trigger: string) => {
  await drivingSimDeps().competencyCourse.saveCursor(uid, to);
  await recordEvents(uid, [
    {
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
    },
  ]);
};

/**
 * Applies a drive's, quiz's or post-exam's Q operations to the shared table,
 * writes the table's update log in the same transaction, and mirrors each
 * decision and reward into the participant's event stream.
 */
const applyAndLogQ = async (
  uid: string,
  input: { operations: readonly QOperation[]; decisions: readonly DecisionRecord[]; rewards: readonly RewardRecord[]; context: Omit<QLogContext, 'participantCode'> }
): Promise<{ tableAfter: QTable; entries: QLogEntry[] }> => {
  const deps = drivingSimDeps();
  const now = Date.now();
  let entries: QLogEntry[] = [];
  let tableAfter = await deps.competencyCourse.loadQTable();
  if (input.operations.length > 0) {
    const applied = await deps.competencyCourse.applyQLog({
      items: pairQOperations(input.operations, input.decisions, input.rewards),
      context: { ...input.context, participantCode: null },
      envelope: i => envelopeFor(uid, now + i),
    });
    tableAfter = applied.table;
    entries = applied.entries;
  }
  const byDecision = new Map(entries.map(e => [`${e.kind}:${e.decisionId}`, e]));
  const drafts: StudyEventDraft[] = [
    ...input.rewards.map(reward => {
      const entry = byDecision.get(`learn:${reward.decisionId}`);
      return {
        type: 'reward_computed' as const,
        levelId: input.context.levelId,
        phase: input.context.phase,
        attemptId: input.context.attemptId,
        payload: { ...reward, qUpdateId: entry?.eventId ?? null, globalSeq: entry?.globalSeq ?? null, learning: entry?.learning ?? null },
      };
    }),
    ...input.decisions.map(decision => {
      const decisionId = `${decision.levelId}:${decision.competency}:${decision.seq}`;
      const entry = byDecision.get(`visit:${decisionId}`);
      return {
        type: 'policy_decision' as const,
        levelId: input.context.levelId,
        phase: input.context.phase,
        attemptId: input.context.attemptId,
        payload: { ...decision, decisionId, qUpdateId: entry?.eventId ?? null, globalSeq: entry?.globalSeq ?? null, stateAfter: entry?.statesAfter[entry.stateKey] ?? null },
      };
    }),
  ];
  await recordEvents(uid, drafts);
  return { tableAfter, entries };
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

/** One event per graded decision a drive logged, then the drive's end. */
const driveEvents = (
  result: LevelResult,
  context: { levelId: number; phase: string | null; attemptId: string | null },
  ended: Record<string, unknown>
): StudyEventDraft[] => [
  ...result.logs.map(log => ({
    type: 'decision_made' as const,
    at: log.timestamp,
    levelId: context.levelId,
    phase: context.phase,
    attemptId: context.attemptId,
    payload: {
      scenarioId: log.scenarioId ?? null,
      ruleId: log.ruleId ?? null,
      competency: log.competency ?? null,
      action: log.action,
      expectedAction: log.expectedAction ?? null,
      result: log.result,
      points: log.points,
      reactionMs: log.reactionTime ?? null,
      timedOut: log.reactionCensored === true,
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
  const next = lessonsRead(cursor);
  await moveCursor(uid, cursor, next, 'lessons_read');
  return next;
};

/** This attempt's quiz: 3 items per competency still to pass, unseen first. */
export const drawCourseQuiz = (cursor: CourseCursor, seed: number): QuizDraw => {
  if (cursor.phase.kind !== 'QUIZ' || !cursor.quiz) throw new Error(`no quiz in ${phaseId(cursor.phase)}`);
  const seen = new Map(cursor.quiz.seenItems.map((id, index) => [id, index]));
  return drawQuiz(cursor.phase.level, cursor.quiz.remaining, seen, createRng(seed));
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
  const at = Date.now();
  const attempt = cursor.quiz?.attempt ?? 1;
  const answers = items.map((item, i) => answerLog(item, choices[i] ?? null, 'quiz', at + i, attempt, responseMs[i]));
  await drivingSimDeps().assessments.save(uid, {
    schemaVersion: 1,
    kind: 'quiz',
    levelId: phaseLevel(cursor.phase),
    attempt,
    answers,
    timestamp: at,
  });
  await recordEvents(uid, sittingEvents('quiz', items, answers, { levelId: phaseLevel(cursor.phase), phase: phaseId(cursor.phase), attempt }));
  await recordBKT(uid);
  const graded: QuizAnswer[] = items.map((item, i) => ({ itemId: item.id, competency: item.competency, correct: choices[i] === item.answer }));
  const competencies = [...new Set(items.map(item => item.competency))];
  const results = competencies.map(competency => {
    const mine = graded.filter(answer => answer.competency === competency);
    const correct = mine.filter(answer => answer.correct).length;
    return { competency, correct, total: mine.length, passed: correct >= QUIZ_PASS_CORRECT };
  });

  // The quiz is a measurement: pending decisions on these competencies are
  // rewarded now (Tentative; OPEN, see quizMeasured).
  let next = quizSubmitted(cursor, graded);
  const level = phaseLevel(cursor.phase);
  if (next.pending.some(p => competencies.includes(p.competency))) {
    const evidence = await loadEvidence(uid);
    const mastery = buildBKTProfile(evidence);
    const counts = buildBKTEvidence(evidence);
    const measurements = results.map(r => ({
      competency: r.competency,
      accuracy: r.total > 0 ? r.correct / r.total : 0,
      passed: r.passed,
      masteryP: mastery[r.competency],
      driveEvidence: counts[r.competency].drive,
    }));
    const deps = drivingSimDeps();
    const table = await deps.competencyCourse.loadQTable();
    const outcome = quizMeasured(next, measurements, table, at);
    next = outcome.cursor;
    if (outcome.operations.length > 0) {
      const { tableAfter } = await applyAndLogQ(uid, {
        operations: outcome.operations,
        decisions: [],
        rewards: outcome.rewards,
        context: { levelId: level, phase: phaseId(cursor.phase), attemptId: null },
      });
      await deps.competencyCourse.appendLog(uid, {
        schemaVersion: 1,
        kind: 'quiz',
        levelId: level ?? 0,
        phase: phaseId(cursor.phase),
        attemptId: null,
        verdicts: measurements.map((m, i) => ({
          competency: m.competency, total: results[i].total, correct: results[i].correct, passed: m.passed, masteryP: m.masteryP, driveEvidence: m.driveEvidence,
        })),
        decisions: [],
        rewards: outcome.rewards,
        tableAfter,
        timestamp: at,
      });
    }
  }
  await moveCursor(uid, cursor, next, 'quiz_submitted');
  return { cursor: next, results };
};

export const finishCourseQuizReview = async (uid: string, cursor: CourseCursor): Promise<CourseCursor> => {
  const next = quizReviewDone(cursor);
  await moveCursor(uid, cursor, next, 'quiz_review_done');
  return next;
};

export const markCourseReviewShown = async (uid: string, cursor: CourseCursor): Promise<CourseCursor> => {
  const next = reviewShown(cursor);
  await moveCursor(uid, cursor, next, 'review_shown');
  return next;
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
export const planCourseDrive = async (uid: string, cursor: CourseCursor, attemptSeed: number): Promise<CourseDriveRun> => {
  const { phase } = cursor;
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
        counted: composed?.items.map(item => ({ ...item })) ?? [],
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
  const deps = drivingSimDeps();
  const now = Date.now();
  const level = run.plan.level!;
  const attemptId = await deps.storyAttempts.save(uid, {
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
  });
  if (telemetry) {
    await Promise.all([
      deps.storyAttempts.saveFsmTelemetry(uid, attemptId, telemetry.transitions),
      deps.storyAttempts.saveDecisionTelemetry(
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
  }

  const scenarioIds = [
    ...level.events.map(event => event.id),
    ...(level.garage?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
    ...(level.aftermath?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
  ];

  // The tutorial: no verdicts, no decisions.
  if (!run.composed) {
    const outcome = driveCompleted(cursor, { measurements: [], scenarioIds, table: {}, rng: Math.random, now });
    await recordEvents(uid, driveEvents(result, { levelId: run.levelId, phase: phaseId(cursor.phase), attemptId }, { startedAt: startedAt ?? null, endedAt: now }));
    await moveCursor(uid, cursor, outcome.cursor, 'drive_completed');
    return { cursor: outcome.cursor, verdicts: [], lines: [], note: 'Tutorial done. Continue to Level 1.' };
  }

  const verdicts = competencyVerdicts(run.composed.items, result.logs);
  const where = { levelId: run.levelId, phase: phaseId(cursor.phase), attemptId };
  await recordEvents(uid, [
    ...driveEvents(result, where, { startedAt: startedAt ?? null, endedAt: now, routeLength: level.roadLength }),
    ...verdicts.map(v => ({
      type: 'verdict_computed' as const,
      ...where,
      payload: { ...v, rule: cursor.phase.kind === 'FINAL' ? 'final exam: 1 item, 25-point scale' : `${DRIVE_PASS_CORRECT} of ${v.total}`, scenarios: run.composed!.items.filter(item => item.competency === v.competency).map(item => item.scenarioId) },
    })),
  ]);
  await recordBKT(uid);

  if (cursor.phase.kind === 'FINAL') {
    const passed = result.completed;
    const next = finalCompleted(cursor, passed, scenarioIds);
    // The final exam's decisions update BKT like any drive; it makes no routing decision.
    const finalEvidence = await loadEvidence(uid);
    const finalMastery = buildBKTProfile(finalEvidence);
    const finalCounts = buildBKTEvidence(finalEvidence);
    await deps.competencyCourse.appendLog(uid, {
      schemaVersion: 1, kind: 'final', levelId: 12, phase: phaseId(cursor.phase), attemptId,
      verdicts: verdicts.map(v => ({
        competency: v.competency, total: v.total, correct: v.correct, passed: v.passed,
        masteryP: finalMastery[v.competency], driveEvidence: finalCounts[v.competency].drive,
      })),
      decisions: [], rewards: [], tableAfter: await deps.competencyCourse.loadQTable(), timestamp: now,
      ...(passed ? { endReason: 'certified' as const } : {}),
    });
    await moveCursor(uid, cursor, next, passed ? 'final_passed' : 'final_failed');
    return {
      cursor: next,
      verdicts,
      lines: [],
      note: passed ? 'Final exam passed: certified. The post-evaluation exam is next.' : 'Final exam not passed. Continue to sit it again.',
    };
  }

  // BKT after this attempt: the history now includes it.
  const evidence = await loadEvidence(uid);
  const mastery = buildBKTProfile(evidence);
  const counts = buildBKTEvidence(evidence);
  const measurements = verdicts.map(v => ({
    competency: v.competency,
    accuracy: v.accuracy,
    passed: v.passed,
    masteryP: mastery[v.competency],
    driveEvidence: counts[v.competency].drive,
  }));

  const table = await deps.competencyCourse.loadQTable();
  const outcome = driveCompleted(cursor, { measurements, scenarioIds, table, rng: Math.random, now });
  const { tableAfter } = await applyAndLogQ(uid, {
    operations: outcome.operations,
    decisions: outcome.decisions,
    rewards: outcome.rewards,
    context: { levelId: run.levelId, phase: phaseId(cursor.phase), attemptId },
  });
  await deps.competencyCourse.appendLog(uid, {
    schemaVersion: 1,
    kind: 'drive',
    levelId: run.levelId,
    phase: phaseId(cursor.phase),
    attemptId,
    verdicts: measurements.map((m, i) => ({
      competency: m.competency, total: verdicts[i].total, correct: verdicts[i].correct, passed: m.passed, masteryP: m.masteryP, driveEvidence: m.driveEvidence,
    })),
    decisions: outcome.decisions,
    rewards: outcome.rewards,
    tableAfter,
    timestamp: now,
    ...(outcome.decisions.some(d => d.source === 'cap') ? { endReason: 'cap_reached' as const } : {}),
  });
  await moveCursor(uid, cursor, outcome.cursor, 'drive_completed');

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
) => {
  const at = Date.now();
  const answers = items.map((item, i) => answerLog(item, choices[i] ?? null, 'diagnostic', at + i, undefined, responseMs[i]));
  await drivingSimDeps().assessments.save(uid, {
    schemaVersion: 1,
    kind: 'diagnostic',
    levelId: null,
    attempt: null,
    answers,
    timestamp: at,
  });
  await recordEvents(uid, sittingEvents('diagnostic', items, answers, { levelId: null, phase: null, attempt: null }));
  await recordBKT(uid);
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
  const deps = drivingSimDeps();
  const at = Date.now();
  const answers = items.map((item, i) => answerLog(item, choices[i] ?? null, 'post_exam', at + i, undefined, responseMs[i]));
  const ability = raschEAP(items.map((item, i) => ({ b: 0, correct: choices[i] === item.answer })));
  await deps.assessments.save(uid, { schemaVersion: 1, kind: 'post_exam', levelId: null, attempt: null, answers, ability, timestamp: at });
  await recordEvents(uid, sittingEvents('post_exam', items, answers, { levelId: null, phase: phaseId(cursor.phase), attempt: null }));
  await recordBKT(uid);

  const byCompetency: Partial<Record<DrivingCompetency, { accuracy: number; passed: boolean }>> = {};
  for (const competency of COMPETENCIES) {
    const mine = items.map((item, i) => ({ item, i })).filter(({ item }) => item.competency === competency);
    if (mine.length === 0) continue;
    const correct = mine.filter(({ item, i }) => choices[i] === item.answer).length;
    byCompetency[competency] = { accuracy: correct / mine.length, passed: correct / mine.length >= 2 / 3 };
  }
  const table = await deps.competencyCourse.loadQTable();
  const settled = postExamCompleted(cursor, byCompetency, table, at);
  const { tableAfter } = await applyAndLogQ(uid, {
    operations: settled.operations,
    decisions: [],
    rewards: settled.rewards,
    context: { levelId: null, phase: phaseId(cursor.phase), attemptId: null },
  });
  await deps.competencyCourse.appendLog(uid, {
    schemaVersion: 1, kind: 'post_exam', levelId: 0, phase: phaseId(cursor.phase), attemptId: null,
    verdicts: [], decisions: [], rewards: settled.rewards, tableAfter, timestamp: at,
  });
  await moveCursor(uid, cursor, settled.cursor, 'post_exam_completed');
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
  const { storyAttempts } = drivingSimDeps();
  const attemptId = await storyAttempts.save(uid, {
    levelId: result.levelId,
    timestamp: Date.now(),
    finalScore: result.score,
    violations: result.violations,
    correctDecisions: result.correctActions,
    logs: result.logs,
    ...(telemetry ? { fsmMetrics: telemetry.metrics, reactionLatencies: telemetry.reactionLatencies } : {}),
  });
  if (telemetry) await storyAttempts.saveFsmTelemetry(uid, attemptId, telemetry.transitions);
  await recordEvents(uid, driveEvents(result, { levelId: result.levelId, phase: 'FREE_REPLAY', attemptId }, { freeReplay: true }));
  await recordBKT(uid);
};

// --- questionnaires ----------------------------------------------------------------------

/**
 * Saves one questionnaire (ISO/IEC 25010 or TAM): every value 1-5. The items
 * are not in the app yet; this is the save path they will use.
 */
export const saveSurvey = async (uid: string, response: SurveyResponse): Promise<void> => {
  if (!Object.values(response.answers).every(isLikert)) throw new Error('Every answer must be a whole number from 1 to 5.');
  await drivingSimDeps().surveys.save(uid, response);
  await recordEvents(uid, [{ type: 'survey_submitted', payload: { instrument: response.instrument, formVersion: response.formVersion, answers: response.answers } }]);
};

/** Logs something that happened outside the course's own steps (a session start, a page view). */
export const logStudyEvent = (uid: string, draft: StudyEventDraft): Promise<void> => recordEvents(uid, [draft]);
