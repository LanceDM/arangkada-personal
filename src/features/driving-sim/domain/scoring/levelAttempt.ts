/**
 * One recorded drive, as persisted. `users/{uid}/attempts/{id}` is append-only:
 * the ladder's "best so far" lives in Progression's summary document, and this
 * collection is the evidence stream the learner model replays.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { FsmMetrics, ReactionLatency } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import type { TransitionLogEntry } from '@/features/driving-sim/domain/fsm/fsmTypes';

export interface LevelAttempt {
  levelId: number;
  timestamp: number;
  finalScore: number;
  violations: number;
  correctDecisions: number;
  logs: ActionLog[];
  /**
   * FSM telemetry, summary half — verdict/accuracy/recovery/crash counts,
   * per-state visits, and the per-decision reaction latencies θ is meant to
   * move. Small enough to store inline. The raw transition log is deliberately
   * NOT here: it is large and lives in the attempt's `telemetry/fsm`
   * subdocument, so the bulk reads of this collection (BKT history, admin)
   * stay cheap. Optional because a pre-telemetry attempt may not carry it.
   */
  fsmMetrics?: FsmMetrics;
  reactionLatencies?: ReactionLatency[];
}

/**
 * `users/{uid}/attempts/{id}/telemetry/fsm` — the raw FSM transition log.
 *
 * `transitions` is byte-capped on write to stay under Firestore's 1 MiB
 * per-document limit; `truncated` says whether the cap dropped the tail, and
 * `totalCount` is the true pre-cap length.
 */
export interface FsmTelemetryDoc {
  transitions: TransitionLogEntry[];
  truncated: boolean;
  totalCount: number;
}
