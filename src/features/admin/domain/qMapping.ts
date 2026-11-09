/**
 * The Optimized group's routing table as the dashboard shows it: its 36 states
 * by its four actions, the order each state's row tries them in, what each
 * state dimension means in words, and, from the routing records, every choice
 * the table was asked to make.
 *
 * Everything is read from the policy's own definitions: the states are
 * `ROUTING_Q_STATES` in its order, the actions `ROUTING_ACTIONS`, and the
 * numbers in the labels (which levels a stage covers, where a mastery bucket
 * starts, how much budget is "more than half") are found by asking the
 * functions that decide them. What was legal at a recorded choice is decided
 * by the policy's own masking, over the legal moves the record lists.
 *
 * Process only: which state was read and which action was taken, never a
 * score. The weakest competency is named with its bucket, not its BKT score.
 */
import type { DrivingCompetency } from '@/domain/learner/competency';
import { MASTERY_BUCKETS, masteryBucket, type MasteryBucket } from '@/domain/learner/adaptive/qLearningPolicy';
import {
  BUDGET_LEFT,
  ROUTING_ACTIONS,
  ROUTING_Q_STATES,
  ROUTING_STAGES,
  budgetLeft,
  legalRoutingActions,
  routingActionMove,
  routingStage,
  type BudgetLeft,
  type RoutingAction,
  type RoutingQState,
  type RoutingStage,
  type RoutingTable,
} from '@/domain/learner/adaptive/routingQPolicy';
import { plainMove } from '@/domain/learner/adaptive/routingPolicy';
import { COURSE_LEVELS, transitionId, type CourseLevel, type Outcome } from '@/domain/routing/routingTypes';
import type { StudyCohort } from '@/domain/study/participantCode';
import type { StoredAttempt } from '@/features/driving-sim';
import { movesFromIds, type RoutingGraph } from './routingGraph';

const OUTCOME_VALUES: readonly Outcome[] = ['passed', 'failed'];

/** The table the Optimized group plays, as the game reads it. */
export interface DesignatedTable {
  table: RoutingTable;
  tableId: string;
  seed: number;
  budgetSize: number;
}

// --- the states, in words ---------------------------------------------------------

export interface QStateParts {
  stage: RoutingStage;
  mastery: MasteryBucket;
  outcome: Outcome;
  budget: BudgetLeft;
}

/** A state's four parts, or null for an id that is not one of the 36. */
export const qStateParts = (state: string): QStateParts | null => {
  if (!(ROUTING_Q_STATES as readonly string[]).includes(state)) return null;
  const [stage, mastery, outcome, budget] = state.split(':');
  return { stage, mastery, outcome, budget } as QStateParts;
};

export const STAGE_LABEL: Record<RoutingStage, string> = { early: 'Early', middle: 'Middle', late: 'Late' };
export const MASTERY_LABEL: Record<MasteryBucket, string> = { critical: 'Critical', weak: 'Weak', ok: 'OK' };
export const OUTCOME_LABEL: Record<Outcome, string> = { passed: 'Passed', failed: 'Failed' };
export const BUDGET_LABEL: Record<BudgetLeft, string> = { more: 'More than half left', less: 'Half or less left' };

export const ACTION_LABEL: Record<RoutingAction, { label: string; short: string; detail: string }> = {
  none: {
    label: 'Nothing added',
    short: 'None',
    detail: 'The plain move: advance on a pass, retry on a fail, and nothing added.',
  },
  weakest: {
    label: 'Practise the weakest',
    short: 'Weakest',
    detail: 'One practice item on the weakest competency, added to the level played next.',
  },
  related: {
    label: 'Practise a related competency',
    short: 'Related',
    detail: "One practice item on the weakest competency's first curriculum relative that can be practised there.",
  },
  review: {
    label: 'Review a passed level',
    short: 'Review',
    detail: 'Replay the highest passed level that teaches the weakest competency, then return to the course.',
  },
};

