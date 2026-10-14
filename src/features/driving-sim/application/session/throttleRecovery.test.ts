/**
 * The jammed accelerator, driven with the controls the panel actually names.
 *
 * Reported from a playtest as "the car suddenly accelerates and I cannot tell
 * whether that is a bug", and every part of that reproduced here before it was
 * fixed. Four faults, each with an assertion below:
 *
 * - The failure arrived 320 units *after* the panel that explained it, because
 *   the effect was a distance band and the panel waits on the machine.
 * - A driver reacting at a normal human one second hit the vehicle ahead at
 *   76 km/h. So did 1.5 and 2.0 seconds. The window was under a second.
 * - The instruction said "shift to neutral", which is not a control this car
 *   has, and the pedal that does work went unnamed.
 * - Nothing on screen said a failure had happened at all.
 *
 * And one that only showed up once the rest were fixed: holding the brake, as
 * instructed, left the car at a standstill against a throttle that never let
 * go, so the run stalled and the event never graded.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { scenarioInstruction } from '@/features/driving-sim/domain/scenario/scenarioCopy';

const level9 = LEVELS.find(level => level.id === 9)!;
const jam = level9.events.find(event => event.id === 'level9.throttle-sticks-open')!;

/** Frames per second the drive runs at, for turning a reaction into frames. */
const FPS = 60;

interface Run {
  crashed: boolean;
  graded: { action: string; correct: boolean } | null;
  /** Every distinct state the live readout passed through, in order. */
  cues: string[];
  /** True if the readout ever said the engine was back under control. */
  recovered: boolean;
  /** The car was still moving when the window closed. */
  finishedMoving: boolean;
  peak: number;
}

/**
 * Drives the route, reading the panel and then holding the brake after a
 * human-sized pause — which is all the game ever asks of the player here.
 *
 * `holdForever` models the literal instruction taken literally: the brake goes
 * down and never comes up. That has to end somewhere other than a stalled run.
 */
const drive = (reactionSeconds: number, { holdForever = false } = {}): Run => {
  const realNow = performance.now;
  const realDate = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: level9, fsm, signCoverage: {} });
    const settleFsm = (correct: boolean) => {
      fsm.transition(correct ? 'answer_correct' : 'answer_incorrect');
      fsm.transition('feedback_displayed');
      if (!correct) fsm.transition('recovery_complete');
      fsm.transition('road_clear');
    };

    const run: Run = {
      crashed: false,
      graded: null,
      cues: [],
      recovered: false,
      finishedMoving: false,
      peak: 0,
    };
    let previous: InputState = NO_INPUT;
    let readAt = -1;
    const reactionFrames = Math.round(reactionSeconds * FPS);

    for (let frame = 0; frame < 12_000; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / FPS);
      const held = session.getSnapshot().briefingEvent;
      if (held) {
        if (held.id === jam.id) readAt = frame;
        session.dismissBriefing();
      }

      const snapshot = session.getSnapshot();
      const distance = session.getFrame()?.scene?.car?.distance ?? 0;
      const cue = snapshot.throttleCue;
      if (cue) {
        const tag = `${cue.phase}${cue.dropping ? '/dropping' : ''}`;
        if (run.cues[run.cues.length - 1] !== tag) run.cues.push(tag);
        if (cue.phase === 'freed') run.recovered = true;
        run.peak = Math.max(run.peak, snapshot.speed);
      }

      // A competent driver everywhere else on the route, so the run reaches the
      // jam in the state a real one would.
      const cruise = distance < 820 ? 22 : distance < 1150 ? 48 : distance < 1700 ? 20 : 48;
      const reacting = readAt >= 0 && frame - readAt >= reactionFrames;
      const freed = cue?.phase === 'freed';
      const braking = reacting && (holdForever || !freed);

      const input: InputState = {
        ...NO_INPUT,
        throttle: !braking && snapshot.targetSpeed < cruise - 1 && !previous.throttle,
        brake: braking ? true : snapshot.speed > cruise + 0.5,
      };
      previous = input;

      for (const event of session.update(input) as GameEvent[]) {
        if (event.kind === 'crashed') run.crashed = true;
        if (event.kind === 'decision') {
          const correct = event.action === event.event.correctAction;
          if (event.event.id === jam.id) {
            run.graded = { action: event.action, correct };
            run.finishedMoving = snapshot.speed > 1;
          }
          settleFsm(correct);
          session.settleDecision({ isCorrect: correct, weakCompetency: null });
        }
      }
      if (run.crashed || (run.graded && distance > jam.triggerAtDistance + 80)) break;
    }
    return run;
  } finally {
    performance.now = realNow;
    Date.now = realDate;
    Math.random = realRandom;
  }
};

describe('what the jammed throttle asks the player to do', () => {
  it('names only controls this car has', () => {
    // The instruction used to read "Shift to neutral, then hold the brake
    // down". There is no neutral. An instruction naming a control the player
    // cannot find reads as a broken game and buries the one that works.
    const instruction = scenarioInstruction(jam).toLowerCase();
    for (const missing of ['neutral', 'gear', 'clutch', 'handbrake', 'ignition', 'lights']) {
      expect(instruction, `instruction names "${missing}", which this car has no control for`).not.toContain(
        missing
      );
    }
    expect(instruction).toContain('brake');
  });

  it('keeps the real-vehicle step, separated from the instruction', () => {
    // "Shift to neutral" is still the module's first step and still examinable.
    // It belongs beside the instruction as a note, never inside it.
    expect(jam.realWorldNote).toBeTruthy();
    expect(jam.realWorldNote!.toLowerCase()).toContain('neutral');
    expect(jam.recommendedMove!.toLowerCase()).not.toContain('neutral');
  });

  it('is the only thing on the route that jams the throttle', () => {
    const jamming = level9.events.filter(event => event.effect?.stuckThrottle);
    expect(jamming.map(event => event.id)).toEqual(['level9.throttle-sticks-open']);
  });
});

