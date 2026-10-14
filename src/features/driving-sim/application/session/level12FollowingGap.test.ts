/**
 * The final exam's following gaps, driven after the pull-over before them.
 *
 * Slot 5 is a traffic stop: the car is graded on pulling over to the curb lane
 * and stopping. Slot 6 rolls a hazard from Levels 7 to
 * 11, and seven of its twelve variants grade the gap kept to a vehicle "ahead
 * of you in your lane". Until that was fixed, six of those vehicles
 * were fixed to the inner lane and the seventh, Level 8's truck, joined
 * whichever lane the car was in while it was still pulling over. So a driver
 * who had just done what slot 5 asked drove on in the curb lane beside the
 * vehicle, and the gap measured along the road fell to 0 seconds as the car
 * drew level with it.
 *
 * Each variant is driven on Level 12's own road, behind a ticket-issued stop at
 * slot 5's distance, by a driver who moves over only once every one of those
 * vehicles would already have joined the road.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { assembleLevel12, SLOTS, SLOT_DISTANCES } from '@/features/driving-sim/domain/scenario/content/levels/level12';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { laneCentreX, laneOf, roadXAt, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

const INNER = 2 as LaneIndex;
const CURB = 3 as LaneIndex;

const STOP_AT = SLOT_DISTANCES[4];
const HAZARD_AT = SLOT_DISTANCES[5];

/** The ticket-issued stop, and every following gap the hazard slot can roll. */
const TRAFFIC_STOP = SLOTS[4][0];
const FOLLOWING = SLOTS[5].filter(variant => variant.following !== undefined);

/**
 * Past where the earliest of them joins the road (Level 7's van, 1,000 units
 * out) and the latest (the riders, 620), so a driver still in the inner lane
 * here is in it when each one would have joined.
 */
const MOVES_OVER_AT = HAZARD_AT - 620 - 120;

/**
 * Open, recorded rather than fixed: slot 6 always follows a stop, so the car
 * starts it from rest, and these two keep too far ahead to be closed on inside
 * their zone. Driven at the limit until the gap readout shows 1.2 seconds,
 * the closest is 2.5 seconds to the van and 3.1 to the truck. Each still fails
 * a driver who closes up on it on its own level.
 */
const FROM_REST_OUT_OF_REACH = new Set(['level7.following-distance-lead-van', 'level8.two-seconds']);

const examRoad = (variant: SlotVariant): { level: LevelConfig; event: ScenarioEvent } => {
  const stop = { ...TRAFFIC_STOP, triggerAtDistance: STOP_AT } as ScenarioEvent;
  const event = { ...variant, triggerAtDistance: HAZARD_AT } as ScenarioEvent;
  return { level: { ...assembleLevel12([stop, event]), roadLength: HAZARD_AT + 900 }, event };
};

interface View {
  distance: number;
  /** The stop at slot 5 has been answered. */
  stopped: boolean;
  /** The gap readout, in seconds, while it is shown. */
  gap: number | null;
}

type Plan = (view: View) => { lane: LaneIndex; speed: number };

/** Holds the inner lane, pulls over late and stops, then drives on in the curb lane at `after`. */
const pullsOverLate = (after: (view: View) => number): Plan => view => {
  const { distance, stopped } = view;
  if (stopped) return { lane: CURB, speed: after(view) };
  if (distance < MOVES_OVER_AT) return { lane: INNER, speed: 20 };
  return { lane: CURB, speed: distance < STOP_AT - 20 ? 8 : 0 };
};

interface Run {
  /** The car's lane, and the scenario's vehicle's, on the frame the hazard was frozen to be read. */
  read: { carLane: LaneIndex; vehicleLane: LaneIndex | null } | null;
  /** The traffic stop's panel opened, in the curb lane. */
  pulledOver: boolean;
  verdict: { action: string; correct: boolean; rewardMessage: string } | null;
  crashed: boolean;
}

