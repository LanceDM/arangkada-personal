/**
 * A bay is graded to its far end, and ends where it is graded.
 *
 * A roadside bay opened the curb line 90 either side of its point
 * (`driveVehicle`), but its zone closed 20 past the point, as every plain
 * event's does. A driver who pulled into the far half of Level 10's turnout
 * and stopped there was failed at 1820 while still rolling into it, and a
 * stop in the far half of Level 6's red curb was never seen.
 *
 * It is graded to `BAY_RUN_ON`, 60 past the point: as far as the road is kept
 * clear after its zone, because `thetaGrading.test.ts` holds that no theta
 * may open the next approach inside it. And the bay now ends there, so there
 * is no stretch of it where a car can come to rest unread. The approach half
 * keeps its 90. The zone the approach and the simulation read stays
 * `actionZoneFor`'s.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { actionZoneFor, gradedExitFor } from '@/features/driving-sim/domain/systems/eventScheduler';
import {
  ACTION_ZONE_EXIT,
  BAY_RUN_ON,
  BAY_SPAN,
  ROAD_CENTRE_X,
  WARNING_ZONE_MARGIN,
  bayOpenAt,
  isInBay,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

/** The scenario on its own level's road, alone on it, so nothing before it decides how it is reached. */
const byId = (id: string) => {
  const own = LEVELS.find(entry => entry.events.some(event => event.id === id))!;
  const event = own.events.find(entry => entry.id === id)! as ScenarioEvent;
  return { level: { ...own, events: [event] }, event };
};

/**
 * Drives up to a bay on its own level's road, pulls into it and comes to rest `stopPast` beyond its
 * point, waits there `waitFrames`, then pulls out and drives on. Reports the
 * bay's verdict, where the car came to rest, whether it was in the bay then,
 * and the standing penalties charged while it waited.
 */
const stopInBay = (id: string, stopPast: number, waitFrames = 300) => {
  const { level, event } = byId(id);
  const point = event.triggerAtDistance;
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level, fsm, signCoverage: {} });
    let previous: InputState = NO_INPUT;
    let verdict: { action: string; correct: boolean } | undefined;
    let restedAt: number | null = null;
    let restedInBay = false;
    let waited = 0;
    let penaltiesWhileWaiting = 0;

    // The host's half of a decision, as `useScenarioEvaluation` does it.
    const take = (reported: readonly GameEvent[], resting: boolean) => {
      const queue: GameEvent[] = [...reported];
      while (queue.length > 0) {
        const next = queue.shift()!;
        if (next.kind === 'penalty' && resting) penaltiesWhileWaiting += 1;
        if (next.kind !== 'decision') continue;
        const { isCorrect } = evaluateWeightedRule(next.event, next.action, 0);
        if (next.event.id === id) verdict = { action: next.action, correct: isCorrect };
        fsm.transition(isCorrect ? 'answer_correct' : 'answer_incorrect');
        fsm.transition('feedback_displayed');
        if (!isCorrect) fsm.transition('recovery_complete');
        fsm.transition('road_clear');
        queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
      }
    };

    for (let frame = 0; frame < 30_000; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      if (session.getSnapshot().briefingEvent) take(session.dismissBriefing(), false);
      const frozen = session.getSnapshot().cutsceneEvent;
      if (frozen) {
        take(session.answerCutscene(frozen.correctAction), false);
        continue;
      }
      const snapshot = session.getSnapshot();
      const car = session.getFrame()?.scene?.car;
      const distance = car?.distance ?? 0;
      const stopAt = point + stopPast;
      const resting = restedAt !== null && waited < waitFrames;
      const leaving = restedAt !== null && waited >= waitFrames;

      // Slow for the bay well before it, ease to rest at `stopAt`, then on.
      const want =
        leaving ? 30
        : distance < point - 400 ? level.speedLimit * 0.6
        : Math.max(0, Math.min(14, (stopAt - distance) * 0.25));
      const input: InputState = {
        ...NO_INPUT,
        throttle: !resting && snapshot.targetSpeed < want - 1 && !previous.throttle,
        brake: snapshot.speed > want + 0.5,
        right: !leaving && distance > point - BAY_SPAN + 10,
        left: leaving && car !== undefined && isInBay(car.x, ROAD_CENTRE_X, event.bay!.side),
      };
      previous = input;

      take(session.update(input), resting);

      if (car && restedAt === null && snapshot.speed <= 0.5 && distance > point - BAY_SPAN) {
        restedAt = distance;
        restedInBay = isInBay(car.x, ROAD_CENTRE_X, event.bay!.side);
      }
      if (resting) waited += 1;
      if (distance > point + 400) break;
    }
    return { verdict, restedAt, restedInBay, penaltiesWhileWaiting };
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