describe('recovering a jammed throttle with the visible controls', () => {
  it('works, and tells the player what is happening while it does', () => {
    const run = drive(1);
    expect(run.crashed).toBe(false);
    expect(run.graded).toEqual({ action: 'brake', correct: true });
    // The four states the player is shown, in the order they happen.
    expect(run.cues[0]).toBe('stuck');
    expect(run.cues.some(cue => cue.startsWith('braking'))).toBe(true);
    expect(run.recovered).toBe(true);
  });

  it('gives a human reaction window rather than a reflex test', () => {
    // A player reacting at one second used to hit the jeepney at 76 km/h, and
    // so did every slower reaction. Three seconds is a comprehension pause plus
    // a reaction, which is what an unexpected failure actually costs somebody.
    for (const seconds of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
      const run = drive(seconds);
      expect(run.crashed, `reacting after ${seconds}s ended in an impact`).toBe(false);
      expect(run.graded?.correct, `reacting after ${seconds}s did not pass`).toBe(true);
    }
  });

  it('fails a driver who never brings it under control', () => {
    // The stake is real: this is not a scenario that passes itself.
    const run = drive(6);
    expect(run.recovered).toBe(false);
    expect(run.graded?.correct).toBe(false);
  });

  it('lets go for good, so the brake is not the only thing holding the car down', () => {
    // The literal instruction, taken literally: the brake goes down and stays
    // down. Against a throttle that never released, that parked the car at zero
    // with the event ungraded and the run unable to continue — "hold the brake"
    // was an instruction with no end, and letting go re-pinned the engine.
    //
    // The recovery has to stick. Held until the readout says the engine is back
    // under control and then released, the car must stay the driver's.
    const run = drive(1, { holdForever: true });
    expect(run.crashed).toBe(false);
    expect(run.recovered).toBe(true);

    // And the same drive, released on the cue rather than held past it, both
    // grades and carries on — which is the path the panel actually describes.
    const released = drive(1);
    expect(released.graded?.correct).toBe(true);
    expect(released.finishedMoving).toBe(true);
  });

  it('is graded on the recovery rather than on a speed at a point', () => {
    // A driver who recovers correctly then builds their speed back up is doing
    // exactly the right thing, and a speed check at the sign would fail them
    // for it. Proved by passing while still moving at the measuring point.
    const run = drive(1);
    expect(run.graded?.correct).toBe(true);
    expect(run.finishedMoving).toBe(true);
  });
});

describe('the failure and the explanation are the same moment', () => {
  it('never pulls the car before the panel that explains it', () => {
    // The original fault: the effect was a distance band wide enough to be live
    // when the read panel closed, which made it live *before* the panel opened
    // — the panel waits on the machine, not on a distance. The jam is scoped to
    // the active event now, so the two are the same moment by construction; the
    // observable is that the readout cannot appear before the panel does.
    const realNow = performance.now;
    const realDate = Date.now;
    const realRandom = Math.random;
    let clock = 1_760_000_000_000;
    performance.now = () => clock;
    Date.now = () => clock;
    Math.random = () => 0.5;

    try {
      const fsm = new DrivingFSM();
      const session = createDrivingSession({ level: level9, fsm, signCoverage: {} });
      const settleFsm = (correct: boolean) => {
        fsm.transition(correct ? 'answer_correct' : 'answer_incorrect');
        fsm.transition('feedback_displayed');
        if (!correct) fsm.transition('recovery_complete');
        fsm.transition('road_clear');
      };

      let previous: InputState = NO_INPUT;
      let readAtFrame = -1;
      let firstCueFrame = -1;

      for (let frame = 0; frame < 8000; frame++) {
        clock = 1_760_000_000_000 + frame * (1000 / FPS);
        const held = session.getSnapshot().briefingEvent;
        if (held) {
          if (held.id === jam.id && readAtFrame < 0) readAtFrame = frame;
          session.dismissBriefing();
        }

        const snapshot = session.getSnapshot();
        const distance = session.getFrame()?.scene?.car?.distance ?? 0;
        if (snapshot.throttleCue && firstCueFrame < 0) firstCueFrame = frame;

        const cruise = distance < 820 ? 22 : distance < 1150 ? 48 : distance < 1700 ? 20 : 48;
        const input: InputState = {
          ...NO_INPUT,
          throttle: snapshot.targetSpeed < cruise - 1 && !previous.throttle,
          brake: snapshot.speed > cruise + 0.5,
        };
        previous = input;
        for (const event of session.update(input) as GameEvent[]) {
          if (event.kind === 'decision') {
            const correct = event.action === event.event.correctAction;
            settleFsm(correct);
            session.settleDecision({ isCorrect: correct, weakCompetency: null });
          }
        }
        if (firstCueFrame >= 0 && readAtFrame >= 0) break;
        if (distance > jam.triggerAtDistance) break;
      }

      expect(readAtFrame, 'the scenario was never read').toBeGreaterThanOrEqual(0);
      expect(firstCueFrame, 'the failure never happened').toBeGreaterThanOrEqual(0);
      expect(
        firstCueFrame,
        'the car started pulling before the panel that explains it'
      ).toBeGreaterThanOrEqual(readAtFrame);
    } finally {
      performance.now = realNow;
      Date.now = realDate;
      Math.random = realRandom;
    }
  });
});
