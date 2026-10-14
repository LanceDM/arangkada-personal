/**
 * How a drive gets from one event to the next: which event owns the drive, the
 * panels it opens, and the verdict it has to record on the way out.
 *
 * Each of these records a bug that shipped.
 *
 * - A road event stopped the world behind a panel that had to be dismissed,
 *   which is a scenario the player can be stuck behind and cannot drive around.
 * - The live re-roll changed the route ahead behind a three-second banner, on a
 *   moving road, at the one moment attention is least available.
 * - A decision settled the moment the vehicle satisfied it — which is as early
 *   as the UI's 120-unit react band — was graded while the machine was still in
 *   APPROACHING_EVENT. That state has no verdict edge and no event trigger out
 *   of it, so the decision went unrecorded *and* every later event's approach
 *   was refused, until the car happened to come to rest and `vehicle_stopped`
 *   returned the machine to IDLE. On the tutorial, whose every step is settled
 *   the instant the car satisfies it, that meant one graded event out of five
 *   and no on-screen instruction after the first.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

/** The states the `answer_correct` / `answer_incorrect` edges leave. */
const GRADEABLE: readonly FSMState[] = ['REACTION_WINDOW', 'INTERSECTION', 'HAZARD', 'DECISION'];

/**
 * The host's half of a graded decision, replayed.
 *
 * `useScenarioEvaluation` is a React hook, so its FSM choreography cannot be
 * called from here — this mirrors it, the same way `loopIntegration.test.ts`
 * mirrors the frame loop. It is only the machine half: no scoring, no cards,
 * and the incorrect path's 800ms recovery timer collapsed, since nothing here
 * is measuring how long a correction stays up.
 */
const hostVerdict = (fsm: DrivingFSM, isCorrect: boolean) => {
  if (!GRADEABLE.includes(fsm.getState())) return;
  fsm.transition(isCorrect ? 'answer_correct' : 'answer_incorrect');
  fsm.transition('feedback_displayed');
  if (!isCorrect) fsm.transition('recovery_complete');
  fsm.transition('road_clear');
};

const level = (id: number) => LEVELS.find(entry => entry.id === id)!;
const THROTTLE: InputState = { ...NO_INPUT, throttle: true };

const newSession = (levelId: number, initialDistance?: number) =>
  createDrivingSession({
    level: level(levelId),
    fsm: new DrivingFSM(),
    signCoverage: {},
    initialDistance,
  });

type Session = ReturnType<typeof createDrivingSession>;

/**
 * Runs frames until an event owns the drive, and reports the frame it did.
 *
 * Nothing is acknowledged on the way: an ordinary road event has nothing to
 * acknowledge, which is the property the block below is about.
 */
/**
 * Reads whatever the drive is holding for, the way a player does.
 *
 * Every scenario answered with the car now freezes once to be read, so a test
 * that drives without acknowledging stalls on the first one and proves nothing
 * about the rest of the level.
 */
const readAnyBriefing = (session: Session): void => {
  if (session.getSnapshot().briefingEvent) session.dismissBriefing();
};

const driveToActiveEvent = (session: Session, frames = 4000): number => {
  for (let frame = 0; frame < frames; frame++) {
    for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
      if (event.kind === 'decision') session.settleDecision({ isCorrect: true, weakCompetency: null });
    }
    if (session.getSnapshot().activeEvent) return frame;
  }
  return -1;
};

