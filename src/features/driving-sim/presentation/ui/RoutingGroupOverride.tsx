import type { RoutingOverride } from '@/features/driving-sim/application/ports';
import type { RoutingGroupResolution } from '@/features/driving-sim/application/use-cases/resolveRoutingGroup';

interface RoutingGroupOverrideProps {
  resolution: RoutingGroupResolution;
  value: RoutingOverride;
  onChange: (override: RoutingOverride) => void;
}

const LABELS: Record<RoutingOverride, string> = {
  assigned: 'As assigned',
  legacy: 'Legacy (today’s game)',
  conventional: 'Conventional (plain routing)',
  optimized: 'Optimized (learned routing)',
};

/**
 * Developers and admins only: which game their own Story Mode runs as, for
 * testing. It is kept in this browser, recorded on every attempt as
 * an override, and never changes the group an admin assigned.
 */
const RoutingGroupOverride = ({ resolution, value, onChange }: RoutingGroupOverrideProps) => (
  <div className="w-full max-w-md rounded-xl border border-dashed border-signal-amber/60 bg-signal-amber/5 px-4 py-3 text-left">
    <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-signal-amber">
      Testing: routing group
    </p>
    <p className="mt-1 text-xs text-muted-foreground">
      Switch: {resolution.mode} · assigned: {resolution.assignedGroup ?? 'none'} · in effect: {resolution.groupInEffect}
    </p>
    <select
      aria-label="Routing group override"
      value={value}
      onChange={event => onChange(event.target.value as RoutingOverride)}
      className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
    >
      {(Object.keys(LABELS) as RoutingOverride[]).map(option => (
        <option key={option} value={option}>
          {LABELS[option]}
        </option>
      ))}
    </select>
  </div>
);

export default RoutingGroupOverride;
