/**
 * Routing records for the dashboard's tests, written by walking the real
 * routing FSM with the real policies, in the order the game's course routing
 * takes them: decide against the content, take the move, play the entry, then
 * take a review's return or a certification. Each attempt carries what the
 * game's routing record carries. The content is the machine's synthetic
 * probes, so nothing here depends on the levels.
 *
 * For tests only: nothing in the app imports it.
 */
import type { DrivingCompetency } from '@/domain/learner/competency';
import { plainMove, type RoutingChoice } from '@/domain/learner/adaptive/routingPolicy';
import {
  budgetLeft,
  isRoutingChoice,
  routingActionMove,
  routingQState,
  routingTablePolicy,
  type RoutingTable,
} from '@/domain/learner/adaptive/routingQPolicy';
import { probeContext, type ProbeName } from '@/domain/routing/characterizeRouting';
import { RoutingFSM } from '@/domain/routing/RoutingFSM';
import { legalTransitions } from '@/domain/routing/routingTable';
import {
  INITIAL_ROUTING_STATE,
  frontierLevel,
  stateId,
  transitionId,
  type CertifiedState,
  type FrontierState,
  type Outcome,
} from '@/domain/routing/routingTypes';
import type { RoutedEntryRecord, RoutingTelemetryDoc, StoredAttempt } from '@/features/driving-sim';

export interface FixtureEntry {
  /** The verdict this entry's drive gets. */
  outcome: Outcome;
  /** The content the move into this entry is decided against. */
  probe?: ProbeName;
  /** BKT's reading at the decision; null for no history yet. */
  weakest?: { competency: DrivingCompetency; score: number } | null;
  /** Graded decisions this entry spends. */
  decisions?: number;
  /** Played outside the machine instead. */
  outside?: 'free-replay' | 'post-test';
}

export interface FixtureCourse {
  group: 'conventional' | 'optimized';
  entries: readonly FixtureEntry[];
  table?: RoutingTable;
  tableId?: string;
  budgetSize?: number;
  t0?: number;
  idPrefix?: string;
}

const DEFAULT_WEAKEST = { competency: 'lane_discipline' as DrivingCompetency, score: 30 };

const routingDoc = (group: FixtureCourse['group'], entry: RoutedEntryRecord, log: RoutingTelemetryDoc['log']): RoutingTelemetryDoc => ({
  schemaVersion: 1,
  mode: 'new',
  assignedGroup: group,
  groupInEffect: group,
  override: false,
  options: {} as RoutingTelemetryDoc['options'],
  driving: { support: 'full', approachScale: 1, weakAreaRoll: false, liveReroll: false, practicePolicy: null },
  entry,
  play: null,
  log,
  truncated: false,
  totalCount: log.length,
});

const storedAttempt = (id: string, levelId: number, timestamp: number, routing: RoutingTelemetryDoc): StoredAttempt => ({
  id,
  attempt: { levelId, timestamp, finalScore: 0, violations: 0, correctDecisions: 0, logs: [] } as unknown as StoredAttempt['attempt'],
  fsm: null,
  decisions: null,
  routing,
});

