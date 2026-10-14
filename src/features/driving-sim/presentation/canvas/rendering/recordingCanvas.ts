/**
 * A `CanvasRenderingContext2D` that records what was asked of it instead of
 * painting.
 *
 * Used to prove that moving scene composition out of the renderer changed
 * nothing on screen: the op stream from the old drawing pass and the op stream
 * from `renderFrame(buildScene(...))` must be identical. Test-support only.
 */
const GRADIENT_METHODS = new Set(['createLinearGradient', 'createRadialGradient', 'createPattern']);

/** Anything that reads back from the context, answered deterministically. */
const READBACK: Record<string, unknown> = {
  canvas: { width: 460, height: 700 },
};

export interface CanvasRecording {
  ops: string[];
  /** Order-sensitive digest of `ops`, cheap to store and compare. */
  digest: string;
}

const round = (value: unknown): unknown =>
  typeof value === 'number' ? Math.round(value * 1000) / 1000 : value;

const describe = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') return '{obj}';
  return String(round(value));
};

/** FNV-1a over the op stream: stable across runs and platforms. */
const digestOf = (ops: string[]): string => {
  let hash = 0x811c9dc5;
  for (const op of ops) {
    for (let i = 0; i < op.length; i++) {
      hash ^= op.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 10;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const recordingCanvasContext = () => {
  const ops: string[] = [];

  const gradient = {
    addColorStop: (offset: number, color: string) => {
      ops.push(`gradient.addColorStop(${describe(offset)},${describe(color)})`);
    },
  };

  const context = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key in READBACK) return READBACK[key];
        if (GRADIENT_METHODS.has(key)) {
          return (...args: unknown[]) => {
            ops.push(`${key}(${args.map(describe).join(',')})`);
            return gradient;
          };
        }
        if (key === 'measureText') {
          return (text: string) => {
            ops.push(`measureText(${text})`);
            return { width: text.length * 6 };
          };
        }
        return (...args: unknown[]) => {
          ops.push(`${key}(${args.map(describe).join(',')})`);
        };
      },
      set(_target, key: string, value: unknown) {
        ops.push(`${key}=${describe(value)}`);
        return true;
      },
    }
  );

  return {
    ctx: context as unknown as CanvasRenderingContext2D,
    recording: (): CanvasRecording => ({ ops, digest: digestOf(ops) }),
  };
};
