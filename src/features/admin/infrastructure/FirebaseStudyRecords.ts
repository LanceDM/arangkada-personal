/**
 * Implementation A (Firestore) of the admin's study reads, plus the live
 * Q-table listeners and the logged records, which are in Firestore in both
 * implementations.
 *
 * - `participants/{code}`, `roleGrants/{id}`, `configVersions/{tag}`;
 * - `policy/competencyQ` and `policy/competencyQ/updates` (live);
 * - every participant's `bktUpdates` and `events` (collection-group reads).
 */
import { collection, collectionGroup, doc, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type {
  LiveQTableRepository,
  StudyLogRepository,
  StudyRecordsRepository,
} from '@/features/admin/application/ports';
import type { ConfigVersionRow, LiveQTable, ParticipantRow, QUpdateRow, RoleGrantRow } from '@/features/admin/domain/adminReport';

export const firebaseStudyRecords: StudyRecordsRepository = {
  async participants() {
    const snap = await getDocs(collection(db, 'participants'));
    return snap.docs.map(d => ({ ...(d.data() as Omit<ParticipantRow, 'code'>), code: d.id })).sort((a, b) => a.code.localeCompare(b.code));
  },
  async roleGrants() {
    const snap = await getDocs(collection(db, 'roleGrants'));
    return snap.docs.map(d => ({ ...(d.data() as Omit<RoleGrantRow, 'id'>), id: d.id })).sort((a, b) => a.at - b.at);
  },
  async configVersions() {
    const snap = await getDocs(collection(db, 'configVersions'));
    return snap.docs.map(d => ({ ...(d.data() as Omit<ConfigVersionRow, 'tag'>), tag: d.id })).sort((a, b) => a.activeFrom - b.activeFrom);
  },
};

export const firebaseLiveQTable: LiveQTableRepository = {
  watchTable(onChange, onError) {
    return onSnapshot(
      doc(db, 'policy', 'competencyQ'),
      snap => onChange(snap.exists() ? (snap.data() as LiveQTable) : null),
      error => onError(error)
    );
  },
  watchUpdates(count, onChange, onError) {
    return onSnapshot(
      query(collection(db, 'policy', 'competencyQ', 'updates'), orderBy('globalSeq', 'desc'), limit(count)),
      snap =>
        onChange(
          snap.docs.map(d => {
            const data = d.data();
            return { ...(data as Omit<QUpdateRow, 'updateId'>), updateId: d.id };
          })
        ),
      error => onError(error)
    );
  },
};

const ownerIdOf = (ref: { parent: { parent: { id: string } | null } }) => ref.parent.parent!.id;

export const firebaseStudyLogs: StudyLogRepository = {
  async bktUpdates() {
    const snap = await getDocs(collectionGroup(db, 'bktUpdates'));
    return snap.docs.map(d => ({ ...d.data(), uid: ownerIdOf(d.ref) }));
  },
  async qUpdates() {
    const snap = await getDocs(query(collection(db, 'policy', 'competencyQ', 'updates'), orderBy('globalSeq', 'asc')));
    return snap.docs.map(d => d.data());
  },
  async events() {
    const snap = await getDocs(collectionGroup(db, 'events'));
    return snap.docs.map(d => ({ ...d.data(), uid: ownerIdOf(d.ref) }));
  },
};