/** The attempts one account saves playing `entries`, oldest first. */
export const playCourse = ({
  group,
  entries,
  table,
  tableId = 'fixture',
  budgetSize = 336,
  t0 = Date.UTC(2026, 9, 18, 1, 0, 0),
  idPrefix = 'a',
}: FixtureCourse): StoredAttempt[] => {
  let state: FrontierState | CertifiedState = INITIAL_ROUTING_STATE;
  let outcome: Outcome | null = null;
  let seq = 0;
  let spent = 0;
  return entries.map((played, index) => {
    const id = `${idPrefix}${index + 1}`;
    const at = t0 + index * 60_000;
    const decisions = played.decisions ?? 8;
    if (played.outside) {
      const entry: RoutedEntryRecord = {
        kind: played.outside, levelId: played.outside === 'post-test' ? 12 : 1, gradedDecisions: decisions, outcome: played.outcome,
        route: [], cursorBefore: null, cursorAfter: null, starts: null, move: null, legal: [], destination: null,
        item: null, review: null, decidedIn: null, observation: null,
      };
      return storedAttempt(id, entry.levelId, at, routingDoc(group, entry, []));
    }
    if (state.kind === 'CERTIFIED') throw new Error('the fixture course is already certified');

    const from: FrontierState = state;
    const fsm = new RoutingFSM(from);
    const weakest = played.weakest === undefined ? DEFAULT_WEAKEST : played.weakest;
    let legalIds: string[] = [];
    let move: string | null = null;
    let observation: RoutedEntryRecord['observation'] = null;
    if (outcome !== null) {
      const context = probeContext(played.probe ?? 'none', outcome);
      const legal = legalTransitions(from, context);
      const choice: RoutingChoice = { state: from, context, legal };
      const read = {
        weakest: weakest?.competency ?? null, weakestScore: weakest?.score ?? null, spent,
        size: null as number | null, budgetLeft: null as 'more' | 'less' | null,
        asked: false, qState: null as string | null, row: null as string[] | null, action: null as string | null, tableId: null as string | null,
      };
      let chosen = plainMove(legal);
      if (group === 'optimized') {
        const budget = { spent, size: budgetSize };
        Object.assign(read, { size: budgetSize, budgetLeft: budgetLeft(budget), tableId });
        if (weakest && table && isRoutingChoice(legal, weakest.competency)) {
          const observed = { weakest, budget };
          const qState = routingQState(choice, observed);
          chosen = routingTablePolicy(table)(choice, observed);
          const row = [...table[qState]];
          const action =
            row.find(candidate => {
              const named = routingActionMove(candidate, legal, weakest.competency);
              return named !== undefined && transitionId(named.transition) === transitionId(chosen.transition);
            }) ?? null;
          Object.assign(read, { asked: true, qState, row, action });
        }
      }
      observation = read as RoutedEntryRecord['observation'];
      if (!fsm.take(chosen.transition, context)) throw new Error('the fixture asked for an unlisted move');
      legalIds = legal.map(each => transitionId(each.transition));
      move = transitionId(chosen.transition);
    } else {
      observation = {
        weakest: weakest?.competency ?? null, weakestScore: weakest?.score ?? null, spent, size: null, budgetLeft: null,
        asked: false, qState: null, row: null, action: null, tableId: null,
      };
    }

    const into = fsm.getState();
    if (into.kind === 'CERTIFIED') throw new Error('nothing is played at CERTIFIED');
    const levelId = into.kind === 'REVIEW' ? into.level : frontierLevel(into);
    const transition = fsm.getTransitionLog()[0]?.transition ?? null;
    const item =
      transition && (transition.kind === 'advance' || transition.kind === 'retry') && transition.practice
        ? { competency: transition.practice, scenarioId: `level1.practice.${transition.practice}`, sourceLevelId: 1 }
        : null;
    const review = transition?.kind === 'review' ? { level: transition.level, competency: transition.competency } : null;

    const settled = probeContext('none', played.outcome);
    if (into.kind === 'REVIEW') fsm.take({ kind: 'return' }, settled);
    else if (into.kind === 'FINAL' && played.outcome === 'passed') fsm.take({ kind: 'certify' }, settled);
    const after = fsm.getState() as FrontierState | CertifiedState;
    const log = fsm.getTransitionLog().map(logged => ({ ...logged, seq: seq + logged.seq, at }));
    const nextOutcome = into.kind === 'REVIEW' || after.kind === 'CERTIFIED' ? null : played.outcome;

    const entry: RoutedEntryRecord = {
      kind: into.kind === 'REVIEW' ? 'review' : 'course',
      levelId,
      gradedDecisions: decisions,
      outcome: played.outcome,
      route: [],
      cursorBefore: { state: stateId(from), outcome, seq, decisionsSpent: spent },
      cursorAfter: { state: stateId(after), outcome: nextOutcome, seq: seq + log.length, decisionsSpent: spent + decisions },
      starts: 1,
      move,
      legal: legalIds,
      destination: move ? levelId : null,
      item,
      review,
      decidedIn: group,
      observation,
    };
    seq += log.length;
    spent += decisions;
    state = after;
    outcome = nextOutcome;
    return storedAttempt(id, levelId, at, routingDoc(group, entry, log));
  });
};

/** The account's whole routing log, as the export puts it together: every attempt's entries in `seq` order. */
export const routingLogOf = (attempts: readonly StoredAttempt[]) =>
  attempts.flatMap(stored => stored.routing?.log ?? []).sort((a, b) => a.seq - b.seq);
