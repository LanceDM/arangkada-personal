/**
 * Reproducible drives, for pinning what a frame does.
 *
 * A drive is a level, a seed and a frame count. The input for each frame comes
 * from the seed, so the same sample always presses the same keys at the same
 * moments; decisions are settled by a rule rather than by a person, so a run
 * never depends on judgement. Nothing here is random at run time.
 *
 * A drive is recorded at h = full, the baseline machine. The support level only
 * decides what the road marks, so the same sample at another h is the
 * same drive with fewer things drawn; the golden test holds exactly that.
 *
 * Shared by `scripts/captureDriveGolden.ts` and `DrivingSession.golden.test.ts`
 * so the recording and the assertion cannot drift.
 */
import type { SupportLevel } from '@/domain/learner/competency';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import type { FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

/** The states the `answer_correct` / `answer_incorrect` edges leave. */
const GRADEABLE: readonly FSMState[] = ['REACTION_WINDOW', 'INTERSECTION', 'HAZARD', 'DECISION'];

/** The clock every sample starts from, so timed branches land identically. */
export const DRIVE_EPOCH = 1_760_000_000_000;

/** One frame at 60Hz, in milliseconds. */
export const FRAME_MS = 1000 / 60;

/**
 * How the driver behaves for a sample.
 *
 * `wander` covers the ordinary road. The rest exist because some branches are
 * unreachable by any amount of clumsy driving: a curb only pushes back at a
 * car already pinned against it, and a turn only commits to a driver who
 * arrives at the junction already in the turning lane and presses the arrow.
 */
export type DriveStyle =
  | 'wander'
  | 'hold-left'
  | 'hold-right'
  | 'turn-left'
  | 'turn-right'
  /**
   * A drive that actually gets to the end of a level: throttle held, the wheel
   * worked steadily across the road, and long enough to finish.
   *
   * The wandering samples brake as often as they accelerate, so in 1,200 frames
   * they cover a few hundred units and record an opening. One sample that
   * reaches every scenario of a level is what proves the recorded drive is a
   * drive rather than a start.
   */
  | 'commute';

export interface DriveSample {
  levelId: number;
  seed: number;
  frames: number;
  style: DriveStyle;
  /** Road distance to start from, for samples aimed at one event. */
  initialDistance?: number;
}

/** How far before an event a sample starts, so the approach itself is driven. */
const APPROACH_RUNWAY = 420;

/**
 * Events that only happen to a driver who goes looking for them: a committed
 * turn, a roundabout, a parking manoeuvre, a checkpoint.
 */
const targetedEvents = (level: LevelConfig) =>
  level.events.filter(
    event =>
      event.maneuver ||
      event.parkingCutscene ||
      event.cutscene ||
      event.inspection ||
      event.scene === 'roundabout'
  );

/**
 * Every level three ways from different seeds, pinned hard against each curb,
 * and once per event that needs to be driven at deliberately.
 *
 * Three wandering seeds rather than one because a pooled level rolls fresh
 * content per attempt, and a single seed would only ever pin one roll.
 */
export const driveSamples = (): DriveSample[] =>
  LEVELS.flatMap(level => [
    { levelId: level.id, seed: 1, frames: 1200, style: 'wander' as const },
    { levelId: level.id, seed: 2, frames: 1200, style: 'wander' as const },
    { levelId: level.id, seed: 3, frames: 1200, style: 'wander' as const },
    // Long enough for the left-hand hold to reach Level 2's second scenario,
    // which it grades on frame 951: every other sample of that level runs into
    // the pedestrian at its first, so this is the one that carries the level
    // past its opening.
    { levelId: level.id, seed: 4, frames: 1000, style: 'hold-left' as const },
    { levelId: level.id, seed: 5, frames: 1000, style: 'hold-right' as const },
    // One drive per level that is long enough to reach the end of it. Sized
    // for the slowest road in the game: Level 7 declares a pace of 0.03, so a
    // two-tap 66 km/h covers two units of route a frame, and its 12,980 need
    // six and a half thousand of them before the holds each scenario takes to
    // be read are counted.
    { levelId: level.id, seed: 6, frames: 8000, style: 'commute' as const },
    ...targetedEvents(level).map((event, index) => ({
      levelId: level.id,
      seed: 10 + index,
      frames: 420,
      style: (event.maneuver?.direction === 'left' ? 'turn-left' : 'turn-right') as DriveStyle,
      initialDistance: Math.max(0, event.triggerAtDistance - APPROACH_RUNWAY),
    })),
  ]);

/** xorshift32: small, deterministic, and identical on every platform. */
const rng = (seed: number) => {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000) / 1000;
  };
};

