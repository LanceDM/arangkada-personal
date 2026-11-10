/**
 * `/admin/test-mode`: admin test mode, moved here from the Story map, inside
 * the admin area's layout, which checks the admin. An admin chooses which game
 * their own Story Mode runs as, for testing.
 * Off by default, kept in this browser, recorded on every attempt as an
 * override, and never applied to a pilot pool account.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/shared/ui/button';
import { Panel, SectionHeader } from '@/features/admin';
import { useAuthSession } from '@/features/auth';
import {
  RoutingGroupOverride,
  adminTestModeAllowed,
  loadRoutingOverride,
  resolveRoutingGroup,
  saveRoutingOverride,
  type RoutingGroupResolution,
  type RoutingOverride,
} from '@/features/driving-sim';

const TestModePage = () => {
  const { user, isAdmin, studyAccount } = useAuthSession();
  const allowed = adminTestModeAllowed({ isAdmin, studyAccount });
  const uid = user?.uid ?? null;
  const [override, setOverride] = useState<RoutingOverride>(() => loadRoutingOverride(allowed));
  const [resolution, setResolution] = useState<{ key: string; value: RoutingGroupResolution } | null>(null);
  const key = `${uid}:${allowed}:${override}`;

  useEffect(() => {
    if (!allowed || !uid) return;
    let cancelled = false;
    resolveRoutingGroup({ uid, canOverride: true })
      .then(value => {
        if (!cancelled) setResolution({ key, value });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowed, uid, key]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Test mode"
        description="Plays your own Story Mode as another group, for testing. It applies only to your admin account in this browser, is recorded on every attempt you play as an override, and never changes an assigned group. Starting a participant on this device turns it off, and it never applies to a pilot account."
      />
      <Panel className="max-w-xl" bodyClassName="space-y-4 text-sm text-muted-foreground">
        {allowed ? (
          <RoutingGroupOverride
            resolution={resolution?.key === key ? resolution.value : null}
            value={override}
            onChange={next => {
              saveRoutingOverride(next);
              setOverride(next);
            }}
          />
        ) : (
          <p className="text-destructive">Admin test mode is not available to this account.</p>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/play/story">Story Mode</Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
};

export default TestModePage;