describe('a bay graded over the stretch it is driven on', () => {
  it('passes a stop in the far half of Level 10’s turnout, and charges nothing for waiting there', () => {
    const run = stopInBay('level10.out-of-her-seat', 55);
    expect(run.restedInBay).toBe(true);
    expect(run.restedAt! - byId('level10.out-of-her-seat').event.triggerAtDistance).toBeGreaterThan(ACTION_ZONE_EXIT);
    expect(run.verdict?.correct).toBe(true);
    expect(run.penaltiesWhileWaiting).toBe(0);
  });

  it('still passes a stop in the near half of it, as far back as it always did', () => {
    // A driven pass at 1734, 66 short of the point.
    for (const aim of [-20, -62]) {
      const run = stopInBay('level10.out-of-her-seat', aim);
      expect(run.restedInBay, `aim ${aim}`).toBe(true);
      expect(run.verdict?.correct, `aim ${aim}`).toBe(true);
    }
  });

  it('leaves nowhere in the bay a car can come to rest unread', () => {
    // Aimed at every point past the middle of the far half: the car either
    // cannot be off the road there, or is graded for it.
    const unread: string[] = [];
    for (const id of ['level10.out-of-her-seat', 'level9.tire-blowout', 'level6.red-curb-no-parking']) {
      const passesWhenStopped = byId(id).event.bay!.mayStop;
      for (let aim = 44; aim <= 96; aim += 4) {
        const run = stopInBay(id, aim);
        if (run.restedInBay && run.verdict?.correct !== passesWhenStopped) {
          unread.push(`${id}: rested in the bay at +${(run.restedAt! - byId(id).event.triggerAtDistance).toFixed(0)}, graded ${run.verdict?.action}`);
        }
      }
    }
    expect(unread).toEqual([]);
  });

  it('passes a stop in the far half of Level 9’s emergency bay', () => {
    const run = stopInBay('level9.tire-blowout', 55);
    expect(run.restedInBay).toBe(true);
    expect(run.verdict?.correct).toBe(true);
  });

  it('fails a stop in the far half of Level 6’s red curb, which the zone never saw', () => {
    const run = stopInBay('level6.red-curb-no-parking', 55);
    expect(run.restedInBay).toBe(true);
    expect(run.verdict?.correct).toBe(false);
  });

  it('grades to the bay’s far end, which is no further than the road kept clear after the zone', () => {
    expect(BAY_RUN_ON).toBeLessThanOrEqual(ACTION_ZONE_EXIT + WARNING_ZONE_MARGIN);
    expect(bayOpenAt(BAY_RUN_ON)).toBe(0);
    expect(bayOpenAt(-BAY_SPAN)).toBe(0);
    expect(bayOpenAt(0)).toBe(1);
    for (const id of ['level10.out-of-her-seat', 'level9.tire-blowout', 'level6.red-curb-no-parking']) {
      const { event } = byId(id);
      const zone = actionZoneFor({ isCheckpoint: false, isParking: false, isTutorial: false, warningDistance: event.warningDistance });
      expect(gradedExitFor(event, zone), id).toBe(BAY_RUN_ON);
    }
    // Every other event, a parking cutscene's bay included, closes where it did.
    for (const level of LEVELS) {
      for (const event of level.events.filter(other => !other.bay || other.parkingCutscene)) {
        const zone = { enter: 0, exit: 37 };
        expect(gradedExitFor(event, zone), event.id).toBe(37);
      }
    }
  });

  it('leaves the zone the approach and the simulation read as it was', () => {
    for (const id of ['level10.out-of-her-seat', 'level9.tire-blowout', 'level6.red-curb-no-parking']) {
      const { event } = byId(id);
      expect(
        actionZoneFor({ isCheckpoint: false, isParking: false, isTutorial: false, warningDistance: event.warningDistance }).exit,
        id
      ).toBe(ACTION_ZONE_EXIT);
    }
  });
});
