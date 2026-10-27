/**
 * Level 12's traffic stops, driven.
 *
 * The flagged-down and ticket-issued slots are an enforcer at the curb flagging
 * the car down, and the stop they grade is the one the sources give a driver
 * stopped by an enforcer: "safely pull over to the extreme right". Until the
 * first play-test they drew a checkpoint's barrier across the
 * road, titled themselves a checkpoint, and opened on a full stop in any lane,
 * while their text said the enforcer had flagged the car over to the side.
 *
 * Each scenario is driven alone on Level 12's own road, so what opens the panel
 * is the lane and the stop and nothing else on the route.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { level12, SLOTS } from '@/features/driving-sim/domain/scenario/content/levels/level12';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { laneCentreX, roadXAt, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

/** The lane against the center line, where the drive starts, and the lane against the curb. */
const INNER = 2 as LaneIndex;
const CURB = 3 as LaneIndex;

/** Where the scenario stands on its one-event road. */
const AT = 900;

const ROADSIDE_CHECKS = SLOTS[0];
const TRAFFIC_STOPS = [...SLOTS[2], ...SLOTS[4]];

/** Level 12's own road, with this scenario on it and nothing else. */
const alone = (variant: SlotVariant): LevelConfig => ({
  ...level12,
  events: [{ ...variant, triggerAtDistance: AT } as ScenarioEvent],
  roadLength: AT + 1200,
});

interface View {
  distance: number;
  lane: LaneIndex;
  /** Frames the car has been at rest in a row. */
  restFrames: number;
}

/** Where the driver wants to be and how fast, frame by frame. */
type Plan = (view: View) => { lane: LaneIndex; speed: number };

interface Drive {
  /** Each inspection that opened: where, and in which lane. */
  opened: Array<{ distance: number; lane: number }>;
  decision: { action: string; settlement: DecisionSettlement; penaltyMessage: string; correct: boolean } | null;
  /** The scene the frame composed while the scenario was ahead on screen. */
  sceneKinds: Set<string>;
}

const drive = (level: LevelConfig, plan: Plan, frames = 6000): Drive => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  const result: Drive = { opened: [], decision: null, sceneKinds: new Set() };
  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level, fsm, signCoverage: {} });
    let previous: InputState = NO_INPUT;
    let restFrames = 0;

    const take = (reported: readonly GameEvent[]) => {
      const queue = [...reported];
      while (queue.length > 0) {
        const report = queue.shift()!;
        if (report.kind !== 'decision') continue;
        const { isCorrect } = evaluateWeightedRule(report.event, report.action, 0);
        result.decision ??= {
          action: report.action,
          settlement: report.settlement,
          penaltyMessage: report.event.penaltyMessage,
          correct: isCorrect,
        };
        fsm.transition(isCorrect ? 'answer_correct' : 'answer_incorrect');
        fsm.transition('feedback_displayed');
        if (!isCorrect) fsm.transition('recovery_complete');
        fsm.transition('road_clear');
        queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
      }
    };

    for (let frame = 0; frame < frames && !result.decision; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      const snapshot = session.getSnapshot();
      const scene = session.getFrame()?.scene;
      const car = scene?.car;
      const distance = car?.distance ?? 0;
      restFrames = snapshot.speed <= 0.5 ? restFrames + 1 : 0;
      if (scene && distance > AT - 900 && distance < AT) for (const node of scene.nodes) result.sceneKinds.add(node.kind);

      const document = snapshot.inspectionEvent;
      if (document) {
        result.opened.push({ distance, lane: snapshot.lane });
        take(session.answerInspection(document.correctAction));
        continue;
      }

      const want = plan({ distance, lane: snapshot.lane as LaneIndex, restFrames });
      const target = laneCentreX(want.lane, roadXAt(distance, scene?.curves ?? []));
      const x = car?.x ?? target;
      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < want.speed - 1 && !previous.throttle,
        brake: snapshot.speed > want.speed + 0.5,
        left: x > target + 4,
        right: x < target - 4,
      };
      previous = input;
      take(session.update(input));
    }
    return result;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

