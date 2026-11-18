/**
 * ADMIN_PASSWORD='...' npm run db:role -- create <email> [--name "..."] [--reason "..."]
 * npm run db:role -- grant <email> [--reason "..."]
 * npm run db:role -- revoke <email> [--reason "..."]
 * npm run db:role -- list
 *
 * Two roles only: Admin and User. Admin is the `admin` custom claim on the
 * sign-in token, which the security rules (and the SQL Connect @auth rules)
 * check; everyone else is a User. Every grant and revoke is also recorded:
 * `roleGrants/{id}` (A) or the `RoleGrant` table (B), with who ran it and when.
 *
 * The person must sign out and in again (or wait up to an hour) for a new
 * claim to reach their token.
 *
 * `create` makes a new email-and-password account that is an Admin from the
 * start: the sign-in account, its `users/{uid}` document (as sign-up makes
 * it) and the grant. The password comes from ADMIN_PASSWORD, never from the
 * arguments, so it is not written into the audit record. It refuses an email
 * that already has an account: use `grant` for that.
 */
import { databaseMode, fail, firestore, auth, flag, operator, sql } from './admin';

const createAccount = async (email: string) => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) fail("create needs the password in ADMIN_PASSWORD, e.g. ADMIN_PASSWORD='...' npm run db:role -- create <email>");
  if (password!.length < 6) fail('Firebase needs a password of at least 6 characters.');
  const existing = await auth().getUserByEmail(email).catch(() => null);
  if (existing) fail(`${email} already has an account (${existing.uid}). Use: npm run db:role -- grant ${email}`);
  const user = await auth().createUser({ email, password, emailVerified: false, disabled: false });
  await firestore()
    .collection('users')
    .doc(user.uid)
    .set({ email: user.email ?? email, username: flag('name') ?? 'Admin', createdAt: Date.now(), totalScore: 0, longestStreak: 0, bestExamScore: 0 });
  console.log(`Created ${user.email} (${user.uid}).`);
  return user.email ?? email;
};

const main = async () => {
  const values = new Set([flag('reason'), flag('name')]);
  const positional = process.argv.slice(2).filter(arg => !arg.startsWith('--') && !values.has(arg));
  let [command, email] = positional;

  if (command === 'create') {
    if (!email) fail("Usage: ADMIN_PASSWORD='...' npm run db:role -- create <email> [--name \"...\"]");
    email = await createAccount(email);
    command = 'grant';
  }

  if (command === 'list') {
    const snap = await firestore().collection('roleGrants').orderBy('at').get();
    for (const d of snap.docs) {
      const g = d.data();
      console.log(`${new Date(g.at).toISOString()}  ${g.action.padEnd(6)} ${g.role}  ${g.email ?? g.uid}  by ${g.by}${g.via ? ` [${g.via}]` : ''}${g.reason ? `  (${g.reason})` : ''}`);
    }
    const admins = (await auth().listUsers(1000)).users.filter(u => u.customClaims?.admin === true);
    console.log(`\nAdmins by claim: ${admins.map(u => u.email ?? u.uid).join(', ') || 'none'}`);
    // Granted from the admin page (2026-11-18): removed there, not here.
    const pageAdmins = (await firestore().collection('admins').get()).docs.map(d => d.data().email || d.id);
    console.log(`Admins by the admin page: ${pageAdmins.join(', ') || 'none'}`);
    return;
  }
  if ((command !== 'grant' && command !== 'revoke') || !email) fail('Usage: npm run db:role -- create|grant|revoke <email> [--reason "..."] | list');

  const user = await auth().getUserByEmail(email!);
  const claims = { ...(user.customClaims ?? {}) };
  if (command === 'grant') claims.admin = true;
  else delete claims.admin;
  await auth().setCustomUserClaims(user.uid, claims);

  const at = Date.now();
  const record = { uid: user.uid, email: user.email ?? null, role: 'admin', action: command, by: operator(), at, reason: flag('reason') ?? null };
  await firestore().collection('roleGrants').add(record);

  if (databaseMode() === 'firestore+sql') {
    await sql().executeGraphql(
      `mutation($uid: String!, $email: String, $action: String!, $by: String!, $at: Timestamp!, $reason: String) {
        user_upsert(data: { uid: $uid, email: $email })
        roleGrant_insert(data: { userUid: $uid, role: "admin", action: $action, by: $by, at: $at, reason: $reason })
      }`,
      { variables: { uid: user.uid, email: user.email ?? null, action: command, by: record.by, at: new Date(at).toISOString(), reason: record.reason } }
    );
  }
  console.log(`${command === 'grant' ? 'Granted' : 'Revoked'} admin for ${user.email}. They must sign out and in again.`);
};

main().then(
  () => process.exit(0),
  error => fail(String(process.env.DEBUG ? error?.stack : (error?.message ?? error)))
);
