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
import { Say } from '@/shared/i18n/language';
import { storyMessages as m } from './messages';
import { useEffect, useMemo, useState } from 'react';
import { useEnrolment } from '@/features/study';
import { useAuthSession } from '@/features/auth';
import {
  adminTestModeAllowed,
  loadRoutingOverride,
  resolveRoutingGroup,
  routingGroupNow,
  type CourseAccount,
  type RoutingGroupResolution,
} from '@/features/driving-sim';
import LegacyStoryRun from './LegacyStoryRun';
import RoutedStoryRun from './RoutedStoryRun';
import CompetencyStoryRun from './CompetencyStoryRun';
import type { StoryRouting } from './storyRunContext';

const StoryModeLayout = () => {
  const { user, isLoggedIn, isAdmin, loading, studyAccount } = useAuthSession();
  const uid = isLoggedIn && user ? user.uid : null;
  // Admin test mode, set on /admin/test-mode: an admin's own account only,
  // never a study participant's.
  const canOverride = adminTestModeAllowed({ isAdmin, studyAccount });
  const override = loadRoutingOverride(canOverride);

  // A signed-in account plays the per-competency course: a participant on their cohort's shared table, anyone else (the
  // team) on `test`. A guest saves nothing and keeps the old game.
  const enrolment = useEnrolment(uid);
  const account = useMemo<CourseAccount | null>(() => {
    if (!uid) return null;
    // An admin's course play draws from the table and never changes it.
    if (enrolment.status === 'enrolled') return { uid, participantCode: enrolment.enrolment.code, table: enrolment.enrolment.cohort, isAdmin };
    if (enrolment.status === 'not-enrolled') return { uid, participantCode: null, table: 'test', isAdmin };
    return null;
  }, [uid, enrolment, isAdmin]);

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
  const enrolmentPending = uid !== null && account === null;
  if (!resolution || enrolmentPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          <Say {...(failed === key || enrolment.status === 'error' ? m.courseNotLoaded : m.loadingCourse)} />
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

  if (account) return <CompetencyStoryRun key={account.uid} routing={routing} account={account} />;

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
