/**
 * Which BKT values a player runs on (bktValueSets, 2026-11-13): the set in
 * force when they started, kept for their whole course. Until the first
 * calibration is applied every player runs on the default values and nothing
 * beyond the (cached) calibration state is read.
 */
import { DEFAULT_BKT_MODEL, type BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import { DEFAULT_SET_ID, setIdOf } from '@/domain/learner/mastery/bktValueSets';
import { drivingSimDeps } from './dependencies';

/** The set a player starting now is marked with. */
export const setForNewPlayer = async (): Promise<string> => {
  const repo = drivingSimDeps().bktSets;
  return repo ? (await repo.state()).activeSetId : DEFAULT_SET_ID;
};

/** A set's values. A saved set that cannot be read falls back to the default values, and says so. */
export const valuesOfSet = async (setId: string): Promise<BKTModel> => {
  const id = setIdOf(setId);
  if (id === DEFAULT_SET_ID) return DEFAULT_BKT_MODEL;
  const repo = drivingSimDeps().bktSets;
  const model = repo ? await repo.load(id) : null;
  if (!model) console.error(`BKT value set ${id} could not be read; the default values were used.`);
  return model ?? DEFAULT_BKT_MODEL;
};

/** The values this account runs on: the set on its BKT record, or, before it has one, the set new players get. */
export const valuesForPlayer = async (uid: string): Promise<BKTModel> => {
  const repo = drivingSimDeps().bktSets;
  if (!repo) return DEFAULT_BKT_MODEL;
  try {
    const state = await repo.state();
    if (state.number === 0) return DEFAULT_BKT_MODEL;
    const profile = await drivingSimDeps().bktLog.loadProfile(uid);
    return await valuesOfSet(profile ? setIdOf(profile.modelSet) : state.activeSetId);
  } catch (failure) {
    // A read that fails must not stop a quiz or a drive from saving.
    console.error('Could not read the BKT value set; the default values were used:', failure);
    return DEFAULT_BKT_MODEL;
  }
};
