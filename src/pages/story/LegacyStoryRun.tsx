/**
 * Legacy: today's Story Mode, as it was before the routing FSM reached the
 * game. This is the layout route's body moved here
 * unchanged; it differs only in recording the group it was played in with
 * each attempt, and in carrying the routing fields every run's context has.
 *
 * The state one Story Mode run carries, and nothing about how it looks.
 *
 * This is a layout route: it stays mounted across `/play/story`, its briefing,
 * its drive and its results, which is the whole reason a run can be split
 * across four URLs. `levelConfig` is built once per attempt and must survive
 * briefing → drive → complete, so a level that rolls its scenarios fresh each
 * attempt shows the same roll to all three. Sibling routes would rebuild it on
 * every navigation and the player would drive a level they were never briefed on.
 *
 * Everything decided here is either route state or a call into Driving Sim's
 * public API; nothing about the simulation, the FSM or persistence lives in
 * this file.
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuthSession } from '@/features/auth';
import { useProgressStore } from '@/features/progression';
import {
  buildAdaptivePlan,
  completeMission,
  LEVELS,
  nextAttemptSeed,
  startMission,
  type AdaptivePlan,
  type LevelRecommendation,
} from '@/features/driving-sim';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { LevelFsmTelemetry } from '@/features/driving-sim';
import type { StoryRouting, StoryRunContext } from './storyRunContext';

const SAVE_PROMPT_KEY = 'arangkada_save_prompted';

/** No plan yet means no history read; one array, so the drive is never handed a new one per render. */
const NO_PRIOR_LOGS: readonly ActionLog[] = [];

/** The adaptive plan, tagged with the attempt it was computed for, and that attempt's seed. */
interface SettledPlan {
  levelId: number;
  attempt: number;
  seed: number;
  plan: AdaptivePlan;
}

