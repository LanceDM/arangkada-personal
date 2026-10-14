/**
 * What the controller hands the per-decision record: the theta the
 * session says each scenario got, passed with its decision, and each re-roll,
 * recorded against the decision whose settling caused it rather than whichever
 * was logged last.
 */
import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { LEGACY_OPTIONS, type AdaptiveOptions } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { approachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import type { LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DecisionTrace } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDriveController } from './driveController';
import type { DrivingSession } from './DrivingSession';

const level = LEVELS.find(entry => entry.id === 1)!;
const [first, second] = level.events;

describe('the drive controller', () => {
  it('passes the session’s approach trace with each decision, and records a re-roll against its cause', () => {
    const fsm = new DrivingFSM();
    const traceFor = (event: ScenarioEvent) =>
      approachTrace({ warningDistance: 300, approachRoom: 400, approachFloor: 100 }, { approachScale: event === first ? 1.5 : 0.75 });
    // Settling the first decision re-rolls the route; the second does not.
    const session = {
      getFsm: () => fsm,
      approachTraceFor: traceFor,
      settleDecision: () =>
        logs.length === 1 ? [{ kind: 'rerolled', competency: 'road_signs' } as GameEvent] : [],
    } as unknown as DrivingSession;

    const logs: ActionLog[] = [];
    const traces: DecisionTrace[] = [];
    let finished: LevelFsmTelemetry | null = null;
    const controller = createDriveController({
      session,
      level,
      evaluateAction: (event, action, kind = 'road', _quiet, settlement, approach) => {
        logs.push({ timestamp: logs.length, action, result: 'correct', points: 10, competency: 'road_signs' });
        traces.push({ scenarioId: event.id, kind, settlement: settlement ?? null, approach: approach ?? null });
        return { isCorrect: true, logIndex: logs.length - 1 };
      },
      readLogs: () => logs,
      readTraces: () => traces,
      readTotals: () => ({ score: 0, violations: 0, correctActions: 0, logs }),
      host: { jolt: () => {}, finish: (_result, telemetry) => (finished = telemetry) },
    });

    // A penalty reported in the same frame is logged after the first decision
    // but before its re-roll is drained from the queue.
    controller.handle([
      { kind: 'decision', event: first, action: 'stop', settlement: 'response' },
      { kind: 'penalty', event: second, action: 'brake' },
    ]);
    controller.handle([{ kind: 'decision', event: second, action: 'stop', settlement: 'expired' }]);
    controller.handle([{ kind: 'finished' }]);

    expect(traces.map(trace => trace.approach)).toEqual([traceFor(first), null, traceFor(second)]);
    expect(finished!.decisions).toEqual(traces);
    expect(finished!.rerolls).toEqual([{ afterDecision: 0, competency: 'road_signs' }]);
  });
});

describe('the live mastery estimate a re-roll is decided on', () => {
  /** Before this attempt: everything right once, and `parking` missed twice. */
  const prior: ActionLog[] = [
    ...COMPETENCIES.filter(c => c !== 'parking').map(
      (competency, i): ActionLog => ({ timestamp: i, action: 'brake', result: 'correct', points: 10, competency })
    ),
    { timestamp: 20, action: 'brake', result: 'violation', points: -10, competency: 'parking' },
    { timestamp: 21, action: 'brake', result: 'violation', points: -10, competency: 'parking' },
  ];

  /** The weak competency the controller hands the session after one right answer on `road_signs`. */
  const weakAfterOneDecision = (
    priorLogs?: readonly ActionLog[],
    options?: Pick<AdaptiveOptions, 'rerollHistory' | 'weakestTieBreak'>,
    liveReroll?: boolean
  ) => {
    const handed: Array<DrivingCompetency | null> = [];
    const session = {
      getFsm: () => new DrivingFSM(),
      approachTraceFor: () => undefined,
      settleDecision: ({ weakCompetency }: { weakCompetency: DrivingCompetency | null }) => {
        handed.push(weakCompetency);
        return [];
      },
    } as unknown as DrivingSession;
    const logs: ActionLog[] = [];
    const controller = createDriveController({
      session,
      level,
      evaluateAction: (_event, action) => {
        logs.push({ timestamp: 100 + logs.length, action, result: 'correct', points: 10, competency: 'road_signs' });
        return { isCorrect: true, logIndex: logs.length - 1 };
      },
      readLogs: () => logs,
      priorLogs,
      options,
      liveReroll,
      readTraces: () => [],
      readTotals: () => ({ score: 0, violations: 0, correctActions: 0, logs }),
      host: { jolt: () => {}, finish: () => {} },
    });
    controller.handle([{ kind: 'decision', event: first, action: 'stop', settlement: 'response' }]);
    return handed;
  };

  it("reads the learner's history ahead of the run's own logs, as the level entry did", () => {
    expect(weakAfterOneDecision(prior)).toEqual(['parking']);
  });

  it('reads the run alone under run-local, where the untouched sit at pInit and ties go to list order', () => {
    expect(weakAfterOneDecision(prior, LEGACY_OPTIONS)).toEqual(['driver_legality']);
  });

  it('is the run alone for a drive entered with no history', () => {
    expect(weakAfterOneDecision()).toEqual(weakAfterOneDecision([], LEGACY_OPTIONS));
  });

  it("is never handed on in the routing FSM's groups, so nothing re-rolls, announces or hints", () => {
    expect(weakAfterOneDecision(prior, undefined, true)).toEqual(['parking']);
    expect(weakAfterOneDecision(prior, undefined, false)).toEqual([null]);
    expect(weakAfterOneDecision(prior, LEGACY_OPTIONS, false)).toEqual([null]);
  });
});
