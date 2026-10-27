// @vitest-environment jsdom
/**
 * Every mistake is explained in full, whatever support level it was made at.
 *
 * The support level h decides how much of the answer a scenario shows before
 * the decision. What comes after a mistake is fixed: the
 * move the scenario wanted and what a real vehicle would also need are on the
 * correction at `none` exactly as at `full`, because at `none` the correction
 * is the only place the learner meets them. The level itself is recorded with
 * each decision answered with the car, and with nothing else.
 */
import { useImperativeHandle, forwardRef, type Ref } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import type { SupportLevel } from '@/domain/learner/competency';
import type { ActionLog } from '@/domain/learner/attempt';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { scenarioInstruction } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import type { DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import { approachTrace, type ApproachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import type { DecisionTrace } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import type { PracticeItemScoring } from '@/features/driving-sim/domain/scoring/scoreDecision';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { useScenarioEvaluation, type ScenarioResultState } from './useScenarioEvaluation';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const jam = LEVELS.find(level => level.id === 9)!.events.find(event => event.id === 'level9.throttle-sticks-open')!;

interface Probe {
  evaluate: (action: string, settlement?: DecisionSettlement, kind?: 'road' | 'penalty') => void;
  evaluateFully: (
    kind: 'road' | 'garage' | 'penalty',
    settlement?: DecisionSettlement,
    approach?: ApproachTrace
  ) => { isCorrect: boolean; logIndex: number };
  result: () => ScenarioResultState | null;
  logs: () => ActionLog[];
  traces: () => DecisionTrace[];
}

const Harness = forwardRef(({ support }: { support: SupportLevel }, ref: Ref<Probe>) => {
  const evaluation = useScenarioEvaluation({ fsm: new DrivingFSM(), support });
  useImperativeHandle(ref, () => ({
    evaluate: (action, settlement, kind = 'road') =>
      evaluation.evaluateAction(jam, action, kind, kind === 'penalty', settlement),
    evaluateFully: (kind, settlement, approach) =>
      evaluation.evaluateAction(jam, jam.correctAction, kind, kind === 'penalty', settlement, approach),
    result: () => evaluation.result,
    logs: () => evaluation.logsRef.current,
    traces: () => evaluation.tracesRef.current,
  }));
  return null;
});

/** One decision on a fresh drive at `support`; what the screen and the log got. */
const decide = (support: SupportLevel, action: string, settlement?: DecisionSettlement, kind?: 'road' | 'penalty') => {
  const probe: { current: Probe | null } = { current: null };
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness support={support} ref={probe} />));
  act(() => probe.current!.evaluate(action, settlement, kind));
  const outcome = { result: probe.current!.result(), log: probe.current!.logs().at(-1)! };
  act(() => root.unmount());
  return outcome;
};

describe('a correction after a mistake', () => {
  it('carries the move and the real-world note at every support level', () => {
    for (const support of ['full', 'cue', 'none'] as const) {
      const { result } = decide(support, 'accelerate', 'expired');
      expect(result?.correct, support).toBe(false);
      expect(result?.move, support).toBe(scenarioInstruction(jam));
      expect(result?.realWorldNote, support).toBe(jam.realWorldNote);
    }
  });

  it('is the same card at every support level', () => {
    const full = decide('full', 'accelerate', 'expired').result;
    expect(decide('cue', 'accelerate', 'expired').result).toEqual(full);
    expect(decide('none', 'accelerate', 'expired').result).toEqual(full);
  });

  it('is not added to a correct decision', () => {
    const { result } = decide('none', jam.correctAction, 'response');
    expect(result?.correct).toBe(true);
    expect(result?.move).toBeUndefined();
  });
});

describe('the support level recorded with a decision', () => {
  it('is recorded on every decision answered with the car', () => {
    for (const support of ['full', 'cue', 'none'] as const) {
      for (const settlement of ['response', 'expired', 'lapse'] as const) {
        expect(decide(support, jam.correctAction, settlement).log.support, `${support} ${settlement}`).toBe(support);
      }
    }
  });

  it('is not recorded on a question, a tutorial step or a standing penalty', () => {
    expect('support' in decide('none', jam.correctAction, 'question').log).toBe(false);
    expect('support' in decide('none', jam.correctAction, 'guided').log).toBe(false);
    expect('support' in decide('none', 'crawl', undefined, 'penalty').log).toBe(false);
  });
});

