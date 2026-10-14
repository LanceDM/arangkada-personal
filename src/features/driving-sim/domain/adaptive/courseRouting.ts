// The routing FSM in the game: where a player stands
// in the course between attempts, how the next course entry is decided, how it
// is built, and how its verdict moves the machine.
//
// The machine (src/domain/routing), the policies (domain/learner/adaptive) and
// the binding to Story's content (routingContent.ts) are the ones the
// simulation played. This module calls them in the simulation's order - the
// destination rolled first, then what the machine is told, then the group's
// move, then the add-on - and changes none of them.
//
// Two groups play it. Conventional is the plain move every time. Optimized is
// the learned policy, read from the designated table (seed 11, `553a49a0`).
// Both play the plain FSM's driving settings: h = levelSupport(L, null),
// theta 1, no weak-area roll and no live re-roll. The old practice policy
// runs in neither; it is Legacy's alone.
//
// `RoutingFSM` starts only at a frontier, so a review's `return` and the final
// exam's `certify` are taken at the end of the attempt by the instance that
// took the move into it. What persists between attempts is therefore always a
// frontier (or CERTIFIED) and the verdict on it: the cursor.
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency, SupportLevel } from '@/domain/learner/competency';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { getLowestScoringCompetency } from '@/domain/learner/profile';
import { aimOf, plainPolicy, type RoutingChoice } from '@/domain/learner/adaptive/routingPolicy';
import {
  budgetLeft,
  isRoutingChoice,
  routingActionMove,
  routingQState,
  routingTablePolicy,
  type BudgetLeft,
  type RoutingAction,
  type RoutingQState,
  type RoutingTable,
} from '@/domain/learner/adaptive/routingQPolicy';
import { RoutingFSM } from '@/domain/routing/RoutingFSM';
import { destinationOf, legalTransitions } from '@/domain/routing/routingTable';
import type {
  CertifiedState,
  FrontierState,
  Outcome,
  ReviewLevel,
  RoutingLogEntry,
  RoutingTransition,
} from '@/domain/routing/routingTypes';
import {
  CERTIFIED_STATE,
  COURSE_LEVELS,
  FINAL_EXAM_LEVEL,
  FINAL_STATE,
  driveState,
  frontierLevel,
  stateId,
  transitionId,
} from '@/domain/routing/routingTypes';
import { attemptStream } from '@/features/driving-sim/domain/scenario/attemptSeed';
import { buildLevelConfig, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { GAME_OPTIONS } from './adaptiveOptions';
import { levelSupport } from './practiceSelection';
import { practiceItem, routingContext } from './routingContent';
import type { SignCoverage } from './signCoverage';

// --- groups ----------------------------------------------------------------------

/** The two pilot groups: the plain routing FSM and the learned one. */
export type RoutingGroup = 'conventional' | 'optimized';
export const ROUTING_GROUPS: readonly RoutingGroup[] = ['conventional', 'optimized'];

/** What a player's Story Mode runs as: today's game, or one of the two groups. */
export type GroupInEffect = 'legacy' | RoutingGroup;

/**
 * The learned policy as the simulation recorded it: the designated table and
 * the budget it was trained at, in graded decisions. Read from its table file,
 * never retrained.
 */
export interface OptimizedRouting {
  table: RoutingTable;
  tableId: string;
  /** The training seed the table came from. */
  seed: number;
  /** The size of the budget the learned policy was trained under: what "budget left" is read against. */
  budgetSize: number;
}

// --- the cursor -------------------------------------------------------------------

/** Where a cursor can stand: never inside a review, which ends within its own attempt. */
export type CursorState = FrontierState | CertifiedState;

/**
 * What the policy was shown at a decision, and what it read. Recorded for both
 * groups, so the two can be compared on the same reading; only Optimized acts
 * on it, and only where it is `asked`.
 */
export interface CourseObservation {
  /** BKT's weakest competency over the full history, ties to the least observed; null with no history. */
  weakest: DrivingCompetency | null;
  weakestScore: number | null;
  /** Graded decisions of course entries so far: the learned policy's budget input. */
  spent: number;
  /** The budget it is read against: the trained size for Optimized, none for Conventional. */
  size: number | null;
  budgetLeft: BudgetLeft | null;
  /** Whether the learned policy chose here: at least two of its actions were legal. */
  asked: boolean;
  qState: RoutingQState | null;
  /** The table's row for `qState`, best first. */
  row: RoutingAction[] | null;
  /** The action the move came from; null where the row ran out and the plain move was taken. */
  action: RoutingAction | null;
  tableId: string | null;
}

/**
 * A decided course entry, held from the moment Continue decides it until its
 * attempt is finished. Leaving the entry unfinished and coming back enters the
 * same one again: the same move, rolled from the same seed over the same sign
 * coverage, so the same route and the same add-on.
 */
export interface PendingEntry {
  /** The frontier the move was chosen from. */
  from: FrontierState;
  /** The verdict it was chosen on; null where nothing was chosen and the frontier is played as it stands. */
  outcome: Outcome | null;
  transition: RoutingTransition | null;
  group: RoutingGroup;
  attemptSeed: number;
  coverage: SignCoverage;
  observation: CourseObservation;
  /** How many times the entry was entered. Above 1, it was left unfinished and entered again. */
  starts: number;
}

/** A player's place in the routing FSM between attempts. */
export interface RoutingCursor {
  state: CursorState;
  /** The verdict on the last course entry at `state`; null where the next entry needs no move. */
  outcome: Outcome | null;
  /** The routing log's length so far: the next entry's `seq`. */
  seq: number;
  /** Graded decisions of every course entry played, reviews and practice items included. */
  decisionsSpent: number;
  pending: PendingEntry | null;
}

/**
 * Where a player with no cursor starts: the first level in course order they
 * have not passed, played as it stands. A new player starts at the tutorial; a
 * returning one at their frontier; one who has passed the final exam
 * is already certified.
 */
export const startingCursor = (passedLevels: ReadonlySet<number>): RoutingCursor => {
  const first = COURSE_LEVELS.find(level => !passedLevels.has(level));
  const state: CursorState =
    first !== undefined ? driveState(first) : passedLevels.has(FINAL_EXAM_LEVEL) ? CERTIFIED_STATE : FINAL_STATE;
  return { state, outcome: null, seq: 0, decisionsSpent: 0, pending: null };
};

/** The level a Continue would play at the cursor's frontier, or null once certified. */
export const cursorFrontierLevel = (cursor: RoutingCursor): number | null =>
  cursor.state.kind === 'CERTIFIED' ? null : frontierLevel(cursor.state);

// --- deciding ---------------------------------------------------------------------

/** A level as an entry rolls it: the attempt's roll stream over the coverage it read, and no weak area. */
const rollLevel = (levelId: number, coverage: SignCoverage, attemptSeed: number): LevelConfig => {
  const rolled = buildLevelConfig(levelId, { ...coverage }, null, attemptStream(attemptSeed, 'roll'));
  if (!rolled) throw new Error(`level ${levelId} has no content`);
  return rolled;
};

const plainObservation = (spent: number, weakest: DrivingCompetency | null, weakestScore: number | null): CourseObservation => ({
  weakest,
  weakestScore,
  spent,
  size: null,
  budgetLeft: null,
  asked: false,
  qState: null,
  row: null,
  action: null,
  tableId: null,
});

/** BKT's weakest competency over the history, as the learned policy reads it: ties to the least observed. */
const weakestOf = (history: readonly ActionLog[]) => {
  if (history.length === 0) return null;
  const profile = buildBKTLearnerProfile([...history]);
  const competency = getLowestScoringCompetency(profile, GAME_OPTIONS.weakestTieBreak);
  return { competency, score: profile[competency].score };
};

/**
 * The group's move at a choice, and what it read. Conventional takes the plain
 * move. Optimized asks the learned policy where it has a choice, as the simulation does,
 * and takes the plain move everywhere else.
 */
const chooseMove = (
  group: RoutingGroup,
  choice: RoutingChoice,
  weakest: ReturnType<typeof weakestOf>,
  spent: number,
  optimized: OptimizedRouting | null
) => {
  const observed = plainObservation(spent, weakest?.competency ?? null, weakest?.score ?? null);
  if (group === 'conventional') return { move: plainPolicy(choice, null), observation: observed };

  if (!optimized) throw new Error('the Optimized group needs the designated routing table');
  const budget = { spent, size: optimized.budgetSize };
  const read = { ...observed, size: budget.size, budgetLeft: budgetLeft(budget), tableId: optimized.tableId };
  if (!weakest || !isRoutingChoice(choice.legal, weakest.competency)) {
    return { move: plainPolicy(choice, null), observation: read };
  }

  const observation = { weakest, budget };
  const qState = routingQState(choice, observation);
  const move = routingTablePolicy(optimized.table)(choice, observation);
  const row = [...optimized.table[qState]];
  const action =
    row.find(candidate => {
      const named = routingActionMove(candidate, choice.legal, weakest.competency);
      return named !== undefined && transitionId(named.transition) === transitionId(move.transition);
    }) ?? null;
  return { move, observation: { ...read, asked: true, qState, row, action } };
};

export interface CourseDecisionInput {
  cursor: RoutingCursor;
  group: RoutingGroup;
  /** The learner's graded history, oldest first: what BKT is read over. */
  history: readonly ActionLog[];
  /** A fresh attempt seed for the entry. */
  attemptSeed: number;
  coverage: SignCoverage;
  /** Required for the Optimized group. */
  optimized: OptimizedRouting | null;
}

/**
 * The next course entry: the pending one if there is one, entered again,
 * otherwise a fresh decision. A fresh decision follows the simulation's order:
 * the pass guard's destination, rolled with the entry's seed; the content the
 * machine is told about it; the legal moves; the group's choice among them.
 * Nothing is taken here - `enterCourseEntry` takes the move.
 */
export const nextCourseEntry = ({ cursor, group, history, attemptSeed, coverage, optimized }: CourseDecisionInput): PendingEntry => {
  if (cursor.pending) return { ...cursor.pending, starts: cursor.pending.starts + 1 };
  const from = cursor.state;
  if (from.kind === 'CERTIFIED') throw new Error('a certified player has no course entry left');

  const weakest = weakestOf(history);
  const base = { from, group, attemptSeed, coverage: { ...coverage }, starts: 1 };
  if (cursor.outcome === null) {
    return {
      ...base,
      outcome: null,
      transition: null,
      observation: plainObservation(cursor.decisionsSpent, weakest?.competency ?? null, weakest?.score ?? null),
    };
  }

  const destination = destinationOf(from, cursor.outcome);
  if (destination === null) throw new Error(`no destination from ${stateId(from)} on ${cursor.outcome}`);
  const route = rollLevel(destination, coverage, attemptSeed);
  const context = routingContext(cursor.outcome, { levelId: destination, route });
  const choice: RoutingChoice = { state: from, context, legal: legalTransitions(from, context) };
  const { move, observation } = chooseMove(group, choice, weakest, cursor.decisionsSpent, optimized);
  return { ...base, outcome: cursor.outcome, transition: move.transition, observation };
};

// --- entering ---------------------------------------------------------------------

/** The scenario `+ practice(c)` appended. */
export interface PlacedItem {
  competency: DrivingCompetency;
  scenarioId: string;
  sourceLevelId: number;
}

/** One course entry, built and with its move taken. */
export interface CourseEntry {
  pending: PendingEntry;
  /** The machine that took the move into this entry; it takes `return` or `certify` when the entry ends. */
  fsm: RoutingFSM;
  /** Every move that was legal at the decision, by id; empty where none was taken. */
  legal: string[];
  /** The level the pass guard sent the player to; null where no move was taken. */
  destination: number | null;
  /** The level played: the destination, the frontier as it stands, or the level a review replays. */
  levelId: number;
  /** The route as rolled, before anything was appended. */
  rolled: LevelConfig;
  /** The route the drive starts on. */
  level: LevelConfig;
  item: PlacedItem | null;
  review: { level: ReviewLevel; competency: DrivingCompetency } | null;
  /** The plain FSM's support level for the level played. Theta is 1: no transition parameters are set. */
  support: SupportLevel;
}

/**
 * Builds a decided entry and takes its move through `RoutingFSM.take`. The
 * destination is rolled again from the entry's seed and coverage, so the
 * machine is told exactly what the decision was made against, and a move it
 * does not list is an error, never a substitute.
 */
export const enterCourseEntry = (pending: PendingEntry): CourseEntry => {
  const fsm = new RoutingFSM(pending.from);
  const { attemptSeed, coverage } = pending;

  if (pending.outcome === null || pending.transition === null) {
    const levelId = frontierLevel(pending.from);
    const rolled = rollLevel(levelId, coverage, attemptSeed);
    return {
      pending, fsm, legal: [], destination: null, levelId, rolled, level: rolled, item: null, review: null,
      support: levelSupport(levelId, null),
    };
  }

  const destination = destinationOf(pending.from, pending.outcome)!;
  const route = rollLevel(destination, coverage, attemptSeed);
  const context = routingContext(pending.outcome, { levelId: destination, route });
  const legal = fsm.legalTransitions(context).map(move => transitionId(move.transition));
  if (!fsm.take(pending.transition, context)) {
    throw new Error(`the routing FSM refused ${transitionId(pending.transition)} from ${stateId(pending.from)}`);
  }

  const to = fsm.getState();
  if (to.kind === 'REVIEW') {
    const rolled = rollLevel(to.level, coverage, attemptSeed);
    const competency = aimOf(pending.transition)!;
    return {
      pending, fsm, legal, destination, levelId: to.level, rolled, level: rolled, item: null,
      review: { level: to.level, competency }, support: levelSupport(to.level, null),
    };
  }

  const competency = aimOf(pending.transition);
  const variant = competency ? practiceItem(competency, destination, route, attemptStream(attemptSeed, 'practice')) : null;
  if (competency && !variant) throw new Error(`+ practice(${competency}) was legal at level ${destination} and placed nothing`);
  return {
    pending, fsm, legal, destination, levelId: destination, rolled: route,
    level: variant ? withRemediation(route, variant) : route,
    item: competency && variant ? { competency, scenarioId: variant.id, sourceLevelId: variant.remediationSourceLevelId! } : null,
    review: null,
    support: levelSupport(destination, null),
  };
};

// --- settling ---------------------------------------------------------------------

/**
 * Moves the cursor on the entry's verdict. A review returns to its frontier
 * whatever it scored, and that frontier is played next as it stands; a passed
 * final exam certifies. Otherwise the verdict waits on the cursor for the next
 * Continue to decide from. `gradedDecisions` is the entry's own count, standing
 * penalties excluded, and is spent from the learned policy's budget whichever group played it.
 * The log is every transition this entry added, numbered on from the cursor's.
 */
export const settleCourseEntry = (
  cursor: RoutingCursor,
  entry: CourseEntry,
  outcome: Outcome,
  gradedDecisions: number
): { cursor: RoutingCursor; log: RoutingLogEntry[] } => {
  const { fsm } = entry;
  const state = fsm.getState();
  const nothingMeasured = routingContext(outcome, null);
  if (state.kind === 'REVIEW') fsm.take({ kind: 'return' }, nothingMeasured);
  else if (state.kind === 'FINAL' && outcome === 'passed') fsm.take({ kind: 'certify' }, nothingMeasured);

  const after = fsm.getState();
  if (after.kind === 'REVIEW') throw new Error(`the course entry ended inside ${stateId(after)}`);
  const log = fsm.getTransitionLog().map(logged => ({ ...logged, seq: cursor.seq + logged.seq }));
  const settledOutcome = state.kind === 'REVIEW' || after.kind === 'CERTIFIED' ? null : outcome;
  return {
    cursor: {
      state: after,
      outcome: settledOutcome,
      seq: cursor.seq + log.length,
      decisionsSpent: cursor.decisionsSpent + gradedDecisions,
      pending: null,
    },
    log,
  };
};

// --- storage -------------------------------------------------------------------------

export const ROUTING_CURSOR_SCHEMA_VERSION = 1;

/** A sign's coverage record with its plate name, so coverage can be stored as a list of maps. */
type StoredSignRecord = SignCoverage[string] & { name: string };

/** `users/{uid}/routing/cursor`. JSON-safe: no `undefined`, and coverage as a list rather than plate-named keys. */
export interface StoredRoutingCursor {
  schemaVersion: typeof ROUTING_CURSOR_SCHEMA_VERSION;
  state: CursorState;
  outcome: Outcome | null;
  seq: number;
  decisionsSpent: number;
  pending: (Omit<PendingEntry, 'coverage'> & { coverage: StoredSignRecord[] }) | null;
  updatedAt: number;
}

export const storedCursor = (cursor: RoutingCursor, updatedAt: number): StoredRoutingCursor => ({
  schemaVersion: ROUTING_CURSOR_SCHEMA_VERSION,
  state: cursor.state,
  outcome: cursor.outcome,
  seq: cursor.seq,
  decisionsSpent: cursor.decisionsSpent,
  pending: cursor.pending && {
    ...cursor.pending,
    coverage: Object.entries(cursor.pending.coverage).map(([name, record]) => ({ ...record, name })),
  },
  updatedAt,
});

/** A stored cursor read back, or null for a schema this code does not know. */
export const readStoredCursor = (raw: unknown): RoutingCursor | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const stored = raw as StoredRoutingCursor;
  if (stored.schemaVersion !== ROUTING_CURSOR_SCHEMA_VERSION) return null;
  return {
    state: stored.state,
    outcome: stored.outcome,
    seq: stored.seq,
    decisionsSpent: stored.decisionsSpent,
    pending: stored.pending && {
      ...stored.pending,
      coverage: Object.fromEntries(stored.pending.coverage.map(({ name, ...record }) => [name, record])),
    },
  };
};

// --- free replay ------------------------------------------------------------------

/**
 * A passed level played again from the map, outside the machine: rolled from
 * its own seed, on the plain FSM's driving settings, with nothing added. Its
 * verdict moves nothing, and its decisions are not spent from the learned policy's budget.
 */
export const freeReplayLevel = (levelId: number, attemptSeed: number, coverage: SignCoverage) => {
  const rolled = rollLevel(levelId, coverage, attemptSeed);
  return { levelId, rolled, level: rolled, support: levelSupport(levelId, null) };
};