/**
 * What the driver does on each frame.
 *
 * Deliberately clumsy, and deliberately *steering while driving*: the pedals
 * and the wheel are rolled separately, so a run holds a direction long enough
 * to pin the car against a closing curb and to arrive at a junction already in
 * a turning lane. A driver who only ever did one thing at a time never reached
 * either branch.
 */
const inputSequence = (sample: DriveSample): InputState[] => {
  const { seed, frames, style } = sample;
  const next = rng(seed);
  const inputs: InputState[] = [];

  if (style === 'commute') {
    for (let frame = 0; frame < frames; frame++) {
      // Two taps of the throttle and then nothing: the setting holds, so the
      // car drives the whole level at a steady, unremarkable speed and never
      // leaves the lane it started in.
      //
      // Deliberately dull. A drive that swerves and brakes is a drive that
      // crashes into the first thing the level puts in front of it, and what
      // this sample is for is reaching the *end* — every scenario offered, every
      // verdict recorded, whatever it makes of them.
      inputs.push({ ...NO_INPUT, throttle: frame === 0 || frame === 4 } as InputState);
    }
    return inputs;
  }

  if (style !== 'wander') {
    const steer = style === 'hold-left' || style === 'turn-left' ? 'left' : 'right';
    for (let frame = 0; frame < frames; frame++) {
      // Get the car up to speed first, then hold the wheel over: a turn is
      // refused from the wrong lane, so the approach has to be driven into
      // position before the arrow means anything.
      inputs.push({
        ...NO_INPUT,
        throttle: frame < 40 || frame % 30 === 0,
        [steer]: frame >= 20,
      } as InputState);
    }
    return inputs;
  }

  let held: InputState = { ...NO_INPUT, throttle: true };
  for (let frame = 0; frame < frames; frame++) {
    // Re-decide every eighth frame, so each choice is held for a while.
    if (frame % 8 === 0) {
      const pedal = next();
      const wheel = next();
      const horn = next();
      held = {
        throttle: pedal < 0.6,
        brake: pedal >= 0.6 && pedal < 0.78,
        left: wheel < 0.3,
        right: wheel >= 0.3 && wheel < 0.6,
        horn: horn >= 0.95,
      };
    }
    inputs.push(held);
  }
  return inputs;
};

/** One frame's worth of world state, rounded so floating-point noise cannot fail a run. */
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface DriveTrace {
  /** One line per frame, plus a line per reported event. */
  lines: string[];
  digest: string;
}

