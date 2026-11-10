/**
 * The Optimized group's routing table, for the Q-learning mapping: read from
 * the same results file the game reads it from, and checked by the same
 * function, `designatedRoutingPolicyOf`, which refuses a table that does not
 * hash to the id the file records. The file is loaded once per tab, in a chunk
 * of its own; nothing is read from the database.
 */
import { useEffect, useState } from 'react';
import { designatedRoutingPolicyOf, type DesignatedRoutingPolicy } from '@/features/admin/domain/designatedRoutingPolicy';

let loading: Promise<DesignatedRoutingPolicy> | null = null;

export const loadDesignatedTable = (): Promise<DesignatedRoutingPolicy> => {
  loading ??= import('@/features/admin/domain/designatedRoutingTable.json')
    .then(module => designatedRoutingPolicyOf(module.default))
    .catch(error => {
      loading = null;
      throw error;
    });
  return loading;
};

export type DesignatedTableState =
  | { status: 'loading' }
  | { status: 'ready'; table: DesignatedRoutingPolicy }
  | { status: 'error'; error: string };

export const useDesignatedTable = (enabled: boolean): DesignatedTableState => {
  const [state, setState] = useState<DesignatedTableState>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    loadDesignatedTable().then(
      table => current && setState({ status: 'ready', table }),
      error => current && setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    );
    return () => {
      current = false;
    };
  }, [enabled]);
  return state;
};
