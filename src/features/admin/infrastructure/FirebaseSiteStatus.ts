/** `site/status` in Firestore: read live by every visitor, written by an admin (firestore.rules). */
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { SiteStatusRepository } from '@/features/admin/application/ports';
import { MAX_SITE_MESSAGE, readSiteStatus } from '@/features/admin/domain/siteStatus';

const statusDoc = () => doc(db, 'site', 'status');

export const firebaseSiteStatus: SiteStatusRepository = {
  watch: (onChange, onError) => onSnapshot(statusDoc(), snap => onChange(readSiteStatus(snap.data())), onError),
  set: async ({ suspended, message }, uid) => {
    await setDoc(statusDoc(), {
      suspended,
      message: message.trim().slice(0, MAX_SITE_MESSAGE),
      updatedAt: Date.now(),
      updatedBy: uid,
    });
  },
};
