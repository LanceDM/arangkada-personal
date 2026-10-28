/**
 * The composition root: which implementation stands behind each feature port.
 *
 * This is the one module allowed to reach past a feature's public API, and it
 * does so only through that feature's `composition.ts` — the narrow entry point
 * each one exposes for exactly this purpose. It is also the one module allowed
 * to know both a feature's ports and another feature's public API, which is
 * what lets Driving Sim read a guest's attempts out of Progression's store
 * without importing Progression itself.
 *
 * Imported for its side effect by `src/main.tsx`, before anything renders.
 */
import { guestAttempts } from '@/features/progression';
import { composeAuth } from '@/features/auth/composition';
import { composeAdmin } from '@/features/admin/composition';
import { composeDailyChallenge } from '@/features/daily-challenge/composition';
import { composeMockExam } from '@/features/mock-exam/composition';
import { composeProgression } from '@/features/progression/composition';
import {
  composeDrivingSim,
  type LearnerHistoryRepository,
  type RoutingMode,
} from '@/features/driving-sim/composition';

/**
 * Signed in: every attempt ever saved. Guest: the local store's best attempt
 * per level, in this browser only.
 */
const guestAwareLearnerHistory = (
  signedIn: LearnerHistoryRepository
): LearnerHistoryRepository => ({
  load: async uid =>
    uid ? signedIn.load(uid) : { source: 'local', attempts: guestAttempts() },
});

/**
 * The Legacy / New switch. New - the routing FSM, with
 * the pilot's two groups - unless the build sets `VITE_ROUTING_SWITCH=legacy`,
 * which builds today's game.
 */
const routingMode: RoutingMode = import.meta.env.VITE_ROUTING_SWITCH === 'legacy' ? 'legacy' : 'new';

composeAuth();
composeProgression();
composeAdmin();
composeDailyChallenge();
composeMockExam();
composeDrivingSim({
  learnerHistory: guestAwareLearnerHistory,
  // The old two-group run's Optimized table (seed 11, trained in simulation)
  // was removed on 2026-10-28: the study uses no simulated data, and the New
  // switch now plays the per-competency course, whose Q-table is learned
  // online from participants. Nothing in the game asks for this loader.
  routing: {
    mode: routingMode,
    optimized: async () => {
      throw new Error('The simulation-trained routing table was removed (no simulated data).');
    },
  },
});