const LegacyStoryRun = ({ routing }: { routing: StoryRouting }) => {
  const { levelId: levelIdParam } = useParams();
  // A layout route sees the params of whichever child matched, so this is the
  // level named by the URL on the three run screens and undefined on the map.
  const requestedLevelId = levelIdParam === undefined ? null : Number(levelIdParam);
  const isValidLevel =
    requestedLevelId !== null &&
    Number.isInteger(requestedLevelId) &&
    LEVELS.some(level => level.id === requestedLevelId);
  const activeLevel = isValidLevel ? requestedLevelId : null;

  const { saveLevelResult, unlockLevel, levelResults, totalScore } = useProgressStore();
  const { user, isLoggedIn } = useAuthSession();

  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recommendation, setRecommendation] = useState<LevelRecommendation | null>(null);
  const [settled, setSettled] = useState<SettledPlan | null>(null);
  // Which level's drive has been entered from its own briefing. This is what
  // separates a real run from a cold load of `/play/story/3/drive`.
  const [startedRun, setStartedRun] = useState<number | null>(null);
  // Identifies the attempt. Retry returns to the same `:levelId`, so the URL
  // alone cannot tell the memo below that a fresh roll is due; this can.
  const [rollNonce, setRollNonce] = useState(0);

  // Tagged by attempt as well as by level because Retry returns to the *same*
  // level id: matching on the id alone would report the previous attempt's plan
  // as settled while a fresh one was still in flight, and the drive would mount
  // against a config that then changed underneath it.
  const decisionSettled =
    activeLevel !== null && settled?.levelId === activeLevel && settled.attempt === rollNonce;
  const plan = decisionSettled ? settled.plan : null;
  const attemptSeed = decisionSettled ? settled.seed : null;

  // The attempt's route is rolled with its plan, so this only says
  // which of the two a screen is looking at: the settled attempt, or the
  // provisional roll shown while its plan is still in flight. Retry needs no
  // signal of its own here — a fresh attempt settles a fresh plan, and the
  // roll comes with it.
  const levelConfig = useMemo(
    () => (activeLevel !== null ? startMission(activeLevel, plan) : null),
    [activeLevel, plan]
  );

  const completedLevels = Object.values(levelResults).filter(r => r.completed).length;

  const nextLevelIdAfter = (levelId: number) => {
    const index = LEVELS.findIndex(level => level.id === levelId);
    return index >= 0 ? (LEVELS[index + 1]?.id ?? null) : null;
  };

  // Landing on the map ends whatever run was in flight — the one reset that has
  // to cover the browser back button as well as the exit buttons.
  //
  // Adjusted while rendering the navigation that ends the run, rather than in
  // an effect afterwards: React re-runs this component before it paints, so
  // the map is never shown for a frame with the finished run still in state.
  const [routedFrom, setRoutedFrom] = useState(activeLevel);
  if (activeLevel !== routedFrom) {
    setRoutedFrom(activeLevel);
    if (activeLevel === null) {
      setStartedRun(null);
      setLevelResult(null);
      setRecommendation(null);
    }
  }

  useEffect(() => {
    if (activeLevel === null) return;
    let cancelled = false;

    void (async () => {
      // One seed per attempt, taken with its plan: the practice pick, the
      // roll and the order of every question's answers all draw from it.
      const seed = nextAttemptSeed();
      const next = await buildAdaptivePlan(isLoggedIn && user ? user.uid : null, activeLevel, seed);
      if (cancelled) return;
      setSettled({ levelId: activeLevel, attempt: rollNonce, seed, plan: next });
      // The one place the adaptive decision is visible in real play without
      // opening a dev tool. The corner tag in GameScreen shows *that* an event
      // was injected; this shows *why*.
      if (import.meta.env.DEV) {
        console.log(`[practice] entering level ${activeLevel}: ${next.explanation}`);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `rollNonce` re-plans a fresh attempt at the same level: Retry should be
    // planned against the history the previous attempt just added.
  }, [activeLevel, isLoggedIn, user, rollNonce]);

  const completeRun = (result: LevelResult, telemetry?: LevelFsmTelemetry) => {
    setLevelResult(result);
    saveLevelResult(result);

    const nextLevelId = nextLevelIdAfter(result.levelId);
    if (result.completed && nextLevelId !== null) unlockLevel(nextLevelId);

    // Everything past this point only fills in the results screen's
    // recommendation panel, which renders without it.
    void (async () => {
      const uid = isLoggedIn && user ? user.uid : null;
      const start =
        plan && levelConfig && attemptSeed !== null ? { attemptSeed, plan, level: levelConfig } : undefined;
      setRecommendation(await completeMission({ uid, result, telemetry, start, group: routing.resolution }));

      if (!uid && result.levelId === 1 && result.completed) {
        if (!localStorage.getItem(SAVE_PROMPT_KEY)) {
          setShowSaveModal(true);
          localStorage.setItem(SAVE_PROMPT_KEY, 'true');
        }
      }
    })();
  };

  // A URL naming a level nobody has heard of is not a 404 — the rest of the
  // path is real — so it lands on the map rather than the not-found page.
  if (levelIdParam !== undefined && !isValidLevel) {
    return <Navigate to="/play/story" replace />;
  }

  const context: StoryRunContext = {
    activeLevel,
    levelConfig,
    weakArea: plan?.weakArea ?? null,
    practice: plan?.practice ?? null,
    // The drive mounts only once the plan has settled, so the fallback is never
    // what a drive is played at.
    support: plan?.support ?? 'full',
    attemptSeed,
    priorLogs: plan?.priorLogs ?? NO_PRIOR_LOGS,
    decisionSettled,
    levelResult,
    recommendation,
    showSaveModal,
    dismissSaveModal: () => setShowSaveModal(false),
    startedRun,
    rollNonce,
    totalScore,
    completedLevels,
    nextLevelId: activeLevel === null ? null : nextLevelIdAfter(activeLevel),
    beginDrive: setStartedRun,
    completeRun,
    // Deliberately leaves `levelResult` alone. Clearing it here would race the
    // navigation that always follows: the results screen redirects to the map
    // when it has no result for its level, so a clear landing before the route
    // change flashes the map on the way to Retry.
    restartAttempt: () => {
      setRecommendation(null);
      setRollNonce(nonce => nonce + 1);
    },
    routing,
    course: null,
    liveReroll: true,
  };

  return <Outlet context={context} />;
};

export default LegacyStoryRun;
