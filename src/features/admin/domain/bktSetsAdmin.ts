/**
 * The admin's view of the BKT value sets (bktValueSets) and the pilot marks:
 * the saved calibrations with their logs, which players are pilot, every mark
 * and unmark, and which set each player runs on.
 */
import type { BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import { DEFAULT_SET_ID, modelOfSet, readModel, setIdOf, withStart, type BKTCalibrationState } from '@/domain/learner/mastery/bktValueSets';
import type { CalibrationRecord, PilotRef } from './bktCalibration';

/**
 * `bktSetLogs/set-N`: an admin changed only the start before the pre-test
 * (2026-11-14). Everything else is the set it was based on.
 */
export interface StartEditRecord {
  kind: 'start';
  basedOn: string;
  model: BKTModel;
  previousStart: number;
  start: number;
  /** Always empty: no players were fitted. Kept so every set log has the same shape. */
  pilots: PilotRef[];
  note: string;
  settingsVersion: string;
}

export type ValueSetRecord = CalibrationRecord | StartEditRecord;

interface Applied {
  setId: string;
  number: number;
  appliedAt: number;
  appliedBy: string;
  appliedByEmail: string | null;
}

/** `bktSetLogs/{setId}`: an applied set and its log (admins only; players read `bktSets/{setId}`, the values alone). */
export type SavedValueSet = (CalibrationRecord & Applied) | (StartEditRecord & Applied);

export const isStartEdit = (set: ValueSetRecord): set is StartEditRecord => set.kind === 'start';

/** The log of a new edited start, from the set new players get now. */
export const startEditRecord = (input: {
  state: BKTCalibrationState;
  models: ReadonlyMap<string, BKTModel>;
  start: number;
  note: string;
  settingsVersion: string;
}): StartEditRecord => {
  const based = modelOfSet(input.state.activeSetId, input.models);
  return {
    kind: 'start',
    basedOn: input.state.activeSetId,
    model: withStart(based, input.start),
    previousStart: based.pInit,
    start: input.start,
    pilots: [],
    note: input.note,
    settingsVersion: input.settingsVersion,
  };
};

/** The start before the pre-test that players who start now get. */
export const startForNewPlayers = (state: BKTCalibrationState, models: ReadonlyMap<string, BKTModel>): number =>
  modelOfSet(state.activeSetId, models).pInit;

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
