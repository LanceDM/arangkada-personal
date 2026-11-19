/**
 * Admin access granted from the admin page, in Firestore (2026-11-18):
 * `admins/{uid}` and the `roleGrants` records. A grant or revoke is one batch,
 * the entry and its record together, as `firestore.rules` requires.
 */
import { collection, doc, onSnapshot, writeBatch, type FirestoreError } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { AdminAccessRepository } from '@/features/admin/application/ports';
import type { PageAdminEntry, RoleGrantRecord } from '@/features/admin/domain/adminAccess';

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export const firebaseAdminAccess: AdminAccessRepository = {
  watch(onChange, onError) {
    let entries: PageAdminEntry[] | null = null;
    let grants: RoleGrantRecord[] | null = null;
    const report = () => {
      if (entries && grants) onChange({ entries, grants });
    };
    const fail = (error: FirestoreError) => onError(error.message);
    const stopEntries = onSnapshot(
      collection(db, 'admins'),
      snap => {
        entries = snap.docs.map(d => {
          const data = d.data();
          return {
            uid: d.id,
            email: String(data.email ?? ''),
            name: text(data.name),
            grantedBy: String(data.grantedBy ?? ''),
            grantedByEmail: text(data.grantedByEmail),
            grantedAt: Number(data.grantedAt ?? 0),
            reason: String(data.reason ?? ''),
          };
        });
        report();
      },
      fail
    );
    const stopGrants = onSnapshot(
      collection(db, 'roleGrants'),
      snap => {
        grants = snap.docs.flatMap((d): RoleGrantRecord[] => {
          const data = d.data();
          if (data.role !== 'admin' || (data.action !== 'grant' && data.action !== 'revoke') || typeof data.uid !== 'string') return [];
          return [{ uid: data.uid, email: text(data.email), action: data.action, by: String(data.by ?? ''), at: Number(data.at ?? 0), reason: text(data.reason), via: text(data.via) }];
        });
        report();
      },
      fail
    );
    return () => {
      stopEntries();
      stopGrants();
    };
  },

  async grant(target, reason, by) {
    const at = Date.now();
    const batch = writeBatch(db);
    batch.set(doc(db, 'admins', target.uid), {
      email: target.email ?? '',
      name: target.name ?? '',
      grantedBy: by.uid,
      grantedByEmail: by.email ?? '',
      grantedAt: at,
      reason,
    });
    batch.set(doc(collection(db, 'roleGrants')), {
      uid: target.uid, email: target.email ?? null, role: 'admin', action: 'grant', by: by.email ?? by.uid, byUid: by.uid, at, reason: reason || null, via: 'admin-page',
    });
    await batch.commit();
  },

  async revoke(target, reason, by) {
    const at = Date.now();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'admins', target.uid));
    batch.set(doc(collection(db, 'roleGrants')), {
      uid: target.uid, email: target.email ?? null, role: 'admin', action: 'revoke', by: by.email ?? by.uid, byUid: by.uid, at, reason: reason || null, via: 'admin-page',
    });
    await batch.commit();
  },
};
