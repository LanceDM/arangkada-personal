import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/useText';
import type { Language, Localized } from '@/shared/lib/localized';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import { competencyText } from '@/domain/learner/profile';
import { QUIZ_PASS_CORRECT } from '@/domain/learner/stageCompetencies';
import { phaseLevel, reviewsDue, type CourseCursor } from '@/domain/competencyRouting/course';
import { useProgressStore } from '@/features/progression';
import {
  LEVELS,
  competencyCourseProgressOf,
  courseDepsFor,
  finishCourseDrive,
  finishCourseQuizReview,
  loadCourse,
  markCourseLessonsRead,
  markCourseReviewShown,
  openCourseQuiz,
  planCourseDrive,
  playableLevel,
  submitCourseQuiz,
  type BriefingCourse,
  type CourseAccount,
  type CourseDriveRun,
  type CourseNote,
  type LevelConfig,
  type LevelFsmTelemetry,
  type PlayConditions,
  type QuizItemDoc,
  type QuizSittingDoc,

} from '@/features/driving-sim';
import { storyMessages as m } from './messages';
import type { StoryCourse, StoryRouting, StoryRunContext } from './storyRunContext';

const NO_PRIOR_LOGS: readonly ActionLog[] = [];

/** A stage's topics the course has not finished: what a repeat drive asks. */
const stillOpen = (cursor: CourseCursor): string[] =>
  Object.entries(cursor.stage).filter(([, progress]) => progress && !progress.done).map(([competency]) => competency);

const topicsOf = (competencies: readonly string[]) => competencies.map(c => competencyText(c).en).join(', ');

/** The course's quiz rule, read the way the course grades it: 2 of 3 for every competency asked. */
/** A stage's quiz is behind the participant once its drive or a repeat is reached. */
const quizBehind = (cursor: CourseCursor | null, level: number | null): boolean =>
  cursor !== null && level !== null && level !== 0 && level !== 12 &&
  (cursor.phase.kind === 'DRIVE' || cursor.phase.kind === 'REPEAT') && phaseLevel(cursor.phase) === level;

const passesCourseQuiz = (answers: Readonly<Record<string, number>>, items: readonly QuizItemDoc[]) => {
  const correct = new Map<string, number>();
  for (const item of items) correct.set(item.competency, (correct.get(item.competency) ?? 0) + (answers[item.id] === item.correctIndex ? 1 : 0));
  return [...correct.values()].every(n => n >= QUIZ_PASS_CORRECT);
};

interface PlannedDrive {
  levelId: number;
  /** The cursor the drive was planned at: the one its completion commits from. */
  cursor: CourseCursor;
  drive: CourseDriveRun;
  language: Language;
  attempt: number;
}

type QuizState = BriefingCourse['quiz'];

interface CompetencyStoryRunProps {
  routing: StoryRouting;
  account: CourseAccount;
}

/**
 * Story Mode as the per-competency course: Continue
 * takes the participant to wherever their course stands. A stage is its module,
 * its Short Quiz (the gate: 2 of 3 per competency, three attempts, then the
 * module again), its drive and the repeat drives the course decides, then the
 * next stage; after Level 11, the final exam. No free replay: the course is the
 * whole of Story Mode for an account on it.
 */
