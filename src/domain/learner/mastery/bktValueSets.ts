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
 * So pilot-stage players keep X to the end, players who start after
 * Calibration 1 keep Y to the end, after Calibration 2 keep Z, and so on.
 * Which set new players get is `bktCalibration/state`.
 */
import { DEFAULT_BKT_MODEL, type BKTModel } from './buildBKTProfile';

export const DEFAULT_SET_ID = 'default';

/** Players marked pilot, with pre-test answers, needed before a calibration can be applied (Tentative). */
export const MIN_PILOT_PLAYERS = 7;

export const calibratedSetId = (number: number): string => `cal-${number}`;

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
  return n ? `Calibration ${n[1]}` : id;
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