const drive = (level: LevelConfig, event: ScenarioEvent, plan: Plan): Run => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  const run: Run = { read: null, pulledOver: false, verdict: null, crashed: false };
  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level, fsm, signCoverage: {}, initialDistance: STOP_AT - 500 });
    let previous: InputState = NO_INPUT;
    let stopped = false;

    const take = (reported: readonly GameEvent[]) => {
      const queue = [...reported];
      while (queue.length > 0) {
        const report = queue.shift()!;
        if (report.kind === 'crashed') run.crashed = true;
        if (report.kind !== 'decision') continue;
        const { isCorrect } = evaluateWeightedRule(report.event, report.action, 0);
        if (report.event.id === event.id) {
          run.verdict = { action: report.action, correct: isCorrect, rewardMessage: report.event.rewardMessage };
        } else {
          stopped = true;
        }
        fsm.transition(isCorrect ? 'answer_correct' : 'answer_incorrect');
        fsm.transition('feedback_displayed');
        if (!isCorrect) fsm.transition('recovery_complete');
        fsm.transition('road_clear');
        queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
      }
    };

    for (let frame = 0; frame < 12_000 && !run.verdict && !run.crashed; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      const snapshot = session.getSnapshot();
      const scene = session.getFrame()?.scene;
      const car = scene?.car;
      const distance = car?.distance ?? STOP_AT - 500;
      const roadX = roadXAt(distance, scene?.curves ?? []);

      const document = snapshot.inspectionEvent;
      if (document) {
        run.pulledOver = snapshot.lane === CURB;
        take(session.answerInspection(document.correctAction));
        continue;
      }

      if (snapshot.briefingEvent) {
        if (snapshot.briefingEvent.id === event.id && !run.read) {
          const vehicle = scene?.nodes.find(
            (node): node is Extract<SceneNode, { kind: 'scripted-vehicle' }> =>
              node.kind === 'scripted-vehicle' && node.npc === event.npc
          );
          run.read = {
            carLane: snapshot.lane as LaneIndex,
            vehicleLane: vehicle?.at.active ? laneOf(vehicle.at.x, roadX) : null,
          };
        }
        session.dismissBriefing();
      }

      const want = plan({ distance, stopped, gap: snapshot.gapCue?.seconds ?? null });
      const target = laneCentreX(want.lane, roadX);
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
    return run;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

describe("the final exam's following gaps, after the pull-over", () => {
  it('are the seven gap-graded variants of the hazard slot', () => {
    expect(FOLLOWING.map(variant => variant.id).sort()).toEqual([
      'level10.smoke-in-the-lane',
      'level11.delivery-box',
      'level11.flashing-tail-lamp',
      'level11.no-helmet',
      'level11.overloaded-jeepney',
      'level7.following-distance-lead-van',
      'level8.two-seconds',
    ]);
  });

  for (const variant of FOLLOWING) {
    describe(variant.id, () => {
      const { level, event } = examRoad(variant);

      it('is in the curb lane with the car when it is read, and kept back from, it passes', () => {
        const run = drive(level, event, pullsOverLate(() => 20));
        expect(run.pulledOver).toBe(true);
        expect(run.read).toEqual({ carLane: CURB, vehicleLane: CURB });
        expect(run.crashed).toBe(false);
        expect(run.verdict?.correct).toBe(true);
        expect(run.verdict?.rewardMessage).toMatch(/closest gap to the vehicle ahead/);
      }, 60_000);

      // A driver who sits on a second's gap, at the limit until they have it.
      const closesUp = pullsOverLate(({ gap }) => (gap === null || gap > 1.2 ? 60 : 8));

      if (FROM_REST_OUT_OF_REACH.has(variant.id)) {
        it('is measured in the curb lane, but cannot be closed on from rest in its zone (open)', () => {
          const run = drive(level, event, closesUp);
          expect(run.read).toEqual({ carLane: CURB, vehicleLane: CURB });
          expect(run.verdict?.correct).toBe(true);
          expect(run.verdict?.rewardMessage).toMatch(/closest gap to the vehicle ahead/);
        }, 60_000);
      } else {
        it('is failed by a driver who closes up on it there', () => {
          const run = drive(level, event, closesUp);
          expect(run.read).toEqual({ carLane: CURB, vehicleLane: CURB });
          expect(run.verdict?.action).toBe('too_close');
        }, 60_000);
      }
    });
  }
});
