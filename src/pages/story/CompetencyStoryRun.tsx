/**
 * Story Mode as the per-competency course (redesign of 2026-10-27/28).
 *
 * Every participant plays the same flow, signed in: the diagnostic pre-test,
 * the tutorial, then each stage's module, short quiz (the gate) and drive, with
 * repeat drives for the competencies not yet done, the final exam, and the
 * post-evaluation exam. Continue goes wherever the routing FSM's cursor is.
 *
 * The run state is held here across the briefing, drive and results URLs, as
 * in the other runs. Everything decided is a call into Driving Sim's public
 * API; the routing FSM, the simulation and persistence live there.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProgressStore } from '@/features/progression';
import {
  LEVELS,
  completeCourseDrive,
  completeFreeReplayDrive,
  completePostExam,
  diagnosticItems,
  drivePreview,
  drawCourseQuiz,
  finishCourseQuizReview,
  loadCompetencyCourse,
  logStudyEvent,
  markCourseLessonsRead,
  markCourseReviewShown,
  nextAttemptSeed,
  planCourseDrive,
  planFreeReplay,
  postExamItems,
  reviewLessons,
  saveDiagnostic,
  saveBackground,
  submitCourseQuiz,
  type BriefingGate,
  type CourseDriveRun,
  type CourseState,
  type LevelConfig,
  type LevelFsmTelemetry,
} from '@/features/driving-sim';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import { getCompetencyLabel } from '@/domain/learner/profile';
import {
  COMPETENCY_ATTEMPT_CAP,
  phaseLevel,
  reviewsDue,
  type CourseCursor,
} from '@/domain/competencyRouting/course';
import { QUIZ_ATTEMPT_CAP, STAGE_COMPETENCIES, isCompetencyStage } from '@/domain/learner/stageCompetencies';
import type { StoryRouting, StoryRunContext } from './storyRunContext';

const NO_PRIOR_LOGS: readonly ActionLog[] = [];

interface PlannedRun {
  attempt: number;
  run: CourseDriveRun;
  /** Played from the map outside the course: nothing moves on the cursor. */
  free: boolean;
}

interface CompetencyStoryRunProps {
  routing: StoryRouting;
  uid: string;
}

const staticLevel = (levelId: number): LevelConfig | null => LEVELS.find(level => level.id === levelId) ?? null;

