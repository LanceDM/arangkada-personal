import { useCallback, useRef, useState } from 'react';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { scenarioInstruction, scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import type { ActionLog, SignOutcome } from '@/domain/learner/attempt';
import { evaluatePlayerAction } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import type { DrivingCompetency, SupportLevel } from '@/domain/learner/competency';
import { recordSignOutcome } from '@/features/driving-sim/application/signCoverage';
import type { FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';
import { reactionClockMs } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import { answeredWithTheCar, observeReaction, type DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import type { ApproachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import type { DecisionKind, DecisionTrace } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import { scoreDecision, type PracticeItemScoring } from '@/features/driving-sim/domain/scoring/scoreDecision';
import { GAME_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import type { useFSM } from './useFSM';

/**
 * One verdict, as the screen shows it back.
 *
 * `points` is carried rather than written into `message`, so the score change
 * is stated once and nothing downstream has to read a number out of a sentence.
 */
export type ScenarioResultState = {
  label: string;
  correct: boolean;
  message: string;
  points: number;
  action?: string;
  expectedAction?: string;
  citation?: string;
  /**
   * On a correction to a scenario answered with the car: the move it wanted,
   * and what a real vehicle would also need - everything the full briefing
   * says, whatever support level it was presented at. Every mistake is
   * explained in full; h only decides how much comes before it.
   */
  move?: string;
  realWorldNote?: string;
};

/** One scored decision, kept in state so the player panel can show a live feed. */
export type DecisionEntry = {
  id: number;
  isCorrect: boolean;
  competency?: string;
  action: string;
  expectedAction?: string;
  kind: DecisionKind;
  /** What was being judged, used for garage entries where verbs make no sense. */
  title: string;
};

const DECISION_FEED_LENGTH = 4;

interface UseScenarioEvaluationOptions {
  fsm: ReturnType<typeof useFSM>['fsm'];
  /**
   * The support level this level's scenarios are presented at, recorded with
   * every decision answered with the car. Omitted means the baseline machine's
   * full support, as omitted transition parameters mean its baseline theta.
   */
  support?: SupportLevel;
  /** Whether an appended practice item counts toward the pass mark. Omitted means the game's rule. */
  practiceItemScoring?: PracticeItemScoring;
}

const EVALUATION_CONTEXT_STATES = ['INTERSECTION', 'HAZARD', 'REACTION_WINDOW', 'DECISION'] as const satisfies readonly FSMState[];

const isFsmState = (state: FSMState, states: readonly FSMState[]) =>
  states.includes(state);

export const useScenarioEvaluation = ({
  fsm,
  support = 'full',
  practiceItemScoring = GAME_OPTIONS.practiceItemScoring,
}: UseScenarioEvaluationOptions) => {
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<ScenarioResultState | null>(null);
  const [screenShake, setScreenShake] = useState(0);
  const [violationStreak, setViolationStreak] = useState(0);
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const [decisionCount, setDecisionCount] = useState(0);
  const [roadDecisionCount, setRoadDecisionCount] = useState(0);
  const [garageDecisionCount, setGarageDecisionCount] = useState(0);

  const scoreRef = useRef(0);
  const logsRef = useRef<ActionLog[]>([]);
  // One per entry of `logsRef`, pushed with it: what the per-decision record
  // needs that the log entry does not carry.
  const tracesRef = useRef<DecisionTrace[]>([]);
  const signOutcomesRef = useRef<SignOutcome[]>([]);
  const violationsRef = useRef(0);
  const correctRef = useRef(0);
  const violationStreakRef = useRef(0);
  const triggerScreenShake = useCallback(() => {
    setScreenShake(1);
    setTimeout(() => setScreenShake(0), 400);
  }, []);

  const evaluateAction = useCallback((
    event: ScenarioEvent,
    playerAction: string,
    kind: DecisionKind = 'road',
    // When set, this decision is still scored and logged, but raises none of the
    // pop-up feedback: no toast, no correction card, no screen shake. Used for
    // the crawl penalty, which already has its own always-on amber banner and
    // fires repeatedly while the offence continues - so the amber warning is
    // meant to be the single on-screen cue for it, not one of three.
    quiet = false,
    // How the world settled this decision, for a road decision. Absent for a
    // garage answer or a standing penalty, neither of which is a response to
    // anything with a reaction clock.
    settlement?: DecisionSettlement,
    // What theta did to the scenario's approach, for a road decision: only the
    // session can say, so the controller asks it and passes it through.
    approach?: ApproachTrace
  ) => {
    // Standing penalties (crawling, wrong side of the road) are continuous
    // infractions, not discrete decisions at an event, so they sit outside the
    // consecutive-violation streak that escalates the level's graded events.
    // They neither read it - a crawl deduction is never multiplied up by real
    // mistakes made earlier - nor write it, so a few silent crawl charges can't
    // invisibly inflate the "(Nx streak!)" penalty on the next road event.
    const isStandingPenalty = kind === 'penalty';
    // Read the reaction clock off the FSM's own transition log before firing
    // this decision's verdict into it, so everything since the previous verdict
    // still belongs to the event being graded. Only a response is timed; the
    // clock is read for nothing else.
    const reaction = observeReaction(
      isStandingPenalty ? undefined : settlement,
      event,
      reactionClockMs(fsm.getTransitionLog())
    );

    // Only a scenario answered with the car was presented at a support level;
    // a question, a tutorial step and a standing penalty were not.
    const presented = !isStandingPenalty && answeredWithTheCar(settlement);
    const result = evaluatePlayerAction(
      event,
      playerAction,
      isStandingPenalty ? 0 : violationStreakRef.current,
      reaction,
      presented ? support : undefined
    );

    // The level's requiredScore/stars thresholds were calibrated against its
    // own authored events, and a practice item is appended on some runs and
    // not others. Under the game's `neutral` rule it never counts toward them,
    // in either direction, so it leaves pass or fail exactly as it would have
    // been without it (`scoreDecision`). It is still graded and logged below,
    // because the evidence is the entire reason it was injected.
    const scored = scoreDecision(
      { score: scoreRef.current, streak: violationStreakRef.current },
      event,
      result,
      practiceItemScoring,
      isStandingPenalty
    );
    const scoreDelta = scored.delta;
    scoreRef.current = scored.score;
    setScore(scoreRef.current);
    logsRef.current.push(result.log);
    tracesRef.current.push({
      scenarioId: event.id,
      kind,
      settlement: settlement ?? null,
      approach: approach ?? null,
    });
    const logIndex = logsRef.current.length - 1;
    // One verdict, carrying what the score actually did. The card decides how
    // long it stays up; this only says what happened.
    if (!quiet) {
      setResult({
        label: scenarioLabel(event),
        correct: result.isCorrect,
        message: result.message,
        points: scoreDelta,
        action: result.log.action,
        expectedAction: result.log.expectedAction ?? event.correctAction,
        citation: result.lawCitation ?? event.lawCitation,
        // Built from the event alone, never from `support`, so a correction is
        // the same at every level.
        ...(presented && !result.isCorrect
          ? { move: scenarioInstruction(event), realWorldNote: event.realWorldNote }
          : {}),
      });
    }
    setDecisions(prev => [
      {
        id: logsRef.current.length,
        isCorrect: result.isCorrect,
        competency: result.log.competency,
        action: result.log.action,
        expectedAction: result.log.expectedAction ?? event.correctAction,
        kind,
        title: event.description,
      },
      ...prev,
    ].slice(0, DECISION_FEED_LENGTH));
    setDecisionCount(logsRef.current.length);
    // Standing penalties are not one of the level's events, so they must not
    // inflate the "events cleared" count the mission panel reports.
    if (kind === 'garage') {
      setGarageDecisionCount(count => count + 1);
    } else if (kind === 'road') {
      setRoadDecisionCount(count => count + 1);
    }

    // Per-plate evidence, so replaying works through the syllabus rather than
    // resampling the same handful, and so the adaptive layer has something to
    // adapt to. A pavement marking is recorded exactly like a sign: it is a
    // thing the syllabus teaches and the drive can show, which is all the
    // coverage record cares about. Standing penalties carry neither and are
    // skipped.
    const plate = event.sign ?? event.marking;
    if (plate) {
      recordSignOutcome(plate.name, result.isCorrect);
      // Kept for this run only, so the review afterwards can show what was met
      // here rather than the cumulative record across every attempt.
      signOutcomesRef.current.push({
        name: plate.name,
        category: plate.category,
        meaning: plate.meaning,
        image: plate.image,
        isCorrect: result.isCorrect,
        action: result.log.action,
        expectedAction: result.log.expectedAction ?? event.correctAction,
        message: result.message,
      });
    }

    if (result.log.competency) {
      fsm.setCompetency(result.log.competency as DrivingCompetency);
    }

    // The streak is `scoreDecision`'s: a standing penalty is a continuous
    // infraction, not a fresh wrong answer, so it does not advance it (see
    // above), and neither does a practice item that does not count.
    violationStreakRef.current = scored.streak;
    setViolationStreak(scored.streak);
    if (result.isCorrect) {
      correctRef.current += 1;
    } else {
      violationsRef.current += 1;
      if (!quiet) triggerScreenShake();
    }

    if (isFsmState(fsm.getState(), ['APPROACHING_EVENT'])) {
      fsm.transition('scenario_trigger');
      fsm.transition(event.type);
    }

    // The FSM's own verdict on this decision - not a stand-in keypress. This is
    // what lets an incorrect right-of-way/parking/emergency cutscene answer
    // (graded in DECISION) reach VIOLATION at all: those never went through
    // this branch before DECISION was added to EVALUATION_CONTEXT_STATES.
    const state = fsm.getState();
    if (isFsmState(state, EVALUATION_CONTEXT_STATES)) {
      if (result.isCorrect) {
        fsm.transition('answer_correct');
        fsm.transition('feedback_displayed');
        fsm.transition('road_clear');
      } else {
        fsm.transition('answer_incorrect');
        setTimeout(() => {
          fsm.transition('feedback_displayed');
          fsm.transition('recovery_complete');
          fsm.transition('road_clear');
        }, 800);
      }
    }

    // Reported back so the simulation can hold still for a moment on a mistake.
    // A correction that appears while the road is still moving gets read with
    // one eye at best, and the next event is announcing itself before the
    // driver has finished it. The index is where this decision sits in the
    // run's logs, which is how a re-roll it causes is recorded against it.
    return { isCorrect: result.isCorrect, logIndex };
  }, [fsm, practiceItemScoring, support, triggerScreenShake]);

  return {
    score,
    scoreRef,
    result,
    dismissResult: () => setResult(null),
    screenShake,
    violationStreak,
    decisions,
    decisionCount,
    roadDecisionCount,
    garageDecisionCount,
    logsRef,
    tracesRef,
    signOutcomesRef,
    violationsRef,
    correctRef,
    evaluateAction,
  };
};