describe('a scenario that is answered by driving', () => {
  it('holds the whole world while the scenario is being read', () => {
    // Everything, not just the car: a frozen frame that lets the traffic keep
    // coming charges the driver for the time they spent reading.
    const session = newSession(3);
    expect(driveToActiveEvent(session), 'no event ever owned the drive').toBeGreaterThan(0);

    const held = session.getSnapshot();
    expect(held.briefingEvent, 'the scenario was never held to be read').not.toBeNull();
    expect(held.activeEvent).not.toBeNull();

    for (let frame = 0; frame < 120; frame++) session.update(THROTTLE);

    const during = session.getSnapshot();
    expect(during.progress).toBe(held.progress);
    expect(during.speed).toBe(held.speed);
    expect(during.briefingEvent).toBe(held.briefingEvent);
  });

  it('resumes from the frame it froze on, and only once', () => {
    const session = newSession(3);
    driveToActiveEvent(session);
    const held = session.getSnapshot();
    expect(held.briefingEvent).not.toBeNull();

    // Four acknowledgements — a click, a key repeat, an effect replay — release
    // the drive exactly once and leave nothing to release.
    session.dismissBriefing();
    session.dismissBriefing();
    session.dismissBriefing();
    const resumed = session.getSnapshot();
    expect(resumed.briefingEvent).toBeNull();
    expect(resumed.progress).toBe(held.progress);

    for (let frame = 0; frame < 120; frame++) session.update(THROTTLE);
    expect(session.getSnapshot().progress).toBeGreaterThan(held.progress);
  });

  it('leaves the drive controllable once the scenario has been read', () => {
    const session = newSession(3);
    expect(driveToActiveEvent(session)).toBeGreaterThan(0);
    session.dismissBriefing();

    const before = session.getSnapshot();
    // Steering answers while the scenario is still live, which is why the hold
    // is taken at the top of the window rather than at the decision point.
    for (let frame = 0; frame < 40; frame++) {
      session.update({ ...NO_INPUT, throttle: frame % 4 === 0, left: true });
    }
    const after = session.getSnapshot();
    expect(after.lane).toBeLessThanOrEqual(before.lane);
    expect(after.progress).toBeGreaterThan(before.progress);
  });

  it('measures the reaction from the release, not from the announcement', () => {
    // The reason the trigger exists at all: the reaction clock starts at the
    // most recent release of the read phase (`reactionClockMs`), so dismissing
    // has to write one or the reading time is inside the number the practice
    // policy conditions on.
    const session = newSession(3);
    driveToActiveEvent(session);
    const fsm = session.getFsm();
    const before = fsm.getTransitionLog().length;

    session.dismissBriefing();

    const written = fsm.getTransitionLog().slice(before);
    expect(written.map(entry => entry.trigger)).toContain('briefing_dismissed');
    expect(written[written.length - 1].to).toBe('APPROACHING_EVENT');
  });

  it('starts every level unpaused, with nothing asked and nothing to dismiss', () => {
    for (const levelId of [0, 3, 5, 7]) {
      const opening = newSession(levelId).getSnapshot();
      expect(opening.activeEvent, `level ${levelId} opens mid-scenario`).toBeNull();
      expect(opening.inspectionEvent).toBeNull();
      expect(opening.cutsceneEvent).toBeNull();
      expect(opening.adaptationNotice).toBeNull();
      expect(opening.briefingEvent, `level ${levelId} opens behind a briefing`).toBeNull();
    }
  });

  it('still freezes for a checkpoint, which is a question rather than guidance', () => {
    // Level 1 is checkpoints end to end. A Go / No-Go answer is a decision the
    // car cannot express, so the drive genuinely does stop for it — once the
    // driver has brought the car to rest at the line, which is what opens it.
    const session = newSession(1);
    for (let frame = 0; frame < 4000; frame++) {
      const held = session.getSnapshot();
      if (held.inspectionEvent) {
        expect(held.activeEvent).not.toBeNull();
        // Frozen: the road does not move behind the question.
        const before = held.progress;
        for (let held_frame = 0; held_frame < 60; held_frame++) session.update(THROTTLE);
        expect(session.getSnapshot().progress).toBe(before);
        return;
      }
      // Get moving, then stand on the brake once the checkpoint is announced.
      const braking = Boolean(held.activeEvent);
      session.update(
        braking ? { ...NO_INPUT, brake: true } : { ...NO_INPUT, throttle: frame % 4 === 0 }
      );
    }
    throw new Error('no checkpoint ever opened');
  });
});