const CompetencyStoryRun = ({ routing, uid }: CompetencyStoryRunProps) => {
  const { levelId: levelIdParam } = useParams();
  const navigate = useNavigate();
  const requestedLevelId = levelIdParam === undefined ? null : Number(levelIdParam);
  const isValidLevel =
    requestedLevelId !== null && Number.isInteger(requestedLevelId) && LEVELS.some(level => level.id === requestedLevelId);
  const activeLevel = isValidLevel ? requestedLevelId : null;

  const { saveLevelResult, totalScore, levelResults } = useProgressStore();

  // The study log: one session_started per sign-in in this app load, and a
  // page_viewed for every Story Mode screen.
  const { pathname } = useLocation();
  useEffect(() => {
    void logStudyEvent(uid, {
      type: 'session_started',
      payload: {
        userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
        language: typeof navigator === 'undefined' ? null : navigator.language,
        screen: typeof window === 'undefined' ? null : { width: window.screen?.width ?? null, height: window.screen?.height ?? null, dpr: window.devicePixelRatio ?? null },
        viewport: typeof window === 'undefined' ? null : { width: window.innerWidth, height: window.innerHeight },
      },
    });
  }, [uid]);
  useEffect(() => {
    void logStudyEvent(uid, { type: 'page_viewed', payload: { path: pathname } });
  }, [uid, pathname]);

  const [state, setState] = useState<CourseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedRun | null>(null);
  const [finished, setFinished] = useState<{ levelId: number; level: LevelConfig } | null>(null);
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [startedRun, setStartedRun] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const [quizSeed, setQuizSeed] = useState(() => nextAttemptSeed());
  const attempts = useRef(0);
  const busy = useRef(false);

  const cursor = state?.cursor ?? null;
  const setCursor = (next: CourseCursor) => setState(current => (current ? { ...current, cursor: next } : current));

  useEffect(() => {
    let cancelled = false;
    loadCompetencyCourse(uid)
      .then(loaded => !cancelled && setState(loaded))
      .catch(failure => {
        console.error('Failed to load the course:', failure);
        if (!cancelled) setError('Your course could not be loaded. Check your connection and reload.');
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  /** Runs one async step of the course, one at a time, reporting failures. */
  const step = useCallback(async (what: string, action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      setError(null);
      await action();
    } catch (failure) {
      console.error(`Failed to ${what}:`, failure);
      setError(`Could not ${what}. Check your connection and try again.`);
    } finally {
      busy.current = false;
    }
  }, []);

  /** Plans the drive the cursor is now at, so the briefing can start it. */
  const planDrive = useCallback(
    async (at: CourseCursor) => {
      const run = await planCourseDrive(uid, at, nextAttemptSeed());
      setPlanned({ attempt: ++attempts.current, run, free: false });
      setStartedRun(null);
      return run;
    },
    [uid]
  );

  const continueCourse = () =>
    void step('continue your course', async () => {
      if (!state) return;
      const { cursor: at } = state;
      if (state.backgroundRequired && !state.backgroundDone) {
        navigate('/play/story/background');
        return;
      }
      if (!state.diagnosticDone) {
        navigate('/play/story/diagnostic');
        return;
      }
      if (at.phase.kind === 'CERTIFIED') {
        navigate('/play/story/post-exam');
        return;
      }
      setLevelResult(null);
      setResultNote(null);
      if (at.phase.kind === 'DRIVE' || at.phase.kind === 'REPEAT' || at.phase.kind === 'FINAL') {
        const run = await planDrive(at);
        navigate(`/play/story/${run.levelId}/briefing`);
        return;
      }
      setPlanned(null);
      navigate(`/play/story/${phaseLevel(at.phase)}/briefing`);
    });

  const playFreeReplay = (levelId: number) =>
    void step('prepare that level', async () => {
      const run = await planFreeReplay(uid, levelId, nextAttemptSeed());
      setPlanned({ attempt: ++attempts.current, run, free: true });
      setStartedRun(null);
      setLevelResult(null);
      setResultNote(null);
      navigate(`/play/story/${levelId}/briefing`);
    });

  const completeRun = (result: LevelResult, telemetry?: LevelFsmTelemetry) => {
    setLevelResult(result);
    saveLevelResult(result);
    if (!planned || !cursor) return;
    setFinished({ levelId: planned.run.levelId, level: planned.run.plan.level! });
    setSaving(true);
    setResultNote(null);
    const done = planned.free
      ? completeFreeReplayDrive(uid, result, telemetry).then(() =>
          setResultNote('A replay outside your course: Continue picks your course up where you left it.')
        )
      : completeCourseDrive({ uid, cursor, run: planned.run, result, telemetry, startedAt: startedAt.current ?? undefined }).then(settled => {
          setCursor(settled.cursor);
          setResultNote([...settled.lines, settled.note].join('\n'));
        });
    done
      .catch(async failure => {
        console.error('Failed to save the attempt:', failure);
        setResultNote('Your result could not be saved. Continue will give you this drive again.');
        setState(await loadCompetencyCourse(uid).catch(() => state));
      })
      .finally(() => setSaving(false));
  };

  // --- the briefing gate ---------------------------------------------------------

  const quizDraw = useMemo(
    () => (cursor && cursor.phase.kind === 'QUIZ' && cursor.quiz ? drawCourseQuiz(cursor, quizSeed) : null),
    // A new draw per attempt: the attempt number and the remaining competencies change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursor?.phase.kind, cursor?.quiz?.attempt, cursor?.quiz?.remaining.join(','), quizSeed]
  );

  const gate: BriefingGate | null = useMemo(() => {
    if (!cursor || activeLevel === null) return null;
    if (planned?.free) {
      return {
        lessonsRead: true, onLessonsRead: async () => {}, quiz: null, hasQuiz: false, quizPassed: true, review: null,
        canDrive: true, driveDetail: 'A replay outside your course', notes: ['A replay of a finished stage: it does not move your course.'],
        preview: planned.run.plan.level
          ? drivePreview(planned.run.plan.level, planned.run.composed ? new Set(planned.run.composed.items.map(item => item.scenarioId)) : undefined)
          : null,
      };
    }
    const { phase } = cursor;
    const phaseLevelId = phaseLevel(phase);
    if (phaseLevelId !== activeLevel) return null;
    const stageCompetencies = isCompetencyStage(activeLevel) ? STAGE_COMPETENCIES[activeLevel] : [];
    const labels = (list: readonly string[]) => list.map(getCompetencyLabel).join(', ');
    const inModule = phase.kind === 'MODULE';
    const due = reviewsDue(cursor);

    const notes: string[] = [];
    if (stageCompetencies.length > 0) notes.push(`This stage: ${labels(stageCompetencies)}.`);
    if (phase.kind === 'QUIZ' && cursor.quiz && cursor.quiz.attempt > 1) notes.push(`Retake: ${labels(cursor.quiz.remaining)} only, with new items.`);
    if (phase.kind === 'QUIZ_REVIEW') notes.push(`Quiz attempts used up. Review the module for ${labels(phase.competencies)}, then drive.`);
    if (phase.kind === 'REPEAT') {
      const left = STAGE_COMPETENCIES[phase.level].filter(c => !cursor.stage[c]?.done);
      notes.push(`Repeat drive: ${labels(left)}, 3 new scenarios each.`);
      const flagged = left.filter(c => (cursor.stage[c]?.attempts ?? 0) >= COMPETENCY_ATTEMPT_CAP - 1);
      if (flagged.length > 0) notes.push(`Last attempt for ${labels(flagged)}: after it, the stage moves on.`);
    }
    if (phase.kind === 'FINAL') notes.push('The final exam: one scenario per competency, 70% to pass.');
    // Progress per competency in this stage: done, or which attempt comes next.
    if ((phase.kind === 'DRIVE' || phase.kind === 'REPEAT') && stageCompetencies.length > 0) {
      notes.push(
        'Progress: ' +
          stageCompetencies
            .map(c => {
              const progress = cursor.stage[c];
              if (progress?.done) return `${getCompetencyLabel(c)} done${progress.flagged ? ' (flagged)' : ''}`;
              return `${getCompetencyLabel(c)} attempt ${(progress?.attempts ?? 0) + 1} of ${COMPETENCY_ATTEMPT_CAP}`;
            })
            .join(' · ')
      );
    }

    const review =
      phase.kind === 'QUIZ_REVIEW'
        ? {
            title: 'Module Review',
            lessons: reviewLessons(phase.level, phase.competencies),
            onDone: () =>
              step('save your review', async () => {
                const next = await finishCourseQuizReview(uid, cursor);
                setCursor(next);
                await planDrive(next);
              }),
          }
        : phase.kind === 'REPEAT' && due.length > 0
          ? {
              title: `Review: ${labels(due)}`,
              lessons: reviewLessons(phase.level, due),
              onDone: () =>
                step('save your review', async () => {
                  setCursor(await markCourseReviewShown(uid, cursor));
                }),
            }
          : null;

    const drivePhase = phase.kind === 'DRIVE' || phase.kind === 'REPEAT' || phase.kind === 'FINAL';
    return {
      lessonsRead: !inModule,
      onLessonsRead: () =>
        step('save your progress', async () => {
          if (!inModule) return;
          const next = await markCourseLessonsRead(uid, cursor);
          setCursor(next);
          if (next.phase.kind === 'DRIVE') await planDrive(next);
        }),
      hasQuiz: isCompetencyStage(activeLevel) && phase.kind !== 'FINAL',
      quizPassed: drivePhase || phase.kind === 'QUIZ_REVIEW',
      quiz:
        phase.kind === 'QUIZ' && cursor.quiz && quizDraw
          ? {
              items: quizDraw.items,
              attempt: cursor.quiz.attempt,
              cap: QUIZ_ATTEMPT_CAP,
              onSubmit: async (choices, responseMs) => {
                const submitted = await submitCourseQuiz(uid, cursor, quizDraw.items, choices, responseMs);
                setCursor(submitted.cursor);
                if (submitted.cursor.phase.kind === 'DRIVE') await planDrive(submitted.cursor);
                return submitted.results;
              },
              onDone: () => setQuizSeed(nextAttemptSeed()),
            }
          : null,
      review,
      canDrive: drivePhase && planned !== null && planned.run.levelId === activeLevel && review === null,
      preview:
        planned && planned.run.levelId === activeLevel && planned.run.plan.level
          ? drivePreview(
              planned.run.plan.level,
              planned.run.composed ? new Set(planned.run.composed.items.map(item => item.scenarioId)) : undefined
            )
          : null,
      driveDetail: planned?.run.composed
        ? `${planned.run.composed.items.length} scenarios: 3 per competency${phase.kind === 'FINAL' ? '' : ', 2 of 3 to pass each'}`
        : `${planned?.run.plan.level?.events.length ?? 0} road events`,
      notes,
    };
  }, [cursor, activeLevel, planned, quizDraw, uid, step, planDrive]);

  // Landing on the map ends whatever was being briefed or shown.
  const [routedFrom, setRoutedFrom] = useState(activeLevel);
  if (activeLevel !== routedFrom) {
    setRoutedFrom(activeLevel);
    if (activeLevel === null) {
      setStartedRun(null);
      setLevelResult(null);
    }
  }

  if (levelIdParam !== undefined && !isValidLevel) return <Navigate to="/play/story" replace />;

  const current = planned && planned.run.levelId === activeLevel ? planned : null;
  const levelConfig =
    current?.run.plan.level ??
    (finished && finished.levelId === activeLevel ? finished.level : activeLevel !== null ? staticLevel(activeLevel) : null);
  const frontierLevelId = cursor ? phaseLevel(cursor.phase) : null;

  const context: StoryRunContext = {
    activeLevel,
    levelConfig,
    weakArea: null,
    practice: null,
    support: 'full',
    attemptSeed: current?.run.attemptSeed ?? null,
    priorLogs: current?.run.plan.priorLogs ?? NO_PRIOR_LOGS,
    decisionSettled: current !== null,
    levelResult,
    recommendation: null,
    showSaveModal: false,
    dismissSaveModal: () => {},
    startedRun,
    rollNonce: current?.attempt ?? 0,
    totalScore,
    completedLevels: Object.values(levelResults).filter(r => r.completed).length,
    nextLevelId: null,
    beginDrive: levelId => {
      startedAt.current = Date.now();
      setStartedRun(levelId);
    },
    completeRun,
    restartAttempt: () => {},
    routing,
    course: {
      frontierLevelId: frontierLevelId === null ? null : Math.min(frontierLevelId, 12),
      certified: cursor?.phase.kind === 'CERTIFIED',
      loading: state === null,
      openAll: routing.canOverride,
      note: null,
      postTest: false,
      resultNote,
      saving,
      error,
      continueCourse,
      playFreeReplay,
      playPostTest: null,
      gate,
      assessments: state && {
        backgroundRequired: state.backgroundRequired,
        backgroundDone: state.backgroundDone,
        submitBackground: async answers => {
          await saveBackground(uid, answers);
          setState(current => (current ? { ...current, backgroundDone: true } : current));
        },
        diagnosticDone: state.diagnosticDone,
        postExamOpen: state.cursor.phase.kind === 'CERTIFIED',
        postExamDone: state.postExamDone,
        diagnosticItems: diagnosticItems(),
        postExamItems: postExamItems(),
        submitDiagnostic: async (choices, responseMs) => {
          await saveDiagnostic(uid, diagnosticItems(), choices, responseMs);
          setState(current => (current ? { ...current, diagnosticDone: true } : current));
        },
        submitPostExam: async (choices, responseMs) => {
          const done = await completePostExam(uid, state.cursor, postExamItems(), choices, responseMs);
          setState(current => (current ? { ...current, cursor: done.cursor, postExamDone: true } : current));
        },
      },
    },
    liveReroll: false,
  };

  return <Outlet context={context} />;
};

export default CompetencyStoryRun;