/** Comes to rest in `lane` in the zone, a little short of the enforcer. */
const stopsIn = (lane: LaneIndex): Plan => ({ distance }) =>
  distance < AT - 300 ? { lane, speed: 30 } : { lane, speed: 0 };

/**
 * Stops in the lane the drive started in and waits there, then moves over to
 * the curb lane and stops again.
 */
const stopsThenPullsOver = (): Plan => {
  let waited = false;
  return ({ distance, restFrames }) => {
    if (!waited) {
      if (restFrames >= 90) waited = true;
      return distance < AT - 300 ? { lane: INNER, speed: 30 } : { lane: INNER, speed: 0 };
    }
    return distance < AT - 120 ? { lane: CURB, speed: 12 } : { lane: CURB, speed: 0 };
  };
};

/** Stops in the lane it started in, then drives on past without pulling over. */
const stopsThenDrivesOn = (): Plan => {
  let waited = false;
  return ({ distance, restFrames }) => {
    if (!waited && restFrames >= 90) waited = true;
    if (waited) return { lane: INNER, speed: 30 };
    return distance < AT - 300 ? { lane: INNER, speed: 30 } : { lane: INNER, speed: 0 };
  };
};

describe("Level 12's traffic stops", () => {
  it('are the flagged-down and ticket-issued slots, and only those', () => {
    expect(TRAFFIC_STOPS.map(variant => variant.inspection?.pullOver !== undefined)).toEqual(
      TRAFFIC_STOPS.map(() => true)
    );
    expect(ROADSIDE_CHECKS.filter(variant => variant.inspection?.pullOver).map(variant => variant.id)).toEqual([]);
    for (const variant of TRAFFIC_STOPS) {
      expect(variant.inspection!.pullOver!.missedMessage, variant.id).toMatch(/pull over to the extreme right/);
      expect(variant.description, variant.id).toMatch(/at the curb ahead flags you down/);
    }
  });

  for (const variant of TRAFFIC_STOPS) {
    describe(variant.id, () => {
      it('draws an enforcer at the curb, and no checkpoint', () => {
        const { sceneKinds } = drive(alone(variant), stopsIn(CURB));
        expect(sceneKinds.has('traffic-stop')).toBe(true);
        expect(sceneKinds.has('checkpoint')).toBe(false);
      }, 60_000);

      it('opens only once the car has pulled over to the curb lane and stopped', () => {
        const run = drive(alone(variant), stopsThenPullsOver());
        expect(run.opened).toHaveLength(1);
        expect(run.opened[0].lane).toBe(CURB);
        expect(run.decision?.settlement).toBe('question');
        expect(run.decision?.correct).toBe(true);
      }, 60_000);

      it('is failed by a driver who stops in their lane and drives on, told what was missed', () => {
        const run = drive(alone(variant), stopsThenDrivesOn());
        expect(run.opened).toEqual([]);
        expect(run.decision?.settlement).toBe('expired');
        expect(run.decision?.correct).toBe(false);
        expect(run.decision?.penaltyMessage).toBe(variant.inspection!.pullOver!.missedMessage);
      }, 60_000);
    });
  }

  it('leaves the roadside check a checkpoint: a stop in the lane the drive is in opens it', () => {
    for (const variant of ROADSIDE_CHECKS) {
      const run = drive(alone(variant), stopsIn(INNER));
      expect(run.sceneKinds.has('checkpoint'), variant.id).toBe(true);
      expect(run.sceneKinds.has('traffic-stop'), variant.id).toBe(false);
      expect(run.opened, variant.id).toHaveLength(1);
      expect(run.opened[0].lane, variant.id).toBe(INNER);
    }
  }, 60_000);
});
