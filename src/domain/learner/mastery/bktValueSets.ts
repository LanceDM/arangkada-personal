/**
 * BKT value sets (2026-11-13). A player runs on one set of BKT values for
 * their whole course: the set in force when they started, marked on their BKT
 * record (`modelSet`) and never changed after.
 *
 * - `default`: the published values in the code (`DEFAULT_BKT_MODEL`).
 * - `cal-1`, `cal-2`, ...: calibrations an admin applied, each fitted on the
 *   pre-test, quiz and drive answers of the players marked pilot, and saved in
 *   the database (`bktSets/{setId}`) where it can never be edited.
 *
 * - `set-1`, `set-2`, ...: an edited start (2026-11-14): the set in force with
 *   only the starting value before the pre-test, P(L0), changed by an admin.
 *
 * Calibrations and edited starts share one count: after `cal-1` the next is
 * `cal-2` or `set-2`. So pilot-stage players keep X to the end, players who
 * start after the next set keep Y to the end, and so on. Which set new players
 * get is `bktCalibration/state`.
 */
import { DEFAULT_BKT_MODEL, type BKTModel } from './buildBKTProfile';

export const DEFAULT_SET_ID = 'default';

/** Players marked pilot, with pre-test answers, needed before a calibration can be applied (Tentative). */
export const MIN_PILOT_PLAYERS = 7;

export const calibratedSetId = (number: number): string => `cal-${number}`;

/** An edited start's id. */
export const editedStartSetId = (number: number): string => `set-${number}`;

/**
 * What the admin may set the start before the pre-test to: strictly between 0
 * and 1, kept off the ends so one answer can still move it.
 */
export const START_LIMITS = { min: 0.01, max: 0.99 } as const;

/** The range published BKT fits keep P(L0) in (Zhang et al., 2025); outside it is allowed but flagged. */
export const PUBLISHED_START_RANGE = { min: 0.001, max: 0.5 } as const;

/** What is wrong with a start an admin typed; an empty list means it can be saved. */
export const startProblems = (value: number): string[] =>
  !Number.isFinite(value)
    ? ['Enter a number, such as 0.30.']
    : value < START_LIMITS.min || value > START_LIMITS.max
      ? [`The start must be from ${START_LIMITS.min} to ${START_LIMITS.max}.`]
      : [];

/**
 * A set's values with a new start before the pre-test. Any per-competency
 * starts a calibration fitted are dropped: the admin's one value applies to
 * every competency.
 */
export const withStart = (model: BKTModel, pInit: number): BKTModel => {
  const next: BKTModel = { ...model, pInit };
  delete next.pInitBy;
  return next;
};

/**
 * The set a record names. A record with no mark, or the mark `pilot` (written
 * for about an hour on 2026-11-13, before calibrations had numbers), ran on
 * the published values.
 */
export const setIdOf = (mark: string | null | undefined): string => (!mark || mark === 'pilot' ? DEFAULT_SET_ID : mark);

/** How a set is named on screen. */
export const setLabel = (setId: string): string => {
  const id = setIdOf(setId);
  if (id === DEFAULT_SET_ID) return 'Default values';
  const n = /^cal-(\d+)$/.exec(id);
  if (n) return `Calibration ${n[1]}`;
  const e = /^set-(\d+)$/.exec(id);
  return e ? `Edited start ${e[1]}` : id;
};

/** `bktCalibration/state`: which set new players get. Absent until the first calibration. */
export interface BKTCalibrationState {
  activeSetId: string;
  /** How many calibrations have been applied; 0 before the first. */
  number: number;
  appliedAt: number | null;
  appliedBy: string | null;
}

export const NO_CALIBRATION: BKTCalibrationState = { activeSetId: DEFAULT_SET_ID, number: 0, appliedAt: null, appliedBy: null };

export const readCalibrationState = (data: Record<string, unknown> | undefined | null): BKTCalibrationState =>
  data && typeof data.activeSetId === 'string' && typeof data.number === 'number'
    ? {
        activeSetId: data.activeSetId,
        number: data.number,
        appliedAt: typeof data.appliedAt === 'number' ? data.appliedAt : null,
        appliedBy: typeof data.appliedBy === 'string' ? data.appliedBy : null,
      }
    : NO_CALIBRATION;

/** A set's values: the default set, or a saved one; a set that cannot be found falls back to the default. */
export const modelOfSet = (setId: string, saved: ReadonlyMap<string, BKTModel>): BKTModel =>
  setIdOf(setId) === DEFAULT_SET_ID ? DEFAULT_BKT_MODEL : (saved.get(setIdOf(setId)) ?? DEFAULT_BKT_MODEL);

/** Reads a saved set's `model` field back into a full model; null when it is not one. */
export const readModel = (value: unknown): BKTModel | null => {
  const m = value as Partial<BKTModel> | null;
  const params = (p: unknown) => {
    const q = p as Record<string, unknown> | null;
    return !!q && typeof q.pTransit === 'number' && typeof q.pSlip === 'number' && typeof q.pGuess === 'number';
  };
  if (!m || typeof m.pInit !== 'number' || !params(m.drive) || !params(m.quiz) || !params(m.diagnostic) || !params(m.post_exam)) return null;
  return {
    pInit: m.pInit,
    ...(m.pInitBy && typeof m.pInitBy === 'object' ? { pInitBy: m.pInitBy } : {}),
    drive: m.drive!,
    quiz: m.quiz!,
    diagnostic: m.diagnostic!,
    post_exam: m.post_exam!,
  };
};
