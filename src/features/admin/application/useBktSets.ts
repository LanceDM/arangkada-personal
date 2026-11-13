/**
 * The BKT value sets and pilot marks for the admin (2026-11-13): which set new
 * players get, every applied calibration with its log, the pilot marks and
 * their log, and which set each player runs on. Marking a player and applying
 * a calibration go through here.
 */
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import type { CalibrationRecord, PilotRef } from '@/features/admin/domain/bktCalibration';
import { EMPTY_BKT_SETS, modelOfPlayer, savedModels, setOfPlayer, type SavedValueSet } from '@/features/admin/domain/bktSetsAdmin';
import { adminDeps } from './dependencies';

const KEY = ['admin-bkt-sets'];

export const useBktSets = (enabled: boolean) => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => adminDeps().bktSets?.load() ?? Promise.resolve(EMPTY_BKT_SETS),
    enabled,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const data = query.data ?? EMPTY_BKT_SETS;
  const models = useMemo(() => savedModels(data.sets), [data.sets]);
  const pilotIds = useMemo(() => new Set(data.pilots.map(p => p.uid)), [data.pilots]);
  const refresh = () => client.invalidateQueries({ queryKey: KEY });

  return {
    ...data,
    models,
    pilotIds,
    loading: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    /** False while unwired (tests): marking and applying need the database. */
    wired: !!adminDeps().bktSets,
    setOf: (uid: string) => setOfPlayer(data, uid),
    modelOf: (uid: string): BKTModel => modelOfPlayer(data, models, uid),
    refresh,
    setPilot: async (player: PilotRef, on: boolean, adminUid: string) => {
      const repo = adminDeps().bktSets;
      if (!repo) throw new Error('The BKT value sets are not wired.');
      await repo.setPilot(player, on, adminUid);
      await refresh();
    },
    apply: async (record: CalibrationRecord, admin: { uid: string; email: string | null }): Promise<SavedValueSet> => {
      const repo = adminDeps().bktSets;
      if (!repo) throw new Error('The BKT value sets are not wired.');
      const saved = await repo.apply(record, data.state.number, admin);
      await refresh();
      return saved;
    },
  };
};

export type BktSets = ReturnType<typeof useBktSets>;
