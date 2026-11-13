/**
 * The admin's view of the BKT value sets (bktValueSets) and the pilot marks:
 * the saved calibrations with their logs, which players are pilot, every mark
 * and unmark, and which set each player runs on.
 */
import type { BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import { DEFAULT_SET_ID, modelOfSet, readModel, setIdOf, type BKTCalibrationState } from '@/domain/learner/mastery/bktValueSets';
import type { CalibrationRecord, PilotRef } from './bktCalibration';

/** `bktSets/cal-N`: an applied calibration and its log. */
export interface SavedValueSet extends CalibrationRecord {
  setId: string;
  number: number;
  appliedAt: number;
  appliedBy: string;
  appliedByEmail: string | null;
}

/** `bktPilots/{uid}`. */
export interface PilotMark extends PilotRef {
  markedAt: number;
  markedBy: string;
}

/** `bktPilotLog/{id}`. */
export interface PilotLogEntry extends PilotRef {
  action: 'marked' | 'unmarked';
  at: number;
  by: string;
}

export interface BktSetsData {
  state: BKTCalibrationState;
  /** Oldest first. */
  sets: SavedValueSet[];
  pilots: PilotMark[];
  /** Newest first. */
  pilotLog: PilotLogEntry[];
  /** The set each player's BKT record names (players with no record yet are absent). */
  playerSets: Record<string, string>;
}

/** Each saved set's values, by id, for the replays. */
export const savedModels = (sets: readonly SavedValueSet[]): Map<string, BKTModel> =>
  new Map(sets.flatMap(set => {
    const model = readModel(set.model);
    return model ? [[set.setId, model] as const] : [];
  }));

/**
 * The set a player runs on: the one on their BKT record, or, with no record yet
 * (nothing answered), the set new players get now.
 */
export const setOfPlayer = (data: Pick<BktSetsData, 'playerSets' | 'state'>, uid: string): string =>
  data.playerSets[uid] !== undefined ? setIdOf(data.playerSets[uid]) : data.state.activeSetId;

/** The values to replay a player's BKT with. */
export const modelOfPlayer = (data: Pick<BktSetsData, 'playerSets' | 'state'>, models: ReadonlyMap<string, BKTModel>, uid: string): BKTModel =>
  modelOfSet(setOfPlayer(data, uid), models);

export const EMPTY_BKT_SETS: BktSetsData = {
  state: { activeSetId: DEFAULT_SET_ID, number: 0, appliedAt: null, appliedBy: null },
  sets: [],
  pilots: [],
  pilotLog: [],
  playerSets: {},
};