const CompetencyStoryRun = ({ routing, account }: CompetencyStoryRunProps) => {
  const { levelId: levelIdParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedLevelId = levelIdParam === undefined ? null : Number(levelIdParam);
  const isValidLevel =
    requestedLevelId !== null && Number.isInteger(requestedLevelId) && LEVELS.some(level => level.id === requestedLevelId);
  const activeLevel = isValidLevel ? requestedLevelId : null;

  const { saveLevelResult, totalScore, levelResults } = useProgressStore();
  const { language } = useLanguage();
  const deps = useMemo(() => courseDepsFor(account), [account]);
  const uid = account.uid;

  const [cursor, setCursor] = useState<CourseCursor | null>(null);
  const [error, setError] = useState<Localized | null>(null);
  const [briefed, setBriefed] = useState<{ levelId: number; note: CourseNote } | null>(null);
  const [run, setRun] = useState<PlannedDrive | null>(null);
  const [quiz, setQuiz] = useState<QuizState>({ kind: 'loading' });
  const [finished, setFinished] = useState<{ levelId: number; level: LevelConfig; topics?: string[] } | null>(null);
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [resultNote, setResultNote] = useState<Localized | null>(null);
  const [verdicts, setVerdicts] = useState<StoryCourse['verdicts']>(null);
  const [saving, setSaving] = useState(false);
  const [startedRun, setStartedRun] = useState<number | null>(null);
  const attempts = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadCourse(deps, uid)
      .then(loaded => !cancelled && setCursor(loaded))
      .catch(failure => {
        console.error('Failed to load the course:', failure);
        if (!cancelled) setError(m.courseNotLoaded);
      });
    return () => {
      cancelled = true;
    };
  }, [deps, uid]);

  const note = (lines: Localized[]): CourseNote => ({ heading: m.courseHeading, lines });

  /** Plans the drive the cursor is at and opens its briefing. */
  const planDrive = useCallback(
    async (at: CourseCursor, lines: Localized[]) => {
      const drive = await planCourseDrive(deps, uid, at);
      setRun({ levelId: drive.levelId, cursor: at, drive, language, attempt: ++attempts.current });
      setBriefed({ levelId: drive.levelId, note: note(lines) });
      setQuiz({ kind: 'no-quiz' });
      setStartedRun(null);
      navigate(`/play/story/${drive.levelId}/briefing`);
    },
    [deps, uid, language, navigate]
  );

  /** Takes the participant to wherever their course stands, moving it only through its own steps. */
  const enter = useCallback(
    async (from: CourseCursor) => {
      const { phase } = from;
      if (phase.kind === 'CERTIFIED') return setResultNote(m.courseDone);
      if (phase.kind === 'FINAL') return planDrive(from, [m.courseFinal]);
      if (phase.kind === 'MODULE' && phase.level === 0) {
        const next = await markCourseLessonsRead(deps, uid, from);
        setCursor(next);
        return planDrive(next, [m.courseTutorial]);
      }
      if (phase.kind === 'DRIVE' && phase.level === 0) return planDrive(from, [m.courseTutorial]);
      if (phase.kind === 'MODULE' || phase.kind === 'QUIZ') {
        setRun(null);
        setQuiz({ kind: 'loading' });
        setBriefed({ levelId: phase.level, note: note([m.courseModuleThenQuiz]) });
        setStartedRun(null);
        navigate(`/play/story/${phase.level}/briefing`);
        return;
      }
      if (phase.kind === 'QUIZ_REVIEW') {
        const next = await finishCourseQuizReview(deps, uid, from);
        setCursor(next);
        return planDrive(next, [m.courseQuizReview]);
      }
      // DRIVE or REPEAT: any module section the course chose to review is shown first.
      const due = reviewsDue(from);
      const ready = due.length > 0 ? await markCourseReviewShown(deps, uid, from) : from;
      if (ready !== from) setCursor(ready);
      const lines = [phase.kind === 'REPEAT' ? m.courseRepeat(topicsOf(stillOpen(ready))) : m.courseDriveNow];
      if (due.length > 0) lines.push(m.courseReview(topicsOf(due)));
      return planDrive(ready, lines);
    },
    [deps, uid, navigate, planDrive]
  );

  const guarded = useCallback(async (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      setError(null);
      await work();
    } catch (failure) {
      console.error('Course step failed:', failure);
      setError(m.levelNotPrepared);
      setCursor(await loadCourse(deps, uid).catch(() => null));
    } finally {
      busy.current = false;
    }
  }, [deps, uid]);

  const continueCourse = useCallback(
    () => void guarded(async () => enter(cursor ?? (await loadCourse(deps, uid)))),
    [guarded, enter, cursor, deps, uid]
  );

  const continueOnArrival = Boolean((location.state as { continueCourse?: boolean } | null)?.continueCourse);
  const arrivalTaken = useRef(false);
  useEffect(() => {
    if (!continueOnArrival || cursor === null || activeLevel !== null || arrivalTaken.current) return;
    arrivalTaken.current = true;
    navigate(location.pathname, { replace: true, state: null });
    continueCourse();
  }, [continueOnArrival, cursor, activeLevel, continueCourse, navigate, location.pathname]);

  // The quiz of a stage being briefed: lessons are marked read as the briefing opens, then the draw is made.
  const quizPhase = cursor && (cursor.phase.kind === 'MODULE' || cursor.phase.kind === 'QUIZ') && cursor.phase.level !== 0;
  const loadQuiz = useCallback(
    (at: CourseCursor, level: LevelConfig) =>
      void guarded(async () => {
        setQuiz({ kind: 'loading' });
        try {
          const ready = at.phase.kind === 'MODULE' ? await markCourseLessonsRead(deps, uid, at) : at;
          if (ready !== at) setCursor(ready);
          const draw = await openCourseQuiz(deps, uid, ready, level);
          setQuiz(
            draw.items.length === 0
              ? { kind: 'empty' }
              : { kind: 'quiz', quiz: { moduleId: level.moduleId, items: draw.items, itemsPerSitting: draw.items.length, passingScore: draw.items.length } }
          );
        } catch (failure) {
          // The briefing's quiz step shows the retry.
          setQuiz({ kind: 'failed' });
          throw failure;
        }
      }),
    [guarded, deps, uid]
  );

  const briefedLevel = useMemo(() => {
    if (!briefed || briefed.levelId !== activeLevel) return null;
    if (run && run.levelId === activeLevel) return run.drive.level;
    return LEVELS.find(level => level.id === activeLevel) ?? null;
  }, [briefed, run, activeLevel]);

  useEffect(() => {
    if (!quizPhase || !cursor || !briefedLevel || run || quiz.kind !== 'loading') return;
    loadQuiz(cursor, briefedLevel);
  }, [quizPhase, cursor, briefedLevel, run, quiz.kind, loadQuiz]);

  const onQuizFinish = (sitting: QuizSittingDoc) => {
    if (!cursor || quiz.kind !== 'quiz') return;
    const items = quiz.quiz.items;
    const chosen = new Map(sitting.answers.map(answer => [answer.itemId, answer.chosen]));
    void guarded(async () => {
      const { cursor: next } = await submitCourseQuiz(deps, uid, cursor, items, items.map(item => chosen.get(item.id) ?? null));
      setCursor(next);
      if (next.phase.kind === 'DRIVE') await planDrive(next, [m.courseDriveNow]);
      else if (next.phase.kind === 'QUIZ_REVIEW') {
        const reviewed = await finishCourseQuizReview(deps, uid, next);
        setCursor(reviewed);
        await planDrive(reviewed, [m.courseQuizReview]);
      }
    });
  };

  const onQuizRetry = () => {
    if (cursor && briefedLevel && cursor.phase.kind === 'QUIZ') loadQuiz(cursor, briefedLevel);
  };

  const completeRun = (result: LevelResult, telemetry?: LevelFsmTelemetry, play?: PlayConditions) => {
    setLevelResult(result);
    saveLevelResult(result);
    if (!run) return;
    setFinished({ levelId: run.levelId, level: run.drive.level, topics: run.drive.composed ? [...new Set(run.drive.composed.items.map(item => item.competency))] : undefined });
    setSaving(true);
    setResultNote(null);
    setVerdicts(null);
    finishCourseDrive(account, run.cursor, run.drive, result, telemetry, run.language, play)
      .then(settled => {
        setCursor(settled.cursor);
        setVerdicts(settled.verdicts.map(v => ({ competency: v.competency, correct: v.correct, total: v.total, passed: v.passed })));
        const { phase } = settled.cursor;
        const next =
          phase.kind === 'CERTIFIED' ? m.courseCertified
          : phase.kind === 'FINAL' ? (run.levelId === 12 ? m.courseFinalAgain : m.courseNextFinal)
          : phase.kind === 'REPEAT' ? m.courseNextRepeat(topicsOf(stillOpen(settled.cursor)))
          : m.courseNextStage(phaseLevel(phase) ?? 0);
        setResultNote(next);
      })
      .catch(async failure => {
        console.error('Failed to save the course drive:', failure);
        setResultNote(m.resultNotSaved);
        setCursor(await loadCourse(deps, uid).catch(() => null));
      })
      .finally(() => setSaving(false));
  };

  const current = run && run.levelId === activeLevel ? run : null;
  const rolled = current?.drive.level ?? (finished && finished.levelId === activeLevel ? finished.level : briefedLevel);
  const shownLanguage = current?.language ?? language;
  const levelConfig = useMemo(() => (rolled ? playableLevel(rolled, shownLanguage) : null), [rolled, shownLanguage]);

  if (levelIdParam !== undefined && !isValidLevel) return <Navigate to="/play/story" replace />;

  const progress = competencyCourseProgressOf(cursor);
  const finishedTopics = finished && finished.levelId === activeLevel ? finished.topics : undefined;
  const course: StoryCourse = {
    frontierLevelId: progress.frontierLevel,
    certified: progress.endReason === 'certified',
    loading: cursor === null,
    openAll: false,
    note: briefed && briefed.levelId === activeLevel ? briefed.note : null,
    resultNote,
    saving,
    error,
    continueCourse,
    topics: current?.drive.composed ? [...new Set(current.drive.composed.items.map(item => item.competency))] : finishedTopics,
    verdicts,
    playFreeReplay: () => {},
  };

  const courseBriefing: BriefingCourse | null =
    briefed && briefed.levelId === activeLevel
      ? {
          quiz,
          passes: passesCourseQuiz,
          onQuizFinish,
          onQuizRetry,
          retryLoad: () => setQuiz({ kind: 'loading' }),
          driveReady: current !== null,
          quizDone: quizBehind(cursor, activeLevel),
          countedScenarios: current?.drive.composed?.items.length ?? null,
        }
      : null;

  const context: StoryRunContext = {
    activeLevel,
    levelConfig,
    weakArea: null,
    practice: null,
    support: 'full',
    attemptSeed: current?.drive.attemptSeed ?? null,
    priorLogs: NO_PRIOR_LOGS,
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
    beginDrive: setStartedRun,
    completeRun,
    restartAttempt: () => {},
    routing,
    course,
    liveReroll: false,
    courseBriefing,
  };

  return <Outlet context={context} />;
};

export default CompetencyStoryRun;
