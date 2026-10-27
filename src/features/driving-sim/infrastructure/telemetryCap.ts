// Fitting a run's telemetry into Firestore documents.
//
// Pure and SDK-free (no firebase import), so the cap that keeps telemetry under
// Firestore's hard 1 MiB per-document limit is unit-testable on its own. A long,
// brake-heavy drive can log several thousand ~190-byte transitions (per-frame
// brake self-loops dominate), which at the extreme exceeds 1 MiB. The
// per-decision record is far smaller - one entry per graded decision - but a
// long run of standing penalties has no natural bound either, so it is held to
// the same budget the same way.
import type { TransitionLogEntry } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { FsmTelemetryDoc } from '@/features/driving-sim/domain/scoring/levelAttempt';
import type { DecisionTelemetryDoc } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import type { RoutingTelemetryDoc } from '@/features/driving-sim/domain/telemetry/routingTelemetry';

/** Bytes a value occupies as UTF-8 JSON - the unit Firestore's document limit counts. */
const jsonBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

/** Budget for a document's one long array, held under 1 MiB with room for the rest of the document. */
export const TELEMETRY_MAX_BYTES = 800_000;

/**
 * The longest chronological prefix of `items` whose JSON fits in `maxBytes`.
 *
 * The drive from its start, so early events and their approach->verdict pairs
 * stay intact, rather than a sample from anywhere in it.
 */
const chronologicalPrefix = <T>(items: readonly T[], maxBytes: number): T[] => {
  if (jsonBytes(items) <= maxBytes) return [...items];

  const kept: T[] = [];
  let acc = 2; // the array's own [] brackets
  for (const item of items) {
    acc += jsonBytes(item) + 1; // + one comma separator
    if (acc > maxBytes) break;
    kept.push(item);
  }
  return kept;
};

/**
 * Cap a transition log to a byte budget so it fits in one Firestore document.
 *
 * Flags `truncated` when the tail was dropped. The true pre-cap length is always
 * preserved as `totalCount` (and separately as fsmMetrics.totalTransitions on
 * the attempt), so an analyst can see that a stored array was shortened.
 */
export const capTransitionsForFirestore = (
  transitions: TransitionLogEntry[],
  maxBytes: number = TELEMETRY_MAX_BYTES
): FsmTelemetryDoc => {
  const kept = chronologicalPrefix(transitions, maxBytes);
  return { transitions: kept, truncated: kept.length < transitions.length, totalCount: transitions.length };
};

/**
 * Cap the routing record's log the same way. An attempt adds one or
 * two transitions, so this never binds in play; it holds the document to the
 * contract every telemetry document keeps. The header is kept whole.
 */
export const capRoutingForFirestore = (
  doc: RoutingTelemetryDoc,
  maxBytes: number = TELEMETRY_MAX_BYTES
): RoutingTelemetryDoc => {
  const kept = chronologicalPrefix(doc.log, maxBytes);
  return { ...doc, log: kept, truncated: doc.truncated || kept.length < doc.log.length, totalCount: doc.totalCount };
};

/**
 * Cap the per-decision record's decisions the same way. The header - the level
 * entry's decision, the route, the re-rolls - is kept whole: it is small, and
 * it is what every decision is read against.
 */
export const capDecisionsForFirestore = (
  doc: DecisionTelemetryDoc,
  maxBytes: number = TELEMETRY_MAX_BYTES
): DecisionTelemetryDoc => {
  const kept = chronologicalPrefix(doc.decisions, maxBytes);
  return {
    ...doc,
    decisions: kept,
    truncated: doc.truncated || kept.length < doc.decisions.length,
    totalCount: doc.totalCount,
  };
};
