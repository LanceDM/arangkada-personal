/**
 * Who has admin access, and granting it from the admin page (2026-11-18).
 *
 * An account is an admin by either of two things, which `firestore.rules` and
 * the app both honour:
 * - the `admin` claim, set only by `npm run db:role` (a script with the
 *   service account; nothing in the browser can set a claim), or
 * - an entry in `admins/{uid}`, which an admin adds or removes here.
 *
 * Every grant and revoke, by either road, is recorded in `roleGrants`. The
 * roster below is built from those records and the entries, so it lists the
 * script's admins too (as far as the records go).
 */

/** An `admins/{uid}` entry: admin access granted from the admin page. */
export interface PageAdminEntry {
  uid: string;
  email: string;
  name: string | null;
  grantedBy: string;
  grantedByEmail: string | null;
  grantedAt: number;
  reason: string;
}

/** A `roleGrants` record, from the script or the admin page. */
export interface RoleGrantRecord {
  uid: string;
  email: string | null;
  action: 'grant' | 'revoke';
  by: string;
  at: number;
  reason: string | null;
  /** 'admin-page' for the admin page; absent for the script. */
  via: string | null;
}

export interface AdminRosterRow {
  uid: string;
  email: string | null;
  name: string | null;
  /** How the account is an admin: the page's list (revocable here) or the script's claim. */
  source: 'page' | 'script';
  since: number | null;
  by: string | null;
  reason: string | null;
}

/**
 * Everyone with admin access: the page's entries, then the script's admins as
 * its records last left them (a granted claim not later revoked). An account on
 * both is listed once, as the page's.
 */
export const adminRoster = (entries: PageAdminEntry[], grants: RoleGrantRecord[]): AdminRosterRow[] => {
  const rows: AdminRosterRow[] = entries.map(entry => ({
    uid: entry.uid,
    email: entry.email || null,
    name: entry.name,
    source: 'page',
    since: entry.grantedAt,
    by: entry.grantedByEmail ?? entry.grantedBy,
    reason: entry.reason || null,
  }));
  const listed = new Set(rows.map(row => row.uid));
  const lastByScript = new Map<string, RoleGrantRecord>();
  for (const grant of [...grants].sort((a, b) => a.at - b.at)) {
    if (grant.via === 'admin-page') continue;
    lastByScript.set(grant.uid, grant);
  }
  for (const grant of lastByScript.values()) {
    if (grant.action !== 'grant' || listed.has(grant.uid)) continue;
    rows.push({ uid: grant.uid, email: grant.email, name: null, source: 'script', since: grant.at, by: grant.by, reason: grant.reason });
  }
  return rows.sort((a, b) => (a.email ?? a.uid).localeCompare(b.email ?? b.uid));
};

/** The account a grant or revoke is about, as the Players page knows it. */
export interface AdminTarget {
  uid: string;
  email: string | null;
  label: string;
  /** A study participant's code: participants are never made admins. */
  code: string | null;
}

/** Why this account cannot be made an admin from the page, or null. */
export const grantRefusal = (target: AdminTarget, roster: AdminRosterRow[]): string | null => {
  if (roster.some(row => row.uid === target.uid)) return 'This account is already an admin.';
  if (target.code) return 'Study participants cannot be admins: admin play never counts, so their data would be lost.';
  return null;
};

/** Why this admin cannot be removed from the page by this admin, or null. */
export const revokeRefusal = (target: AdminTarget, roster: AdminRosterRow[], selfUid: string): string | null => {
  const row = roster.find(entry => entry.uid === target.uid);
  if (!row) return 'This account is not an admin.';
  if (target.uid === selfUid) return 'You cannot remove your own admin access. Ask another admin.';
  if (row.source === 'script')
    return `This account's admin access was set by the script. Remove it with: npm run db:role -- revoke ${row.email ?? target.email ?? '<email>'}`;
  return null;
};
