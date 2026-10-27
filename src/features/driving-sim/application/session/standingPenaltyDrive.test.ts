/**
 * Waiting at a stop is not crawling, driven.
 *
 * A stop scenario passes the moment the car stops in its last 120 units, and
 * the verdict used to clear the road with it: from that frame the car was on
 * "clear road", and waiting there for what the scenario is about - the
 * jeepney to pull out, the woman to finish crossing, the junction to clear
 * behind a Stop sign - drew a −5 crawl charge three seconds later. On the
 * final exam that is a borrowed Stop sign costing points against the pass mark
 * for doing exactly what it asks.
 *
 * The road is now clear only once the car has left the scenario's zone. Crawling
 * after that is still charged, after its warning.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { level8, SLOTS as LEVEL8_SLOTS } from '@/features/driving-sim/domain/scenario/content/levels/level8';
import { level11, SLOTS as LEVEL11_SLOTS } from '@/features/driving-sim/domain/scenario/content/levels/level11';
import { level12, SLOTS as LEVEL12_SLOTS } from '@/features/driving-sim/domain/scenario/content/levels/level12';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { CRAWL_SPEED_SHARE } from '@/features/driving-sim/domain/systems/standingPenalties';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

/** Where the scenario stands on its one-event road. */
const AT = 900;

const variant = (slots: SlotVariant[][], id: string): SlotVariant => {
  const found = slots.flat().find(candidate => candidate.id === id);
  if (!found) throw new Error(`no variant ${id}`);
  return found;
};

/** The level's own road, with this scenario on it and nothing else. */
const alone = (level: LevelConfig, scenario: SlotVariant): LevelConfig => ({
  ...level,
  events: [{ ...scenario, triggerAtDistance: AT } as ScenarioEvent],
  roadLength: AT + 2000,
});

interface Drive {
  decision: { id: string; correct: boolean; distance: number } | null;
  /** Each crawl or wrong-side charge, with where the car was and the frame. */
  penalties: Array<{ id: string; distance: number; frame: number }>;
  /** The first frame the crawl banner showed. */
  firstCrawlWarning: number | null;
  /** Where the car was on the last frame. */
  end: number;
}

/**
 * Drives up to the scenario at `approach` km/h, comes to rest a little short of
 * its point, waits `waitFrames`, then drives on at `after` km/h - and, given
 * `standAt`, comes to rest again there, on the road past the zone.
 */
const drive = (
  level: LevelConfig,
  {
    approach,
    waitFrames,
    after,
    standAt = Number.POSITIVE_INFINITY,
    frames = 2400,
  }: { approach: number; waitFrames: number; after: number; standAt?: number; frames?: number }
): Drive => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  const result: Drive = { decision: null, penalties: [], firstCrawlWarning: null, end: 0 };
  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level, fsm, signCoverage: {} });
    let previous: InputState = NO_INPUT;
    let restFrames = 0;
    let waited = false;

    for (let frame = 0; frame < frames; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      if (session.getSnapshot().briefingEvent) session.dismissBriefing();

      const snapshot = session.getSnapshot();
      const distance = session.getFrame()?.scene?.car?.distance ?? 0;
      if (snapshot.crawlWarning && result.firstCrawlWarning === null) result.firstCrawlWarning = frame;
      result.end = distance;
      restFrames = snapshot.speed <= 0.5 ? restFrames + 1 : 0;
      if (restFrames >= waitFrames) waited = true;

      const speed = waited ? (distance < standAt ? after : 0) : distance < AT - 100 ? approach : 0;
      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < speed - 1 && !previous.throttle,
        brake: snapshot.speed > speed + 0.5,
      };
      previous = input;

      const queue: GameEvent[] = [...session.update(input)];
      while (queue.length > 0) {
        const report = queue.shift()!;
        if (report.kind === 'penalty') result.penalties.push({ id: report.event.id, distance, frame });
        if (report.kind !== 'decision') continue;
        const { isCorrect } = evaluateWeightedRule(report.event, report.action, 0);
        result.decision ??= { id: report.event.id, correct: isCorrect, distance };
        fsm.transition(isCorrect ? 'answer_correct' : 'answer_incorrect');
        fsm.transition('feedback_displayed');
        if (!isCorrect) fsm.transition('recovery_complete');
        fsm.transition('road_clear');
        queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
      }
    }
    return result;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

/** Eight seconds at rest, which is more than the crawl's grace and its next interval. */
const WAIT = 8 * 60;

describe.each([
  { name: 'Level 8, the jeepney at the side street', level: level8, scenario: variant(LEVEL8_SLOTS, 'level8.let-them-out') },
  { name: 'Level 11, the crossing at the jeepney stop', level: level11, scenario: variant(LEVEL11_SLOTS, 'level11.crossing-at-the-stop') },
  { name: 'Level 12, a borrowed Stop sign', level: level12, scenario: variant(LEVEL12_SLOTS, 'level3.priority-stop.stop-sign') },
])('$name', ({ level, scenario }) => {
  const road = alone(level, scenario);
  const crawl = level.speedLimit * CRAWL_SPEED_SHARE;

  it('passes the stop early, and charges nothing for waiting there', () => {
    const run = drive(road, { approach: crawl + 8, waitFrames: WAIT, after: level.speedLimit * 0.75 });
    expect(run.decision).toMatchObject({ id: scenario.id, correct: true });
    // The verdict landed with the car at rest short of the point...
    expect(run.decision!.distance).toBeLessThan(AT);
    // ...and the wait that followed cost nothing.
    expect(run.penalties).toEqual([]);
  });

  it('still charges standing on the road past the zone, after its warning', () => {
    const run = drive(road, { approach: crawl + 8, waitFrames: 30, after: level.speedLimit * 0.75, standAt: AT + 300, frames: 60 * 40 });
    expect(run.decision).toMatchObject({ id: scenario.id, correct: true });
    expect(run.penalties.length).toBeGreaterThan(0);
    const first = run.penalties[0];
    expect(first.distance).toBeGreaterThan(AT + 200);
    expect(run.firstCrawlWarning).not.toBeNull();
    expect(first.frame - run.firstCrawlWarning!).toBeGreaterThanOrEqual(80);
  });
});
