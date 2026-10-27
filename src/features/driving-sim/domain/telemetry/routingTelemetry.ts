/**
 * Routing telemetry: which group an attempt was played in, under which rules,
 * and - for a course entry - what the routing FSM was told, which moves it
 * listed, which one was taken and why.
 *
 * Stored at `users/{uid}/attempts/{id}/telemetry/routing`, beside the raw FSM
 * log and the per-decision record, never inline on the attempt, for every
 * signed-in attempt in every mode, Legacy included. A player's whole routing
 * log is the concatenation of these documents' `log`s in `seq` order: each
 * holds the transitions its own attempt added, stamped with when they were
 * written (the machine's own log carries no time). Everything here is
 * JSON-safe: no `undefined`.
 */
import type { SupportLevel } from '@/domain/learner/competency';
import type { RoutingLogEntry } from '@/domain/routing/routingTypes';
import { stateId, transitionId } from '@/domain/routing/routingTypes';
import type { AdaptiveOptions } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import type {
  CourseEntry,
  CourseObservation,
  GroupInEffect,
  PlacedItem,
  RoutingCursor,
  RoutingGroup,
} from '@/features/driving-sim/domain/adaptive/courseRouting';

export const ROUTING_TELEMETRY_SCHEMA_VERSION = 1;

/** The Legacy / New switch the build was made with. */
export type RoutingMode = 'legacy' | 'new';

/**
 * Which kind of entry an attempt was. A `post-test` is the pilot's common
 * post-test: the final exam, played outside the machine on one
 * fixed roll for every participant.
 */
export type RoutedEntryKind = 'course' | 'review' | 'free-replay' | 'post-test';

/** A routing log entry as stored: the machine's entry, numbered for the player's whole log, with when it was written. */
export type RoutingLogRecord = RoutingLogEntry & { at: number };

/** A cursor as the record names it. */
export interface CursorRecord {
  state: string;
  outcome: RoutingCursor['outcome'];
  seq: number;
  decisionsSpent: number;
}

export interface RoutedEntryRecord {
  kind: RoutedEntryKind;
  levelId: number;
  /** Graded decisions in this attempt, standing penalties excluded: what it spends of the learned policy's budget. */
  gradedDecisions: number;
  /** The verdict the routing FSM was handed: the level's pass mark, a crash counting as a fail. */
  outcome: RoutingCursor['outcome'];
  /** The route as rolled, before anything was appended. */
  route: string[];
  /** The rest is a course entry's alone; a free replay records none of it. */
  cursorBefore: CursorRecord | null;
  cursorAfter: CursorRecord | null;
  /** How many times this entry was entered: above 1, it was left unfinished and entered again. */
  starts: number | null;
  /** The move taken into this entry, by id; null where none was taken. */
  move: string | null;
  /** Every move that was legal beside it. */
  legal: string[];
  destination: number | null;
  item: PlacedItem | null;
  review: { level: number; competency: string } | null;
  /** The group the move was decided in, which a resumed entry keeps. */
  decidedIn: RoutingGroup | null;
  observation: CourseObservation | null;
}

/** `users/{uid}/attempts/{id}/telemetry/routing`. */
export interface RoutingTelemetryDoc {
  schemaVersion: typeof ROUTING_TELEMETRY_SCHEMA_VERSION;
  mode: RoutingMode;
  /** The group an admin assigned this player; null where none was. */
  assignedGroup: RoutingGroup | null;
  groupInEffect: GroupInEffect;
  /** A developer or admin chose the group in effect for their own testing. */
  override: boolean;
  /** The adaptive options the attempt was played under. */
  options: AdaptiveOptions;
  /** The driving settings the attempt was played at. */
  driving: {
    support: SupportLevel;
    approachScale: number;
    weakAreaRoll: boolean;
    liveReroll: boolean;
    /** The practice policy's table, where it was consulted: Legacy's alone. */
    practicePolicy: string | null;
  };
  /** Null for a Legacy attempt, which the routing FSM did not move. */
  entry: RoutedEntryRecord | null;
  log: RoutingLogRecord[];
  /** The log was cut to fit one Firestore document; `totalCount` is how long it was. */
  truncated: boolean;
  totalCount: number;
}

const cursorRecord = (cursor: RoutingCursor): CursorRecord => ({
  state: stateId(cursor.state),
  outcome: cursor.outcome,
  seq: cursor.seq,
  decisionsSpent: cursor.decisionsSpent,
});

/** What a course entry did, from the cursor it was entered at to the one it left. */
export const recordCourseEntry = ({
  entry,
  before,
  after,
  outcome,
  gradedDecisions,
}: {
  entry: CourseEntry;
  before: RoutingCursor;
  after: RoutingCursor;
  outcome: NonNullable<RoutingCursor['outcome']>;
  gradedDecisions: number;
}): RoutedEntryRecord => ({
  kind: entry.review ? 'review' : 'course',
  levelId: entry.levelId,
  gradedDecisions,
  outcome,
  route: entry.rolled.events.map(event => event.id),
  cursorBefore: cursorRecord(before),
  cursorAfter: cursorRecord(after),
  starts: entry.pending.starts,
  move: entry.pending.transition && transitionId(entry.pending.transition),
  legal: [...entry.legal],
  destination: entry.destination,
  item: entry.item && { ...entry.item },
  review: entry.review && { ...entry.review },
  decidedIn: entry.pending.group,
  observation: { ...entry.pending.observation, row: entry.pending.observation.row && [...entry.pending.observation.row] },
});

/**
 * A free replay, or the pilot's post-test: played outside the machine, so it
 * records only what was played.
 */
export const recordFreeReplay = ({
  levelId,
  route,
  outcome,
  gradedDecisions,
  kind = 'free-replay',
}: {
  levelId: number;
  route: string[];
  outcome: NonNullable<RoutingCursor['outcome']>;
  gradedDecisions: number;
  kind?: 'free-replay' | 'post-test';
}): RoutedEntryRecord => ({
  kind,
  levelId,
  gradedDecisions,
  outcome,
  route: [...route],
  cursorBefore: null,
  cursorAfter: null,
  starts: null,
  move: null,
  legal: [],
  destination: null,
  item: null,
  review: null,
  decidedIn: null,
  observation: null,
});

export const buildRoutingTelemetry = ({
  log,
  at,
  ...rest
}: Omit<RoutingTelemetryDoc, 'schemaVersion' | 'log' | 'truncated' | 'totalCount'> & {
  log: readonly RoutingLogEntry[];
  at: number;
}): RoutingTelemetryDoc => ({
  schemaVersion: ROUTING_TELEMETRY_SCHEMA_VERSION,
  ...rest,
  log: log.map(logged => ({ ...logged, at })),
  truncated: false,
  totalCount: log.length,
});
