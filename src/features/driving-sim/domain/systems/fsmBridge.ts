// The one place the simulation loop advances the FSM into an event's graded
// states.
//
// Pure over the machine: no refs, no canvas, no React. Reaching DECISION can
// take up to two `scenario_trigger` edges - one to open the reaction window
// (APPROACHING_EVENT -> REACTION_WINDOW) and one to commit to the decision
// (-> DECISION) - or a single edge from a state already inside the event
// (REACTION_WINDOW / INTERSECTION / HAZARD). The loop used to hand-roll this at
// every freeze site as an identical pair of lines:
//
//     if (fsm.getState() !== 'DECISION') fsm.transition('scenario_trigger');
//     if (fsm.getState() !== 'DECISION') fsm.transition('scenario_trigger');
//
// repeated for checkpoints, right-of-way/emergency cutscenes and parking. That
// idiom stated *how* to walk the machine three times over without ever naming
// *what* it was doing. This does.
import type { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import type { EnvironmentTrigger, FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';

/**
 * The states a verdict can be logged from - exactly the states the
 * `answer_correct` / `answer_incorrect` edges leave.
 */
const GRADEABLE: readonly FSMState[] = ['REACTION_WINDOW', 'INTERSECTION', 'HAZARD', 'DECISION'];

/**
 * Whether an event may take the machine out of what it is doing and open an
 * approach.
 *
 * The approach edges leave IDLE and DRIVING and nowhere else, so those are
 * exactly the states with no event in progress. Asked before an event trigger
 * is offered, because `transition()` returning true is not on its own proof
 * that an approach opened: `scenario_trigger` is both the approach trigger for
 * an event typed that way *and* the unguarded step from inside an event to
 * DECISION, and the loop cannot tell those apart after the fact.
 */
export const canOpenApproach = (fsm: DrivingFSM): boolean =>
  fsm.getState() === 'IDLE' || fsm.getState() === 'DRIVING';

/**
 * Runs `walk` with the event reported as committed, then puts the measurement
 * back.
 *
 * The reaction guard is a distance test, and every caller here has already
 * established the thing that test is standing in for: the driver has answered,
 * or the drive has frozen to ask them. Reporting the commit is what lets the
 * machine cross into the states a decision is graded from - see
 * `decisionCommitted` in fsmTypes.ts. It is set for the length of the walk and
 * cleared again, so no later frame's guard reads it.
 */
const whileCommitted = (fsm: DrivingFSM, walk: () => void): void => {
  fsm.updateContext({ decisionCommitted: true });
  try {
    walk();
  } finally {
    fsm.updateContext({ decisionCommitted: false });
  }
};

/**
 * Drive the machine to DECISION from wherever an event currently has it.
 *
 * At most two `scenario_trigger` edges separate any event-entry state from
 * DECISION, so this attempts it at most twice, stopping the moment the machine
 * is in DECISION. Idempotent: once in DECISION every further call is a no-op,
 * so it is safe to call on each frame a cutscene stays open.
 */
export const advanceToDecision = (fsm: DrivingFSM): void => {
  whileCommitted(fsm, () => {
    for (let step = 0; step < 2; step++) {
      if (fsm.getState() === 'DECISION') return;
      fsm.transition('scenario_trigger');
    }
  });
};

/**
 * Drive the machine into a state the event's verdict can be logged from.
 *
 * Every graded decision has to land on one of `GRADEABLE`, because that is
 * where the `answer_correct` / `answer_incorrect` edges are - and reaction
 * latency, the observable theta is optimised against, is only recorded when one
 * of them fires. A decision the world settles the moment the vehicle satisfies
 * it (`isSatisfiedEarly`, or the tutorial reading a manoeuvre off the car) can
 * happen anywhere in the UI's 120-unit react band, well outside the 10-unit
 * commit lead the distance guard tests, so the walk is made with the commit
 * reported rather than left to a test that has not come true yet.
 *
 * Idempotent, and a no-op once the machine is already somewhere a verdict can
 * be logged. `trigger` is the event's own type, which is what routes the
 * reaction window to INTERSECTION or to HAZARD.
 */
export const advanceToVerdict = (fsm: DrivingFSM, trigger: EnvironmentTrigger): void => {
  whileCommitted(fsm, () => {
    if (GRADEABLE.includes(fsm.getState())) return;
    // Coming to rest mid-approach returns the machine to IDLE while the event
    // is still the active one, so the approach may have to be re-opened before
    // the reaction window can be.
    if (fsm.getState() === 'IDLE' || fsm.getState() === 'DRIVING') fsm.transition(trigger);
    if (fsm.getState() !== 'APPROACHING_EVENT') return;
    // REACTION_WINDOW is itself gradeable, so an event type with no edge out of
    // it still leaves the machine somewhere the verdict can be recorded.
    if (fsm.transition('scenario_trigger')) fsm.transition(trigger);
  });
};