/** Consecutive runs of `values` that `bucketOf` puts in the same bucket: where each bucket starts and ends. */
const runsOf = <B extends string>(values: readonly number[], bucketOf: (value: number) => B) => {
  const runs = new Map<B, { first: number; last: number }>();
  for (const value of values) {
    const bucket = bucketOf(value);
    const run = runs.get(bucket);
    runs.set(bucket, run ? { first: run.first, last: value } : { first: value, last: value });
  }
  return runs;
};

const span = (first: number, last: number) => (first === last ? `${first}` : `${first}–${last}`);

export interface QDimensionLabels {
  stage: Record<RoutingStage, { label: string; levels: string }>;
  mastery: Record<MasteryBucket, { label: string; range: string }>;
  outcome: Record<Outcome, { label: string }>;
  budget: Record<BudgetLeft, { label: string; range: string }>;
}

/**
 * Every dimension's values in words, each with the numbers its function
 * decides on: the levels in a stage (`routingStage`), the BKT scores in a
 * bucket (`masteryBucket`, over 0-100), and the decisions spent at which
 * "more than half left" ends (`budgetLeft`, at the table's budget).
 */
export const qDimensionLabels = (budgetSize: number): QDimensionLabels => {
  const stages = runsOf<RoutingStage>(COURSE_LEVELS, level => routingStage(level as CourseLevel));
  const buckets = runsOf(Array.from({ length: 101 }, (_, score) => score), masteryBucket);
  const left = runsOf(Array.from({ length: budgetSize + 1 }, (_, spent) => spent), spent => budgetLeft({ spent, size: budgetSize }));
  const scoreRange = (bucket: MasteryBucket) => {
    const run = buckets.get(bucket)!;
    if (run.first === 0) return `below ${run.last + 1}`;
    if (run.last === 100) return `${run.first} or more`;
    return `${run.first} to under ${run.last + 1}`;
  };
  const spentRange = (bucket: BudgetLeft) => {
    const run = left.get(bucket)!;
    return run.first === 0 ? `under ${run.last + 1} of ${budgetSize} decisions spent` : `${run.first} or more of ${budgetSize} spent`;
  };
  return {
    stage: Object.fromEntries(
      ROUTING_STAGES.map(stage => {
        const run = stages.get(stage)!;
        return [stage, { label: STAGE_LABEL[stage], levels: `Levels ${span(run.first, run.last)}` }];
      })
    ) as QDimensionLabels['stage'],
    mastery: Object.fromEntries(
      MASTERY_BUCKETS.map(bucket => [bucket, { label: MASTERY_LABEL[bucket], range: scoreRange(bucket) }])
    ) as QDimensionLabels['mastery'],
    outcome: Object.fromEntries(OUTCOME_VALUES.map(outcome => [outcome, { label: OUTCOME_LABEL[outcome] }])) as QDimensionLabels['outcome'],
    budget: Object.fromEntries(
      BUDGET_LEFT.map(bucket => [bucket, { label: BUDGET_LABEL[bucket], range: spentRange(bucket) }])
    ) as QDimensionLabels['budget'],
  };
};

// --- the grid ------------------------------------------------------------------------

export interface QGridRow extends QStateParts {
  state: RoutingQState;
  /** The row as the table holds it: the actions training tried here, best first, ending at `none`. */
  order: readonly RoutingAction[];
  /** Training never visited this state: the row is empty, and the plain move is taken. */
  untrained: boolean;
  /** Each action's place in the order, from 1; null where the row does not hold it. */
  rank: Record<RoutingAction, number | null>;
}

export const qGrid = (table: RoutingTable): QGridRow[] =>
  ROUTING_Q_STATES.map(state => {
    const order = table[state] ?? [];
    return {
      state,
      ...qStateParts(state)!,
      order,
      untrained: order.length === 0,
      rank: Object.fromEntries(
        ROUTING_ACTIONS.map(action => [action, order.includes(action) ? order.indexOf(action) + 1 : null])
      ) as QGridRow['rank'],
    };
  });