/** FNV-1a over the trace: stable across runs and platforms. */
const digestOf = (lines: string[]): string => {
  let hash = 0x811c9dc5;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      hash ^= line.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const describeEvent = (event: GameEvent): string => {
  switch (event.kind) {
    case 'decision':
      return `decision ${event.event.id} ${event.action}`;
    case 'penalty':
      return `penalty ${event.event.id} ${event.action}`;
    case 'rerolled':
      return `rerolled ${event.competency}`;
    case 'crashed':
      return 'crashed';
    case 'finished':
      return 'finished';
    case 'jolt':
      return 'jolt';
  }
};

/**
 * Runs one sample and records what the world did.
 *
 * The clock is driven by the frame counter rather than read from the machine,
 * so every timed branch — correction holds, penalty intervals, manoeuvre
 * progress, the crash hold — lands on the same frame every time.
 */
export const runDrive = (sample: DriveSample, support: SupportLevel = 'full'): DriveTrace => {
  const level = LEVELS.find(entry => entry.id === sample.levelId)!;
  const inputs = inputSequence(sample);
  const lines: string[] = [];

  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = DRIVE_EPOCH;
  performance.now = () => clock;
  Date.now = () => clock;
  // A drive is not reproducible on its own: rough ground throws the car to a
  // side chosen by `Math.random`, and the roadside scenery is scattered the
  // same way. Seeding it is what makes a recorded drive a fact rather than a
  // sample of one.
  Math.random = rng(sample.seed * 7919 + 13);

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({
      level,
      fsm,
      signCoverage: {},
      initialDistance: sample.initialDistance,
      support,
    });
    let correct = true;

    /**
     * The host's half of a graded decision.
     *
     * `useScenarioEvaluation` fires these once it has scored; without them the
     * machine never leaves the state the event was graded in, and no later
     * event can open an approach. A harness that omitted them recorded the
     * first scenario of a level and nothing after it — which made the golden
     * look like it covered a drive when it covered an opening.
     */
    const settleFsm = (isCorrect: boolean) => {
      if (!GRADEABLE.includes(fsm.getState())) return;
      fsm.transition(isCorrect ? 'answer_correct' : 'answer_incorrect');
      fsm.transition('feedback_displayed');
      if (!isCorrect) fsm.transition('recovery_complete');
      fsm.transition('road_clear');
    };

    for (let frame = 0; frame < sample.frames; frame++) {
      clock = DRIVE_EPOCH + frame * FRAME_MS;

      const queue: GameEvent[] = [...session.update(inputs[frame])];
      while (queue.length > 0) {
        const event = queue.shift()!;
        lines.push(`${frame} ${describeEvent(event)}`);
        if (event.kind === 'decision') {
          // Alternating verdicts, so both the correct and the mistaken paths —
          // and the re-roll a mistake can trigger — are exercised.
          correct = !correct;
          settleFsm(correct);
          queue.push(...session.settleDecision({ isCorrect: correct, weakCompetency: null }));
        }
      }

      // A frozen decision waits for an answer; left unanswered the drive stops
      // dead and the rest of the sample records the same held frame. The read
      // phase and the adaptation notice are the same shape - the drive is held
      // until acknowledged - so the recorded driver acknowledges them the frame
      // they open, which is the fastest a player could.
      const waiting = session.getSnapshot();
      if (waiting.adaptationNotice) session.dismissAdaptationNotice();
      if (waiting.briefingEvent) session.dismissBriefing();
      if (waiting.inspectionEvent) {
        for (const event of session.answerInspection(waiting.inspectionEvent.choices?.[0]?.action ?? 'stop')) {
          lines.push(`${frame} ${describeEvent(event)}`);
          if (event.kind === 'decision') {
            settleFsm(true);
            session.settleDecision({ isCorrect: true, weakCompetency: null });
          }
        }
      } else if (waiting.cutsceneEvent) {
        for (const event of session.answerCutscene(waiting.cutsceneEvent.choices?.[0]?.action ?? 'stop')) {
          lines.push(`${frame} ${describeEvent(event)}`);
          if (event.kind === 'decision') {
            settleFsm(true);
            session.settleDecision({ isCorrect: true, weakCompetency: null });
          }
        }
      }

      const snapshot = session.getSnapshot();
      const frameState = session.getFrame();
      const car = frameState?.scene.car;
      lines.push(
        [
          frame,
          round(snapshot.speed),
          round(snapshot.progress),
          snapshot.lane,
          // The car's own pose, not just which lane it counts as: a change of
          // a few pixels a frame never crosses a lane boundary, and that is
          // exactly the kind of drift a digest has to see.
          car ? round(car.x) : -1,
          car ? round(car.y) : -1,
          car ? round(car.heading) : -1,
          car ? round(car.distance) : -1,
          snapshot.activeEvent?.id ?? '-',
          snapshot.eventPhase ?? '-',
          round(snapshot.eventApproach),
          snapshot.crashed ? 'crashed' : '-',
          snapshot.holdingForCorrection ? 'held' : '-',
          snapshot.crawlWarning ? 'crawl' : '-',
          snapshot.wrongSideWarning ? 'wrong-side' : '-',
          frameState ? frameState.scene.nodes.length : -1,
          frameState ? frameState.scene.colliders.length : -1,
          frameState ? round(frameState.flash) : -1,
          frameState ? round(frameState.veil) : -1,
          frameState ? round(frameState.scene.roadOffset) : -1,
        ].join(' ')
      );
    }

    return { lines, digest: digestOf(lines) };
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};
