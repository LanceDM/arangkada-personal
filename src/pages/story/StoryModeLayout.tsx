/**
 * Story Mode's layout route, and the Legacy / New switch. Under New every
 * signed-in participant plays the per-competency course (`CompetencyStoryRun`);
 * the old two-group run (`RoutedStoryRun`) is no longer mounted.
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
import { Say } from '@/shared/i18n/language';
import { storyMessages as m } from './messages';
import { useEffect, useState } from 'react';
import { useAuthModal, useAuthSession } from '@/features/auth';
import {
  adminTestModeAllowed,
  loadRoutingOverride,
  resolveRoutingGroup,
  routingGroupNow,
  type RoutingGroupResolution,
} from '@/features/driving-sim';
import LegacyStoryRun from './LegacyStoryRun';
import CompetencyStoryRun from './CompetencyStoryRun';
import type { StoryRouting } from './storyRunContext';

const StoryModeLayout = () => {
  const { user, isLoggedIn, isAdmin, loading, studyAccount } = useAuthSession();
  const uid = isLoggedIn && user ? user.uid : null;
  // Admin test mode, set on /admin/test-mode: an admin's own account only,
  // never a study participant's.
  const canOverride = adminTestModeAllowed({ isAdmin, studyAccount });
  const override = loadRoutingOverride(canOverride);

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
          <Say {...(failed === key ? m.courseNotLoaded : m.loadingCourse)} />
        </p>
      </div>
    );
  }

  const routing: StoryRouting = {
    resolution,
    // Developers and admins may open any level; a study participant never.
    openAll: (import.meta.env.DEV || isAdmin) && !studyAccount,
    participant: studyAccount,
  };

  if (resolution.groupInEffect === 'legacy') return <LegacyStoryRun routing={routing} />;

  // The New switch is the per-competency course, for every participant (no
  // comparison group). It is part of the study, so it is played signed in:
  // a guest's play would not be saved.
  if (!uid) return <SignInFirst />;
  return <CompetencyStoryRun key={uid} routing={routing} uid={uid} />;
};

const SignInFirst = () => {
  const openAuth = useAuthModal(state => state.open);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">
        Sign in to start your course: your answers and drives are saved to your account.
      </p>
      <button
        onClick={() => openAuth({ reason: 'Sign in to start your course.' })}
        className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground"
      >
        SIGN IN →
      </button>
    </div>
  );
};

export default StoryModeLayout;