/** A state in words, as a row's title gives it. */
export const qStateWords = (row: QStateParts, labels: QDimensionLabels) =>
  [
    `${labels.stage[row.stage].label} (${labels.stage[row.stage].levels})`,
    `weakest competency ${labels.mastery[row.mastery].label} (BKT ${labels.mastery[row.mastery].range})`,
    `level ${labels.outcome[row.outcome].label.toLowerCase()}`,
    `${labels.budget[row.budget].label.toLowerCase()} (${labels.budget[row.budget].range})`,
  ].join(' · ');

// --- the board ----------------------------------------------------------------------

/** A board's columns, in the policy's order: the verdict, then the budget left. */
export const Q_BOARD_COLUMNS: ReadonlyArray<{ outcome: Outcome; budget: BudgetLeft }> = OUTCOME_VALUES.flatMap(outcome =>
  BUDGET_LEFT.map(budget => ({ outcome, budget }))
);

export interface QBoardZone {
  stage: RoutingStage;
  /** One row per mastery bucket, each a tile per column. */
  rows: Array<{ mastery: MasteryBucket; tiles: QGridRow[] }>;
}

/**
 * The grid laid out as a board: a zone per course stage, a row per mastery
 * bucket, a column per verdict and budget, each in the policy's own order. So
 * the board reads in the same order as `ROUTING_Q_STATES`, a tile per state.
 */
export const qBoard = (grid: readonly QGridRow[]): QBoardZone[] =>
  ROUTING_STAGES.map(stage => ({
    stage,
    rows: MASTERY_BUCKETS.map(mastery => ({
      mastery,
      tiles: Q_BOARD_COLUMNS.flatMap(({ outcome, budget }) =>
        grid.filter(row => row.stage === stage && row.mastery === mastery && row.outcome === outcome && row.budget === budget)
      ),
    })),
  }));

// --- the choices ---------------------------------------------------------------------

export interface QAttemptRef {
  id: string;
  /** 1 for the account's first attempt, as Replay numbers them. */
  number: number;
  levelId: number;
}

export interface QChoice {
  index: number;
  attempt: QAttemptRef;
  at: number;
  /** The state the move was chosen at, and the verdict it was chosen on. */
  from: string;
  outcome: Outcome | null;
  qState: string;
  parts: QStateParts | null;
  weakest: DrivingCompetency | null;
  budget: { spent: number; size: number | null; left: BudgetLeft | null };
  /** The table's row for the state read; null for a state the table does not have. */
  row: readonly RoutingAction[] | null;
  /** The actions that were legal, each with the move it named. */
  legal: Array<{ action: RoutingAction; move: string }>;
  masked: RoutingAction[];
  /** The action the move came from; null where the row ran out and the plain move was taken. */
  action: RoutingAction | null;
  move: string;
  /** What the record says, held against the table and the policy's own functions. */
  checks: {
    /** The record names the table shown. */
    table: boolean;
    /** The row the record kept is the table's row for that state. */
    row: boolean;
    /** The recorded action names the recorded move, by the policy's own mapping. */
    action: boolean;
    /** Every legal move the record lists is one the machine offers from that state. */
    legal: boolean;
  };
}

export interface QUnasked {
  attempt: QAttemptRef;
  at: number;
  /** No BKT reading yet, or fewer than two of the four actions legal. */
  reason: 'no-reading' | 'one-action';
}

export interface QChoices {
  choices: QChoice[];
  unasked: QUnasked[];
}

const sameOrder = (a: readonly string[] | null | undefined, b: readonly string[] | null | undefined) =>
  !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Every move the Optimized group's table decided, in the order the account's
 * attempts were saved: the course entries it was asked at, and those it took
 * the plain move at unasked. An entry played as it stands, with no move into
 * it, decided nothing and is not listed.
 */
