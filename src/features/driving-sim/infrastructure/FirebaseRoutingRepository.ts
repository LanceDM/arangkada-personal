import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { ROUTING_GROUPS, readStoredCursor, storedCursor, type RoutingGroup } from '@/features/driving-sim/domain/adaptive/courseRouting';
import type { RoutingRepository } from '@/features/driving-sim/application/ports';

/**
 * `users/{uid}/routing/assignment` and `users/{uid}/routing/cursor`.
 *
 * The assignment is written only by the developers' assignment script, with
 * their service account; the rules refuse every client write to it, so
 * a player cannot choose their own group. The cursor is the player's own place
 * in the routing FSM, rewritten when a course entry is entered and when it
 * ends.
 */
const routingDoc = (uid: string, id: 'assignment' | 'cursor') => doc(db, 'users', uid, 'routing', id);

const isGroup = (value: unknown): value is RoutingGroup => ROUTING_GROUPS.includes(value as RoutingGroup);

export const firebaseRoutingRepository: RoutingRepository = {
  async loadAssignment(uid) {
    const snap = await getDoc(routingDoc(uid, 'assignment'));
    const data = snap.exists() ? snap.data() : null;
    return data && data.schemaVersion === 1 && isGroup(data.group)
      ? { group: data.group, assignedAt: Number(data.assignedAt) }
      : null;
  },

  async loadCursor(uid) {
    const snap = await getDoc(routingDoc(uid, 'cursor'));
    return snap.exists() ? readStoredCursor(snap.data()) : null;
  },

  async saveCursor(uid, cursor) {
    await setDoc(routingDoc(uid, 'cursor'), storedCursor(cursor, Date.now()));
  },
};
