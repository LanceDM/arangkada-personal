/**
 * The drive, run headlessly.
 *
 * The session was pulled out of a React hook precisely so a drive could be
 * advanced and asserted without a component, a canvas or an animation frame.
 * These are the invariants the frame's order depends on — if any of them break,
 * the loop has been reordered rather than moved.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import { runDrive } from './driveSamples';

const level = (id: number) => LEVELS.find(l => l.id === id)!;

const newSession = (levelId = 1, initialDistance?: number) =>
  createDrivingSession({
    level: level(levelId),
    fsm: new DrivingFSM(),
    signCoverage: {},
    initialDistance,
  });

const THROTTLE: InputState = { ...NO_INPUT, throttle: true };

/** Runs frames, settling every graded decision the way the host does. */
const drive = (
  session: ReturnType<typeof createDrivingSession>,
  frames: number,
  input: (frame: number) => InputState
) => {
  const seen: GameEvent[] = [];
  for (let frame = 0; frame < frames; frame++) {
    for (const event of session.update(input(frame))) {
      seen.push(event);
      if (event.kind === 'decision') {
        session.settleDecision({ isCorrect: true, weakCompetency: null });
      }
    }
  }
  return seen;
};

describe('DrivingSession', () => {
  it('needs no canvas, no React and no animation frame', () => {
    const session = newSession();
    expect(() => session.update(NO_INPUT)).not.toThrow();
    expect(session.getFrame()).not.toBeNull();
  });

  it('stands still until the driver touches the throttle', () => {
    const session = newSession();
    drive(session, 30, () => NO_INPUT);
    expect(session.getSnapshot().speed).toBe(0);
    expect(session.getSnapshot().progress).toBe(0);
  });

  it('accelerates on a throttle tap and holds the setting', () => {
    const session = newSession();
    // A tap is a rising edge: the frame after a press must see it released, or
    // auto-repeat would ramp the setting to the top instantly.
    drive(session, 40, frame => (frame % 4 === 0 ? THROTTLE : NO_INPUT));

    const { speed, targetSpeed, progress } = session.getSnapshot();
    expect(targetSpeed).toBeGreaterThan(0);
    expect(speed).toBeGreaterThan(0);
    expect(progress).toBeGreaterThan(0);
  });

  it('opens an event as the car reaches it, and grades it on the way out', () => {
    const first = level(1).events[0];
    // Start just before the first event so the drive reaches it quickly.
    const session = newSession(1, Math.max(0, first.triggerAtDistance - 400));
    const events = drive(session, 4000, frame => (frame % 4 === 0 ? THROTTLE : NO_INPUT));

    expect(events.filter(e => e.kind === 'decision').length).toBeGreaterThan(0);
    expect(session.getFsm().getTransitionLog().length).toBeGreaterThan(0);
  });

  it('reports the route finishing exactly once, and then stands down', () => {
    const session = newSession(1, level(1).roadLength - 20);
    const events = drive(session, 600, frame => (frame % 4 === 0 ? THROTTLE : NO_INPUT));

    expect(events.filter(e => e.kind === 'finished')).toHaveLength(1);
    // A finished run advances no further, whatever the host does next.
    expect(session.update(THROTTLE)).toHaveLength(0);
  });

  it('composes a frame to paint on every tick, without painting it', () => {
    const session = newSession();
    session.update(NO_INPUT);
    const frame = session.getFrame()!;

    // Every solid on the frame came from a node of the scene, in the order the
    // scene was composed in. Nothing is made solid outside the composition, so
    // there is no sprite you cannot hit and no hitbox with nothing drawn on it.
    expect(frame.scene.colliders).toEqual(frame.scene.nodes.flatMap(node => node.solids ?? []));
    expect(frame.flash).toBe(0);
    expect(frame.scene.level.events).toBe(session.getFrame()!.scene.level.events);
  });

  it('re-rolls upcoming content when the weak competency changes', () => {
    const session = newSession(1, Math.max(0, level(1).events[0].triggerAtDistance - 400));
    let rerolled = false;

    for (let frame = 0; frame < 4000 && !rerolled; frame++) {
      for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
        if (event.kind !== 'decision') continue;
        const settled = session.settleDecision({
          isCorrect: false,
          weakCompetency: 'road_signs',
        });
        if (settled.some(e => e.kind === 'rerolled')) rerolled = true;
      }
    }

    expect(rerolled).toBe(true);
    // A wrong answer holds the road still so the correction can be read.
    expect(session.getSnapshot().holdingForCorrection).toBe(true);
  });

  it('never re-rolls where every decision settles with no weak competency, as the routing groups settle them', () => {
    // The levels that re-roll, each driven end to end, reading every panel the
    // way a player does. Level 2's drive crashes before its first scenario.
    let decisions = 0;
    for (const levelId of [1, 2, 3, 4]) {
      const { lines } = runDrive({ levelId, seed: 1, frames: 6000, style: 'commute' });
      decisions += lines.filter(line => /^\d+ decision /.test(line)).length;
      expect(lines.some(line => /^\d+ rerolled/.test(line))).toBe(false);
    }
    expect(decisions).toBeGreaterThan(10);
  }, 60_000);

  it('starts over cleanly', () => {
    const session = newSession();
    drive(session, 60, frame => (frame % 4 === 0 ? THROTTLE : NO_INPUT));
    expect(session.getSnapshot().progress).toBeGreaterThan(0);

    session.reset();
    expect(session.getSnapshot().progress).toBe(0);
    expect(session.getSnapshot().speed).toBe(0);
    expect(session.getFsm().getTransitionLog()).toHaveLength(0);
  });
});