describe('a decision settled the moment the vehicle satisfies it', () => {
  it('is reported from a state the verdict can be logged from', () => {
    // The invariant the session itself owns, and the one the bug broke: every
    // decision the world reports leaves the machine somewhere the host's
    // verdict edge exists. Asserted without replaying the host at all, because
    // this is true of the report regardless of what is done with it.
    const session = newSession(0);
    const fsm = session.getFsm();
    const states: FSMState[] = [];

    for (let frame = 0; frame < 6000; frame++) {
      readAnyBriefing(session);
      for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
        if (event.kind !== 'decision') continue;
        states.push(fsm.getState());
        session.settleDecision({ isCorrect: true, weakCompetency: null });
        hostVerdict(fsm, true);
      }
    }

    expect(states.length).toBe(level(0).events.length);
    expect(states.filter(state => !GRADEABLE.includes(state))).toEqual([]);
  });

  it('grades every tutorial step, and never needs the car to come to rest', () => {
    // The tutorial is the sharpest case: every one of its five steps is read
    // off the car's own state the instant it is satisfied, so all five are
    // settled early and none is ever graded at a zone exit. One graded step out
    // of five was the shipped behaviour, and the drive only unstuck itself when
    // the car happened to stop — `vehicle_stopped` returns the machine to IDLE,
    // which an event trigger can leave. A drive that grades everything without
    // ever stopping is the proof it no longer depends on that.
    const session = newSession(0);
    const fsm = session.getFsm();
    const decisions: GameEvent[] = [];

    for (let frame = 0; frame < 6000; frame++) {
      readAnyBriefing(session);
      for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
        if (event.kind !== 'decision') continue;
        decisions.push(event);
        session.settleDecision({ isCorrect: true, weakCompetency: null });
        hostVerdict(fsm, true);
      }
    }

    const log = fsm.getTransitionLog();
    const verdicts = log.filter(
      entry => entry.trigger === 'answer_correct' || entry.trigger === 'answer_incorrect'
    );

    expect(decisions).toHaveLength(level(0).events.length);
    // One verdict per decision: reaction latency, the observable theta is
    // optimised against, is only recorded when a verdict fires, so a decision
    // graded outside those states is a decision the thesis cannot see.
    expect(verdicts).toHaveLength(decisions.length);
    expect(log.filter(entry => entry.trigger === 'vehicle_stopped')).toHaveLength(0);
    expect(session.getSnapshot().progress).toBeGreaterThanOrEqual(1);
  });
});

describe('which event owns the drive', () => {
  it('never lets one take over while another is being answered', () => {
    // `transition()` returning true is not proof that an approach opened. An
    // event *typed* `scenario_trigger` offers the same trigger that steps from
    // inside an event to DECISION, and that edge is unguarded - so on Level 5
    // the roundabout at 6100 took the active event at 1493, while the crossing
    // at 1500 was still being answered. That crossing was abandoned ungraded,
    // and the machine sat in DECISION, where none of the four events between
    // them could open an approach either: five of eight never fired.
    const level5 = level(5);
    const session = newSession(5);
    const fsm = session.getFsm();
    const tooEarly: string[] = [];

    for (let frame = 0; frame < 8000; frame++) {
      readAnyBriefing(session);
      for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
        if (event.kind !== 'decision') continue;
        session.settleDecision({ isCorrect: true, weakCompetency: null });
        hostVerdict(fsm, true);
      }
      const after = session.getSnapshot();
      if (!after.activeEvent) continue;
      // An event may only own the drive once the car is inside the window it
      // announced itself over, widened by the most theta can widen it.
      // Anything further out than that is a theft.
      const distance = after.progress * level5.roadLength;
      const widest = 2 * (after.activeEvent.warningDistance ?? 400);
      const out = after.activeEvent.triggerAtDistance - distance;
      if (out > widest) tooEarly.push(`${after.activeEvent.id} owned the drive ${out.toFixed(0)} out`);
    }

    expect([...new Set(tooEarly)]).toEqual([]);
  });

  it('reaches the events the theft used to swallow', () => {
    // Level 5 used to yield three graded events out of eight: the signal slot
    // could not fire at all (its `green_light` type has no edge that starts an
    // event), and the theft above swallowed the four between the crossing and
    // the roundabout. Named individually rather than asserting the whole roster
    // so this pins the bug rather than the quality of the driver below.
    const swallowed = [
      'level5.crossing-yield',
      'level5.controlled-junction',
      'level5.signal-right-of-way',
      'level5.emergency-yield',
      'level5.yellow-box',
    ];
    const session = newSession(5);
    const fsm = session.getFsm();
    const graded = new Set<string>();

    for (let frame = 0; frame < 12000; frame++) {
      const held = session.getSnapshot();
      if (held.adaptationNotice) session.dismissAdaptationNotice();
      const settle = (reported: readonly GameEvent[]) => {
        for (const event of reported) {
          if (event.kind !== 'decision') continue;
          graded.add(event.event.id);
          session.settleDecision({ isCorrect: true, weakCompetency: null });
          hostVerdict(fsm, true);
        }
      };
      if (held.inspectionEvent) { settle(session.answerInspection('stop')); continue; }
      if (held.cutsceneEvent) { settle(session.answerCutscene('stop')); continue; }
      readAnyBriefing(session);
      settle(session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT));
    }

    const missed = swallowed.filter(
      slot => !level(5).events.some(event => event.id.startsWith(slot) && graded.has(event.id))
    );
    expect(missed).toEqual([]);
  });
});

