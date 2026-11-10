/** How the Replay section writes times and the guard's scale. */

/** "+12.3 s", "+2 m 05 s". */
export const offsetLabel = (ms: number) => {
  if (ms < 60_000) return `+${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `+${Math.floor(seconds / 60)} m ${String(seconds % 60).padStart(2, '0')} s`;
};

/** "0.4 s", "5 m 40 s". */
export const durationLabel = (ms: number | null) => {
  if (ms === null) return '-';
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} m ${String(seconds % 60).padStart(2, '0')} s`;
};

/** θ to two places at most: "1", "1.38". */
export const thetaLabel = (value: number) => String(Math.round(value * 100) / 100);

/** A machine state as words: "REACTION_WINDOW" is "REACTION WINDOW". */
export const stateLabel = (state: string) => state.replace(/_/g, ' ');
