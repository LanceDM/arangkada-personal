/**
 * Whether a signed-in account has admin access (2026-11-18): the `admin` claim
 * (set by `npm run db:role`), or an entry in `admins/{uid}`, which an admin
 * grants from the admin page. `firestore.rules` grants admin by the same two.
 *
 * The claim is read from the token the session holds, so a claim granted since
 * arrives with the next sign-in. An entry is read fresh each time.
 */
import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './client';

export const hasAdminAccess = async (user: User | null | undefined): Promise<boolean> => {
  if (!user) return false;
  try {
    const { claims } = await user.getIdTokenResult();
    if (claims.admin === true) return true;
  } catch {
    // An expired token that cannot be refreshed, e.g. offline: no claim.
  }
  try {
    return (await getDoc(doc(db, 'admins', user.uid))).exists();
  } catch {
    // Unreadable (offline): the session opens without admin.
    return false;
  }
};
