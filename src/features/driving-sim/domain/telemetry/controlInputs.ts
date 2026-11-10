/**
 * Every control input of a drive: each key pressed and released on the road,
 * with its time from the start of the drive. Saved beside the attempt as
 * `telemetry/inputs`, so the drive can be reconstructed key by key.
 *
 * Auto-repeat is not an input: a held key is one press and one release.
 */
import type { ActionLog } from '@/domain/learner/attempt';

export interface ControlInput {
  /** Milliseconds since the drive's screen mounted. */
  t: number;
  /** The key, as the browser names it (`ArrowUp`, `w`, ` `...). */
  key: string;
  /** true: pressed; false: released. */
  down: boolean;
}

/** What a drive left unfinished hands back: everything done so far. */
export interface DriveExit {
  logs: ActionLog[];
  score: number;
  stage: 'garage' | 'driving' | 'aftermath';
  elapsedMs: number;
  inputs: ControlInput[];
  /** `exit`: the Exit button; `page_closed`: the tab was closed or reloaded mid-drive (best effort). */
  reason: 'exit' | 'page_closed';
}

export interface InputTelemetryDoc {
  schemaVersion: 1;
  inputs: ControlInput[];
  /** True when the trace was longer than one document holds; the earliest inputs are kept. */
  truncated: boolean;
  totalCount: number;
}

/** About 30 bytes an input: 20,000 stays well under Firestore's 1 MiB document limit. */
export const MAX_STORED_INPUTS = 20_000;

/** Records presses and releases; repeats of a held key are dropped. */
export const createInputRecorder = (now: () => number = () => performance.now()) => {
  const start = now();
  const held = new Set<string>();
  const inputs: ControlInput[] = [];
  return {
    press(key: string) {
      if (held.has(key)) return;
      held.add(key);
      inputs.push({ t: Math.round(now() - start), key, down: true });
    },
    release(key: string) {
      if (!held.delete(key)) return;
      inputs.push({ t: Math.round(now() - start), key, down: false });
    },
    elapsedMs: () => Math.round(now() - start),
    snapshot: (): ControlInput[] => [...inputs],
  };
};

export type InputRecorder = ReturnType<typeof createInputRecorder>;

/** The document saved for a drive's inputs. */
export const inputTelemetryDoc = (inputs: readonly ControlInput[], max: number = MAX_STORED_INPUTS): InputTelemetryDoc => ({
  schemaVersion: 1,
  inputs: inputs.slice(0, max),
  truncated: inputs.length > max,
  totalCount: inputs.length,
});

/** A short summary for the event stream: presses per key and the drive's length. */
export const summarizeInputs = (inputs: readonly ControlInput[]) => {
  const presses: Record<string, number> = {};
  for (const input of inputs) if (input.down) presses[input.key] = (presses[input.key] ?? 0) + 1;
  return { presses, total: inputs.filter(i => i.down).length };
};