export const qChoices = (attempts: readonly StoredAttempt[], designated: DesignatedTable, graph: RoutingGraph): QChoices => {
  const choices: QChoice[] = [];
  const unasked: QUnasked[] = [];
  attempts.forEach((stored, position) => {
    const entry = stored.routing?.entry;
    if (!entry || entry.decidedIn !== 'optimized' || !entry.move || !entry.observation) return;
    const attempt: QAttemptRef = { id: stored.id, number: position + 1, levelId: stored.attempt.levelId };
    const at = stored.attempt.timestamp;
    const observation = entry.observation;
    if (!observation.asked || !observation.qState) {
      unasked.push({ attempt, at, reason: observation.weakest ? 'one-action' : 'no-reading' });
      return;
    }

    const from = entry.cursorBefore?.state ?? '';
    const moves = movesFromIds(graph, from, entry.legal);
    const weakest = observation.weakest;
    const legal =
      moves && weakest
        ? legalRoutingActions(moves, weakest).map(action => ({
            action,
            move: transitionId(routingActionMove(action, moves, weakest)!.transition),
          }))
        : [];
    const named = (action: RoutingAction | null) => {
      if (!moves || !weakest) return null;
      try {
        const move = action === null ? plainMove(moves) : routingActionMove(action, moves, weakest);
        return move ? transitionId(move.transition) : null;
      } catch {
        return null;
      }
    };
    const parts = qStateParts(observation.qState);
    const row = parts ? (designated.table[observation.qState as RoutingQState] ?? null) : null;
    choices.push({
      index: choices.length,
      attempt,
      at,
      from,
      outcome: entry.cursorBefore?.outcome ?? stored.routing?.log[0]?.outcome ?? null,
      qState: observation.qState,
      parts,
      weakest,
      budget: { spent: observation.spent, size: observation.size, left: observation.budgetLeft },
      row,
      legal,
      masked: ROUTING_ACTIONS.filter(action => !legal.some(each => each.action === action)),
      action: observation.action,
      move: entry.move,
      checks: {
        table: observation.tableId === designated.tableId,
        row: sameOrder(observation.row, row),
        action: named(observation.action) === entry.move,
        legal: moves !== null,
      },
    });
  });
  return { choices, unasked };
};

/** Whether every check on every choice holds. */
export const qChecksHold = (choices: readonly QChoice[]) =>
  choices.every(choice => Object.values(choice.checks).every(Boolean));

// --- the pool -------------------------------------------------------------------------

/** One enrolled participant, as far as the table's visits read it. */
export interface QPoolAccount {
  code: string;
  cohort: StudyCohort;
  group: string | null;
  attempts: readonly StoredAttempt[];
}

export interface QStateVisits {
  /** Choices the table was asked to make in this state. */
  visits: number;
  /** How often each action was taken there; `plain` where the row ran out. */
  taken: Record<RoutingAction | 'plain', number>;
}

export interface QPoolVisits {
  /** Optimized participants counted. */
  accounts: number;
  choices: number;
  unasked: number;
  byState: Record<RoutingQState, QStateVisits>;
}

/** Which states the table read, and what it took, over every Optimized participant in the pool. */
export const qPoolVisits = (accounts: readonly QPoolAccount[], designated: DesignatedTable, graph: RoutingGraph): QPoolVisits => {
  const byState = Object.fromEntries(
    ROUTING_Q_STATES.map(state => [state, { visits: 0, taken: { none: 0, weakest: 0, related: 0, review: 0, plain: 0 } }])
  ) as Record<RoutingQState, QStateVisits>;
  const counted = accounts.filter(account => account.cohort === 'study' && account.group === 'optimized');
  let choices = 0;
  let unasked = 0;
  for (const account of counted) {
    const read = qChoices(account.attempts, designated, graph);
    unasked += read.unasked.length;
    for (const choice of read.choices) {
      const visits = byState[choice.qState as RoutingQState];
      if (!visits) continue;
      choices += 1;
      visits.visits += 1;
      visits.taken[choice.action ?? 'plain'] += 1;
    }
  }
  return { accounts: counted.length, choices, unasked, byState };
};
