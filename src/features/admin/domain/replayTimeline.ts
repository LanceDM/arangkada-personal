/**
 * One attempt's driving-FSM log as a timeline the Replay section can step
 * through.
 *
 * A drive logs a transition for every frame the brake is held, so a log is
 * mostly runs of one self-loop. A run of consecutive identical self-loops
 * (same state, same trigger) is folded into one step that keeps its count and
 * its first and last time. A self-loop that happens once stays a step of its
 * own, so the self-edges that carry meaning and come one at a time -
 * `answer_correct`, the verdict, and `briefing_dismissed`, which restarts the
 * reaction clock - stay steps of their own. A change of state is never folded.
 *
 * The edge counts and visits are over the raw log, as kept: where the log was
 * cut to fit its document, they cover only what was kept.
 */
import { isInputTrigger, type FSMState, type FsmTelemetryDoc } from '@/features/driving-sim';

export interface TimelineStep {
  /** Position in the log of the step's first transition. */
  index: number;
  from: FSMState;
  to: FSMState;
  trigger: string;
  /** Transitions folded into this step: above 1 only for a run of one self-loop. */
  count: number;
  firstAt: number;
  lastAt: number;
  /** Milliseconds from the log's first transition to this step's first. */
  offsetMs: number;
  /** Milliseconds until the next step began; null for the last. */
  dwellMs: number | null;
  selfLoop: boolean;
  /** A self-loop on a player input: what the controls fire, `brake` on every frame it is held. */
  input: boolean;
  /** The competency the machine's snapshot carried. */
  competency: string;
  /** The θ in force (`approachScale`). */
  approachScale: number;
}

export interface FsmReplay {
  steps: TimelineStep[];
  /** Transitions kept in the document. */
  transitions: number;
  /** Transitions the drive logged, before any cut. */
  totalCount: number;
  truncated: boolean;
  /** Times each edge was taken, keyed by `edgeKey`. */
  edgeCounts: Record<string, number>;
  /** Times the machine changed into each state; a self-loop enters nothing. */
  visits: Partial<Record<FSMState, number>>;
  /** The state the log starts from. */
  initial: FSMState | null;
}

export const edgeKey = (from: FSMState, to: FSMState) => `${from}>${to}`;

/** An FSM record as read, or null where it does not have a log's shape. */
export const fsmLogOf = (doc: unknown): FsmTelemetryDoc | null =>
  doc && typeof doc === 'object' && Array.isArray((doc as FsmTelemetryDoc).transitions) ? (doc as FsmTelemetryDoc) : null;

export const fsmReplay = (fsm: FsmTelemetryDoc): FsmReplay => {
  const steps: TimelineStep[] = [];
  const edgeCounts: Record<string, number> = {};
  const visits: Partial<Record<FSMState, number>> = {};
  const start = fsm.transitions[0]?.timestamp ?? 0;

  fsm.transitions.forEach((entry, index) => {
    const key = edgeKey(entry.from, entry.to);
    edgeCounts[key] = (edgeCounts[key] ?? 0) + 1;
    const selfLoop = entry.from === entry.to;
    if (!selfLoop) visits[entry.to] = (visits[entry.to] ?? 0) + 1;

    const last = steps[steps.length - 1];
    if (selfLoop && last?.selfLoop && last.from === entry.from && last.trigger === entry.trigger) {
      last.count += 1;
      last.lastAt = entry.timestamp;
      return;
    }
    steps.push({
      index,
      from: entry.from,
      to: entry.to,
      trigger: entry.trigger,
      count: 1,
      firstAt: entry.timestamp,
      lastAt: entry.timestamp,
      offsetMs: entry.timestamp - start,
      dwellMs: null,
      selfLoop,
      input: selfLoop && isInputTrigger(entry.trigger),
      competency: entry.snapshot?.competency ?? 'unassigned',
      approachScale: entry.params?.approachScale ?? 1,
    });
  });
  for (let i = 0; i + 1 < steps.length; i++) steps[i].dwellMs = steps[i + 1].firstAt - steps[i].firstAt;

  return {
    steps,
    transitions: fsm.transitions.length,
    totalCount: fsm.totalCount,
    truncated: fsm.truncated,
    edgeCounts,
    visits,
    initial: fsm.transitions[0]?.from ?? null,
  };
};

/** The steps shown: every one, or all but the folded runs of player input. */
export const visibleSteps = (steps: readonly TimelineStep[], hideInputs: boolean): TimelineStep[] =>
  hideInputs ? steps.filter(step => !step.input) : [...steps];

/** Times each edge was taken up to and including `step`: the path so far. */
export const edgeCountsThrough = (steps: readonly TimelineStep[], step: TimelineStep | null): Record<string, number> => {
  const counts: Record<string, number> = {};
  if (!step) return counts;
  for (const each of steps) {
    if (each.index > step.index) break;
    const key = edgeKey(each.from, each.to);
    counts[key] = (counts[key] ?? 0) + each.count;
  }
  return counts;
};
