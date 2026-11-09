/**
 * Story Mode in a New group: the routing FSM decides
 * each course entry, and the player can replay a level they have passed.
 *
 * The run state is the same as Legacy's - one attempt's plan held from
 * briefing through results across four URLs - but an entry is planned when the
 * player asks for one, not when a URL names a level:
 *
 * - **Continue** asks the routing FSM: the entry pending on the cursor, or a
 *   fresh decision by the group's policy. The cursor is saved with the entry
 *   pending before the briefing shows, so leaving and coming back enters the
 *   same entry again.
 * - **A passed level on the map** is a free replay, outside the machine.
 *
 * A briefing URL loaded cold has no plan behind it and returns to the map, as
 * drive and results already do. The finished attempt is kept beside the next
 * plan so the results screen still has its level while the navigation away
 * from it is in flight.
 *
 * Everything decided here is route state or a call into Driving Sim's public
 * API; nothing about the routing FSM, the simulation or persistence lives here.
 */
import { useLanguage } from '@/shared/i18n/useText';
import type { Language, Localized } from '@/shared/lib/localized';
import { storyMessages as m } from './messages';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProgressStore } from '@/features/progression';
import {
  completeCourseAttempt,
  completeFreeReplay,
  cursorFrontierLevel,
  freeReplayNote,
  LEVELS,
  playableLevel,
  loadCourseCursor,
  nextAttemptSeed,
  startCourseEntry,
  startFreeReplay,
  type AdaptivePlan,
  type CourseRun,
  type FreeReplayRun,
  type LevelConfig,
  type RoutingCursor,
} from '@/features/driving-sim';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { LevelFsmTelemetry, PlayConditions } from '@/features/driving-sim';
import type { StoryRouting, StoryRunContext } from './storyRunContext';

const SAVE_PROMPT_KEY = 'arangkada_save_prompted';
const NO_PRIOR_LOGS: readonly ActionLog[] = [];

/** One planned attempt: a course entry or a free replay. */
interface PlannedRun {
  /** The language chosen when the entry began, which its attempt records. */
  language: Language;
  attempt: number;
  levelId: number;
  seed: number;
  plan: AdaptivePlan;
  course: CourseRun | null;
  /** A free replay's run, outside the machine. */
  free: FreeReplayRun | null;
}

interface RoutedStoryRunProps {
  routing: StoryRouting;
  uid: string | null;
  group: 'conventional' | 'optimized';
}

