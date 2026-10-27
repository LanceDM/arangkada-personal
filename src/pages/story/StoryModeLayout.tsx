/**
 * Story Mode's layout route, and the Legacy / New switch.
 *
 * It decides which game this player's Story Mode runs as, then hands the run
 * to it: `LegacyStoryRun`, today's game, or `RoutedStoryRun`, the routing FSM
 * in the player's group. Under the Legacy switch that is decided at once, so
 * Legacy mounts exactly as it always did; under the New switch a signed-in
 * player's assignment is read first.
 *
 * This is a layout route: whichever run it renders stays mounted across
 * `/play/story`, its briefing, its drive and its results, which is what lets
 * one attempt span four URLs.
 */
import { useEffect, useState } from 'react';
import { useAuthSession } from '@/features/auth';
import {
  loadRoutingOverride,
  resolveRoutingGroup,
  routingGroupNow,
  saveRoutingOverride,
  type RoutingGroupResolution,
  type RoutingOverride,
} from '@/features/driving-sim';
import LegacyStoryRun from './LegacyStoryRun';
import RoutedStoryRun from './RoutedStoryRun';
import type { StoryRouting } from './storyRunContext';

const StoryModeLayout = () => {
  const { user, isLoggedIn, isAdmin, loading } = useAuthSession();
  const uid = isLoggedIn && user ? user.uid : null;
  // Developers and admins may choose the group they play, for testing.
  const canOverride = import.meta.env.DEV || isAdmin;

  const [override, setOverrideState] = useState<RoutingOverride>(() => loadRoutingOverride(canOverride));
  const [overrideAllowed, setOverrideAllowed] = useState(canOverride);
  if (overrideAllowed !== canOverride) {
    setOverrideAllowed(canOverride);
    setOverrideState(loadRoutingOverride(canOverride));
  }

  const immediate = routingGroupNow({ uid, canOverride, authLoading: loading });
  const key = `${uid ?? 'guest'}:${canOverride}:${override}`;
  const needsLoad = immediate === null && !loading;
  const [loaded, setLoaded] = useState<{ key: string; resolution: RoutingGroupResolution } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!needsLoad) return;
    let cancelled = false;
    resolveRoutingGroup({ uid, canOverride })
      .then(resolution => {
        if (cancelled) return;
        setFailed(null);
        setLoaded({ key, resolution });
      })
      .catch(failure => {
        console.error('Failed to read the routing group:', failure);
        if (!cancelled) setFailed(key);
      });
    return () => {
      cancelled = true;
    };
  }, [needsLoad, key, uid, canOverride]);

  const resolution = immediate ?? (loaded?.key === key ? loaded.resolution : null);
  if (!resolution) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          {failed === key ? 'Your course could not be loaded. Check your connection and reload.' : 'Loading your course...'}
        </p>
      </div>
    );
  }

  const routing: StoryRouting = {
    resolution,
    canOverride,
    override,
    setOverride: next => {
      saveRoutingOverride(next);
      setOverrideState(next);
    },
  };

  return resolution.groupInEffect === 'legacy' ? (
    <LegacyStoryRun routing={routing} />
  ) : (
    <RoutedStoryRun
      key={`${uid ?? 'guest'}:${resolution.groupInEffect}`}
      routing={routing}
      uid={uid}
      group={resolution.groupInEffect}
    />
  );
};

export default StoryModeLayout;
