/** A developer's or admin's choice of routing group for their own testing: one localStorage key. */
import type { RoutingOverride, RoutingOverrideRepository } from '@/features/driving-sim/application/ports';

const STORAGE_KEY = 'arangkada_routing_override';
const VALUES: readonly RoutingOverride[] = ['assigned', 'legacy', 'conventional', 'optimized'];

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const localRoutingOverrideRepository: RoutingOverrideRepository = {
  load() {
    if (!isBrowser()) return 'assigned';
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return VALUES.includes(raw as RoutingOverride) ? (raw as RoutingOverride) : 'assigned';
    } catch {
      return 'assigned';
    }
  },

  save(override) {
    if (!isBrowser()) return;
    try {
      if (override === 'assigned') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, override);
    } catch {
      // Storage blocked: the override lasts no longer than this page.
    }
  },
};