describe('the route adapting mid-drive', () => {
  it('holds the drive until the player acknowledges it, then resumes once', () => {
    const session = newSession(3);
    let rerolled = false;

    for (let frame = 0; frame < 6000 && !rerolled; frame++) {
      readAnyBriefing(session);
      for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
        if (event.kind !== 'decision') continue;
        const settled = session.settleDecision({ isCorrect: false, weakCompetency: 'road_signs' });
        if (settled.some(reported => reported.kind === 'rerolled')) rerolled = true;
      }
    }

    expect(rerolled, 'the drive never re-rolled toward a weak competency').toBe(true);
    const notified = session.getSnapshot();
    expect(notified.adaptationNotice).toBe('road_signs');

    const before = notified.progress;
    for (let frame = 0; frame < 240; frame++) session.update(THROTTLE);
    expect(session.getSnapshot().progress).toBe(before);

    session.dismissAdaptationNotice();
    expect(session.getSnapshot().adaptationNotice).toBeNull();
    // Idempotent, so a second acknowledgement resumes nothing a second time.
    expect(session.dismissAdaptationNotice()).toEqual([]);
  });

  it('names each weak area once, however often the route is re-aimed at it', () => {
    // The mastery estimate swings between two competencies answer by answer
    // early in a run, and each swing is a real re-roll. Holding the drive for
    // every one of them made a five-event level five panels to dismiss.
    const session = newSession(3);
    let rerolls = 0;
    let holds = 0;
    const aims: Array<'road_signs' | 'hazard_awareness'> = [];

    for (let frame = 0; frame < 8000; frame++) {
      const held = session.getSnapshot();
      if (held.adaptationNotice) {
        holds += 1;
        session.dismissAdaptationNotice();
      }
      readAnyBriefing(session);
      for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
        if (event.kind !== 'decision') continue;
        // Alternating weak areas, which is what the estimate actually does.
        const weak = aims.length % 2 === 0 ? 'road_signs' : 'hazard_awareness';
        aims.push(weak);
        // Graded correct so no correction hold runs: the hold is wall-clock, and
        // this loop runs far faster than 60Hz, so a 3.2s hold per decision
        // would swallow the whole run.
        for (const settled of session.settleDecision({ isCorrect: true, weakCompetency: weak })) {
          if (settled.kind === 'rerolled') rerolls += 1;
        }
        hostVerdict(session.getFsm(), true);
      }
    }

    expect(rerolls, 'the route never re-rolled').toBeGreaterThan(2);
    // Two distinct areas were aimed at, so two things were worth saying.
    expect(holds).toBe(2);
  });
});
