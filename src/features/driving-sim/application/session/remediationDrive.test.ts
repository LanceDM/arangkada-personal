/**
 * Level 7's following-distance scenario, driven where the game appends it.
 *
 * It is the one Level 7 variant still offered as practice. Its lead
 * vehicle's speed is a share of the host's limit and its gap is measured in
 * seconds, so the rule it grades is the same rule on any road. This
 * appends it to every level that can be handed it, exactly as
 * `buildLevelConfig` does, arrives at the host's own limit, and holds it to both
 * halves: a driver who eases off passes, and one who sits inside the gap fails
 * for the gap rather than for an impact.
 *
 * Everything before the practice item is passed, as in `thetaDrives.ts`, and
 * checked to bound it exactly as the level does.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { buildLevelConfig } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { laneCentreX, resolveLaneRole } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { DrivingSnapshot } from './DrivingSnapshot';
import { limitsOf, passed } from './thetaDrives';

const VAN = 'level7.following-distance-lead-van';

/** Every level the selector may append it to: at or after Level 7, and not the exam, which never adapts. */
const HOSTS = [8, 9, 10, 11];

const appendedTo = (host: number): { level: LevelConfig; event: ScenarioEvent } => {
  const candidate = remediationCandidates('hazard_awareness', host).find(({ variant }) => variant.id === VAN)!;
  const level = buildLevelConfig(host, undefined, null, undefined, {
    ...candidate.variant,
    remediation: true,
    remediationSourceLevelId: candidate.levelId,
  })!;
  return { level, event: level.events.find(event => event.id === VAN)! };
};

/** The speed to hold, in km/h, from where the car is and what the gap cue says. */
type Plan = (at: { diff: number; limit: number; snapshot: DrivingSnapshot }) => number;

/** Slows to well under the van's own speed as its approach opens. */
const easesOff: Plan = ({ diff, limit }) => (diff >= -1400 ? limit * 0.4 : limit);

/** Closes to about a second behind the van and sits there. */
const tailgates: Plan = ({ limit, snapshot }) =>
  snapshot.gapCue && snapshot.gapCue.seconds < 1.2 ? limit * 0.45 : limit;

/**
 * Drives the host from its start, in the van's lane at the host's limit, until
 * the practice item is decided. The clock is the frame counter.
 */
const drive = (level: LevelConfig, event: ScenarioEvent, plan: Plan) => {
  const driven: LevelConfig = {
    ...level,
    events: level.events.map(other => (other.triggerAtDistance < event.triggerAtDistance ? passed(other) : other)),
  };
  const target = driven.events.find(other => other.id === event.id)!;
  expect(limitsOf(driven, target)).toEqual(limitsOf(level, event));

  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  const result = { action: 'none', correct: false, crashed: false };
  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: driven, fsm, signCoverage: {} });
    const lane = resolveLaneRole(event.npc!.lane!, level.paint?.oncomingLanes ?? 0);
    let previous: InputState = NO_INPUT;

    for (let frame = 0; frame < 12000 && result.action === 'none' && !result.crashed; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      if (session.getSnapshot().briefingEvent) session.dismissBriefing();

      const snapshot = session.getSnapshot();
      const scene = session.getFrame()?.scene;
      const car = scene?.car;
      const want = plan({ diff: (car?.distance ?? 0) - event.triggerAtDistance, limit: level.speedLimit, snapshot });
      const wantX = scene && car ? laneCentreX(lane, scene.roadAt(car.y)) : 0;
      const carX = car?.x ?? wantX;

      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < want - 1 && !previous.throttle,
        brake: snapshot.speed > want + 2,
        left: carX > wantX + 2,
        right: carX < wantX - 2,
      };
      previous = input;

      const queue: GameEvent[] = [...session.update(input)];
      while (queue.length > 0) {
        const report = queue.shift()!;
        if (report.kind === 'crashed') result.crashed = true;
        if (report.kind !== 'decision') continue;
        // Only the practice item's verdict is the one under test; the passed
        // scenarios before it are settled as answered.
        const ours = report.event.id === event.id;
        const { isCorrect } = evaluateWeightedRule(report.event, report.action, 0);
        if (ours) {
          result.action = report.action;
          result.correct = isCorrect;
        }
        const settled = ours ? isCorrect : true;
        fsm.transition(settled ? 'answer_correct' : 'answer_incorrect');
        fsm.transition('feedback_displayed');
        if (!settled) fsm.transition('recovery_complete');
        fsm.transition('road_clear');
        queue.push(...session.settleDecision({ isCorrect: settled, weakCompetency: null }));
      }
    }
    return result;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

describe("Level 7's following-distance scenario, appended as practice", () => {
  it('is offered to every level it is driven on here', () => {
    for (const host of HOSTS) {
      expect(remediationCandidates('hazard_awareness', host).map(({ variant }) => variant.id)).toContain(VAN);
    }
  });

  for (const host of HOSTS) {
    describe(`on Level ${host}`, () => {
      it('is passed by a driver who eases off for the van', () => {
        const { level, event } = appendedTo(host);
        const result = drive(level, event, easesOff);
        expect(result.crashed).toBe(false);
        expect(result.correct).toBe(true);
        expect(result.action).toBe('brake');
      });

      it('is failed, for the gap, by a driver who sits inside it', () => {
        const { level, event } = appendedTo(host);
        const result = drive(level, event, tailgates);
        expect(result.crashed, 'ran into the van rather than being graded on the gap').toBe(false);
        expect(result.correct).toBe(false);
        expect(result.action).toBe('too_close');
      });
    });
  }
});
