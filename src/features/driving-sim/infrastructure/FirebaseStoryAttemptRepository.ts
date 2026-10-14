import { addDoc, collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { TransitionLogEntry } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import type { StoryAttemptRepository } from '@/features/driving-sim/application/ports';
import { capDecisionsForFirestore, capRoutingForFirestore, capTransitionsForFirestore } from './telemetryCap';

const attemptsOf = (uid: string) => collection(db, 'users', uid, 'attempts');

export const listLevelAttempts = async (uid: string): Promise<LevelAttempt[]> => {
  const snap = await getDocs(query(attemptsOf(uid), orderBy('timestamp', 'desc')));
  return snap.docs.map(d => d.data() as LevelAttempt);
};

export const firebaseStoryAttemptRepository: StoryAttemptRepository = {
  async save(uid, attempt) {
    const ref = await addDoc(attemptsOf(uid), attempt);
    return ref.id;
  },

  /**
   * Written to the attempt's `telemetry/fsm` subdocument rather than onto the
   * attempt itself: a long, brake-heavy drive logs thousands of per-frame
   * self-loops, and the attempts collection is read in bulk. Byte-capped to
   * stay under Firestore's 1 MiB per-document limit — the chronological prefix
   * that fits is kept, and `truncated` records that the tail was dropped.
   */
  async saveFsmTelemetry(uid, attemptId, transitions) {
    const payload = capTransitionsForFirestore(transitions as TransitionLogEntry[]);
    await setDoc(doc(db, 'users', uid, 'attempts', attemptId, 'telemetry', 'fsm'), payload);
  },

  /**
   * The per-decision record, in a subdocument of its own beside the raw log -
   * never on the attempt, which the learner model reads in bulk. Capped the
   * same way; its header is always kept whole.
   */
  async saveDecisionTelemetry(uid, attemptId, record) {
    await setDoc(
      doc(db, 'users', uid, 'attempts', attemptId, 'telemetry', 'decisions'),
      capDecisionsForFirestore(record)
    );
  },

  /**
   * The attempt's group and, for a course entry, the routing FSM's move and
   * the log entries it added. Beside the other two, never on the
   * attempt; capped the same way.
   */
  async saveRoutingTelemetry(uid, attemptId, record) {
    await setDoc(
      doc(db, 'users', uid, 'attempts', attemptId, 'telemetry', 'routing'),
      capRoutingForFirestore(record)
    );
  },
};
