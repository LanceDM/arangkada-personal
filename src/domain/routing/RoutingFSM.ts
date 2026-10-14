import type { FrontierState, RoutingContext, RoutingLogEntry, RoutingMove, RoutingState, RoutingTransition } from './routingTypes';
import { INITIAL_ROUTING_STATE, transitionId } from './routingTypes';
import { legalTransitions } from './routingTable';

/**
 * The routing FSM: the machine above the driving FSM that decides, after each
 * level, which level comes next and what is added to it.
 *
 * A thin holder over the pure table in `routingTable.ts`: it keeps the current
 * state and an append-only log, and changes state only through a transition
 * the table lists as legal. It chooses nothing. The verdict and the content
 * come in through the context, and the choice among legal transitions is the
 * policy's.
 */
export class RoutingFSM {
  private state: RoutingState;
  private readonly transitionLog: RoutingLogEntry[] = [];

  /** Starts at a frontier: the tutorial by default, or wherever a learner already stands. */
  constructor(initial: FrontierState = INITIAL_ROUTING_STATE) {
    this.state = initial;
  }

  getState(): RoutingState { return this.state; }

  /** What may be taken from here under `context`. See `legalTransitions`. */
  legalTransitions(context: RoutingContext): readonly RoutingMove[] {
    return legalTransitions(this.state, context);
  }

  /**
   * Takes `transition` if it is legal from the current state under `context`,
   * and logs it with every transition that was legal beside it. An illegal one
   * returns false and changes nothing - neither the state nor the log.
   */
  take(transition: RoutingTransition, context: RoutingContext): boolean {
    const legal = legalTransitions(this.state, context);
    const id = transitionId(transition);
    const move = legal.find(candidate => transitionId(candidate.transition) === id);
    if (!move) return false;

    this.transitionLog.push({
      seq: this.transitionLog.length,
      from: this.state,
      to: move.to,
      transition: move.transition,
      outcome: context.outcome,
      legal: legal.map(candidate => transitionId(candidate.transition)),
    });
    this.state = move.to;
    return true;
  }

  getTransitionLog(): RoutingLogEntry[] { return [...this.transitionLog]; }
}