const RoutedStoryRun = ({ routing, uid, group }: RoutedStoryRunProps) => {
  const { levelId: levelIdParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedLevelId = levelIdParam === undefined ? null : Number(levelIdParam);
  const isValidLevel =
    requestedLevelId !== null &&
    Number.isInteger(requestedLevelId) &&
    LEVELS.some(level => level.id === requestedLevelId);
  const activeLevel = isValidLevel ? requestedLevelId : null;

  const { saveLevelResult, unlockLevel, totalScore, levelResults } = useProgressStore();

  const { language } = useLanguage();
  const [cursor, setCursor] = useState<RoutingCursor | null>(null);
  const [error, setError] = useState<Localized | null>(null);
  const [run, setRun] = useState<PlannedRun | null>(null);
  // The attempt the results screen shows, kept until the next one finishes.
  const [finished, setFinished] = useState<{ levelId: number; level: LevelConfig } | null>(null);
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [resultNote, setResultNote] = useState<Localized | null>(null);
  const [saving, setSaving] = useState(false);
  const [startedRun, setStartedRun] = useState<number | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const attempts = useRef(0);
  const starting = useRef(false);
  // The finished attempt's save. The next entry is planned only after it, so
  // the history and the cursor it reads include the attempt just played.
  const completion = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadCourseCursor(uid)
      .then(loaded => !cancelled && setCursor(loaded))
      .catch(failure => {
        console.error('Failed to load the course:', failure);
        if (!cancelled) setError(m.courseNotLoaded);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Landing on the map ends whatever entry was being briefed or shown. An
  // entry left before its drive finished stays pending on the cursor, and
  // Continue enters it again.
  const [routedFrom, setRoutedFrom] = useState(activeLevel);
  if (activeLevel !== routedFrom) {
    setRoutedFrom(activeLevel);
    if (activeLevel === null) {
      setRun(null);
      setStartedRun(null);
      setLevelResult(null);
      setResultNote(null);
    }
  }

  const enter = useCallback(
    async (plan: () => Promise<Omit<PlannedRun, 'attempt'>>) => {
      if (starting.current) return;
      starting.current = true;
      try {
        await completion.current;
        const next = { ...(await plan()), attempt: ++attempts.current };
        setError(null);
        setRun(next);
        setStartedRun(null);
        navigate(`/play/story/${next.levelId}/briefing`);
      } catch (failure) {
        console.error('Failed to enter the course:', failure);
        setError(m.levelNotPrepared);
      } finally {
        starting.current = false;
      }
    },
    [navigate]
  );

  const continueCourse = useCallback(
    () =>
      void enter(async () => {
        const current = cursor ?? (await loadCourseCursor(uid));
        const course = await startCourseEntry({ uid, group, cursor: current, attemptSeed: nextAttemptSeed() });
        setCursor(course.cursor);
        return { language, levelId: course.entry.levelId, seed: course.attemptSeed, plan: course.plan, course, free: null };
      }),
    [enter, cursor, uid, group, language]
  );

  // The study's home asks for the next entry on arrival,
  // as the map's Continue would; the request is taken once, then cleared.
  const continueOnArrival = Boolean((location.state as { continueCourse?: boolean } | null)?.continueCourse);
  const arrivalTaken = useRef(false);
  useEffect(() => {
    if (!continueOnArrival || cursor === null || activeLevel !== null || arrivalTaken.current) return;
    arrivalTaken.current = true;
    navigate(location.pathname, { replace: true, state: null });
    continueCourse();
  }, [continueOnArrival, cursor, activeLevel, continueCourse, navigate, location.pathname]);

  const playFreeReplay = (levelId: number) =>
    void enter(async () => {
      const free = await startFreeReplay({ uid, levelId, attemptSeed: nextAttemptSeed() });
      return { language, levelId, seed: free.attemptSeed, plan: free.plan, course: null, free };
    });

  const completeRun = (result: LevelResult, telemetry?: LevelFsmTelemetry, play?: PlayConditions) => {
    setLevelResult(result);
    saveLevelResult(result);
    const index = LEVELS.findIndex(level => level.id === result.levelId);
    const nextLevelId = LEVELS[index + 1]?.id ?? null;
    if (result.completed && nextLevelId !== null) unlockLevel(nextLevelId);
    if (!run || !run.plan.level) return;

    setFinished({ levelId: run.levelId, level: run.plan.level });
    const start = { attemptSeed: run.seed, plan: run.plan, level: run.plan.level, language: run.language };
    const resolution = routing.resolution;
    setSaving(true);
    setResultNote(null);
    completion.current = (
      run.course
        ? completeCourseAttempt({ uid, result, telemetry, start, group: resolution, play, course: run.course }).then(settled => {
            setCursor(settled.cursor);
            setResultNote(settled.note);
          })
        : completeFreeReplay({ uid, result, telemetry, start, group: resolution, play, route: run.free!.route }).then(() =>
            setResultNote(m.replayOutside)
          )
    )
      .catch(async failure => {
        console.error('Failed to save the attempt:', failure);
        setResultNote(m.resultNotSaved);
        // The stored cursor still has the entry pending, so it is entered again.
        setCursor(await loadCourseCursor(uid).catch(() => null));
      })
      .finally(() => setSaving(false));

    if (!uid && result.levelId === 1 && result.completed && !localStorage.getItem(SAVE_PROMPT_KEY)) {
      setShowSaveModal(true);
      localStorage.setItem(SAVE_PROMPT_KEY, 'true');
    }
  };

  const current = run && run.levelId === activeLevel ? run : null;
  const rolledLevel = current?.plan.level ?? (finished && finished.levelId === activeLevel ? finished.level : null);
  // The screens read this; the records keep the plan's English level.
  const shownLanguage = current?.language ?? language;
  const levelConfig = useMemo(
    () => (rolledLevel ? playableLevel(rolledLevel, shownLanguage) : null),
    [rolledLevel, shownLanguage]
  );

  if (levelIdParam !== undefined && !isValidLevel) {
    return <Navigate to="/play/story" replace />;
  }

  const frontierLevelId = cursor ? cursorFrontierLevel(cursor) : null;

  const context: StoryRunContext = {
    activeLevel,
    levelConfig,
    weakArea: null,
    practice: null,
    support: current?.plan.support ?? 'full',
    attemptSeed: current?.seed ?? null,
    priorLogs: current?.plan.priorLogs ?? NO_PRIOR_LOGS,
    decisionSettled: current !== null,
    levelResult,
    recommendation: null,
    showSaveModal,
    dismissSaveModal: () => setShowSaveModal(false),
    startedRun,
    rollNonce: current?.attempt ?? 0,
    totalScore,
    completedLevels: Object.values(levelResults).filter(r => r.completed).length,
    nextLevelId: null,
    beginDrive: setStartedRun,
    completeRun,
    restartAttempt: () => {},
    routing,
    course: {
      frontierLevelId,
      certified: cursor?.state.kind === 'CERTIFIED',
      loading: cursor === null,
      openAll: routing.openAll,
      note: current?.course?.note ?? (current?.free ? freeReplayNote(current.levelId) : null),
      resultNote,
      saving,
      error,
      continueCourse,
      playFreeReplay,
    },
    liveReroll: false,
  };

  return <Outlet context={context} />;
};

export default RoutedStoryRun;