describe('the trace kept beside each logged decision', () => {
  it('is one per log entry, in the same order, carrying what the entry does not', () => {
    const approach = approachTrace(
      { warningDistance: 400, approachRoom: 520, approachFloor: Number.POSITIVE_INFINITY },
      { approachScale: 1.5 }
    );
    const probe: { current: Probe | null } = { current: null };
    const root = createRoot(document.createElement('div'));
    act(() => root.render(<Harness support="cue" ref={probe} />));
    const indices: number[] = [];
    act(() => {
      indices.push(probe.current!.evaluateFully('garage').logIndex);
      indices.push(probe.current!.evaluateFully('road', 'response', approach).logIndex);
      indices.push(probe.current!.evaluateFully('penalty').logIndex);
    });
    const logs = probe.current!.logs();
    const traces = probe.current!.traces();
    act(() => root.unmount());

    expect(indices).toEqual([0, 1, 2]);
    expect(traces).toHaveLength(logs.length);
    expect(traces).toEqual([
      { scenarioId: jam.id, kind: 'garage', settlement: null, approach: null },
      { scenarioId: jam.id, kind: 'road', settlement: 'response', approach },
      { scenarioId: jam.id, kind: 'penalty', settlement: null, approach: null },
    ]);
    // The widened approach was held at the room: the theta it got is not the one asked for.
    expect(approach.lead).toBe(520);
    expect(approach.effective).toBeCloseTo(1.3, 12);
  });
});

describe('an appended practice item, as the game scores it', () => {
  const item: ScenarioEvent = { ...jam, remediation: true, remediationSourceLevelId: 9 };

  interface Scorer {
    evaluate: (event: ScenarioEvent, action: string) => void;
    score: () => number;
    streak: () => number;
    result: () => ScenarioResultState | null;
    logs: () => ActionLog[];
  }

  const ScoringHarness = forwardRef(
    ({ scoring }: { scoring?: PracticeItemScoring }, ref: Ref<Scorer>) => {
      const evaluation = useScenarioEvaluation({ fsm: new DrivingFSM(), practiceItemScoring: scoring });
      useImperativeHandle(ref, () => ({
        evaluate: (event, action) => evaluation.evaluateAction(event, action, 'road', false, 'response'),
        score: () => evaluation.scoreRef.current,
        streak: () => evaluation.violationStreak,
        result: () => evaluation.result,
        logs: () => evaluation.logsRef.current,
      }));
      return null;
    }
  );

  /** A drive that misses one authored scenario, answers the correct one, then meets `event` answered `action`. */
  const drive = (scoring: PracticeItemScoring | undefined, action: string) => {
    const probe: { current: Scorer | null } = { current: null };
    const root = createRoot(document.createElement('div'));
    act(() => root.render(<ScoringHarness scoring={scoring} ref={probe} />));
    act(() => probe.current!.evaluate(jam, jam.correctAction));
    act(() => probe.current!.evaluate(jam, 'accelerate'));
    const before = { score: probe.current!.score(), streak: probe.current!.streak() };
    act(() => probe.current!.evaluate(item, action));
    const after = {
      score: probe.current!.score(),
      streak: probe.current!.streak(),
      card: probe.current!.result(),
      log: probe.current!.logs().at(-1)!,
    };
    act(() => root.unmount());
    return { before, after };
  };

  it('counts for nothing and leaves the streak by default, and is still graded and logged', () => {
    for (const action of [jam.correctAction, 'accelerate']) {
      const { before, after } = drive(undefined, action);
      expect(after.score, action).toBe(before.score);
      expect(after.streak, action).toBe(before.streak);
      expect(after.card?.points, action).toBe(0);
      expect(after.card?.correct, action).toBe(action === jam.correctAction);
      expect(after.log.remediation, action).toBe(true);
      expect(after.log.result, action).toBe(action === jam.correctAction ? 'correct' : 'violation');
    }
  });

  it('earns its points when right, and moves the streak when wrong, under upside-only', () => {
    const right = drive('upside-only', jam.correctAction);
    expect(right.after.score).toBeGreaterThan(right.before.score);
    expect(right.after.streak).toBe(0);
    const wrong = drive('upside-only', 'accelerate');
    expect(wrong.after.score).toBe(wrong.before.score);
    expect(wrong.after.streak).toBe(wrong.before.streak + 1);
  });
});
