/**
 * Which game a player's Story Mode runs as.
 *
 * - The Legacy switch: today's game, for everyone.
 * - The New switch: the routing FSM, in the group an admin pre-assigned the
 *   player. A signed-in player with no assignment, and every guest, plays the
 *   Conventional group and is recorded as unassigned: not a pilot participant.
 *
 * Admin test mode, set in the admin area: an admin may
 * choose a group for their own account's testing. The choice lives in this
 * browser, is recorded on every attempt as an override, never touches the
 * stored assignment, and is never read for a study participant, in
 * any build.
 */
import type { GroupInEffect, RoutingGroup } from '@/features/driving-sim/domain/adaptive/courseRouting';
import type { RoutingMode } from '@/features/driving-sim/domain/telemetry/routingTelemetry';
import { drivingSimDeps } from '../dependencies';
import type { RoutingAssignment, RoutingOverride } from '../ports';

export interface RoutingGroupResolution {
  mode: RoutingMode;
  /** The admin's assignment; null for a guest, an unassigned player, or under the Legacy switch, which reads none. */
  assignedGroup: RoutingGroup | null;
  groupInEffect: GroupInEffect;
  /** The group in effect was chosen by a developer or admin rather than assigned. */
  override: boolean;
}

const resolve = (mode: RoutingMode, assignment: RoutingAssignment | null, override: RoutingOverride): RoutingGroupResolution => {
  const base: GroupInEffect = mode === 'legacy' ? 'legacy' : assignment?.group ?? 'conventional';
  return {
    mode,
    assignedGroup: assignment?.group ?? null,
    groupInEffect: override === 'assigned' ? base : override,
    override: override !== 'assigned',
  };
};

/**
 * Whether admin test mode applies to this account: an admin's own, never a
 * study participant's, even one that somehow carried the admin claim. A
 * developer build grants nothing by itself.
 */
export const adminTestModeAllowed = ({ isAdmin, studyAccount }: { isAdmin: boolean; studyAccount: boolean }): boolean =>
  isAdmin && !studyAccount;

export const loadRoutingOverride = (canOverride: boolean): RoutingOverride =>
  canOverride ? drivingSimDeps().routingOverride.load() : 'assigned';

export const saveRoutingOverride = (override: RoutingOverride): void => drivingSimDeps().routingOverride.save(override);

/**
 * The resolution where nothing has to be read from storage, or null where the
 * player's assignment must be loaded first: the New switch, signed in or not
 * yet known to be signed out. Under the Legacy switch with no override this is
 * today's game, at once, as before.
 */
export const routingGroupNow = ({
  uid,
  canOverride,
  authLoading,
}: {
  uid: string | null;
  canOverride: boolean;
  authLoading: boolean;
}): RoutingGroupResolution | null => {
  const { routingMode } = drivingSimDeps();
  if (routingMode === 'new' && (uid || authLoading)) return null;
  return resolve(routingMode, null, loadRoutingOverride(canOverride));
};

export const resolveRoutingGroup = async ({ uid, canOverride }: { uid: string | null; canOverride: boolean }): Promise<RoutingGroupResolution> => {
  const { routingMode, routing } = drivingSimDeps();
  const assignment = routingMode === 'new' && uid ? await routing.loadAssignment(uid) : null;
  return resolve(routingMode, assignment, loadRoutingOverride(canOverride));
};
