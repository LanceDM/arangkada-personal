/**
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
 */
import { databaseMode, fail, firestore, auth, flag, operator, sql } from './admin';

const main = async () => {
  const [command, email] = process.argv.slice(2).filter(arg => !arg.startsWith('--') && arg !== flag('reason'));

  if (command === 'list') {
    const snap = await firestore().collection('roleGrants').orderBy('at').get();
    for (const d of snap.docs) {
      const g = d.data();
      console.log(`${new Date(g.at).toISOString()}  ${g.action.padEnd(6)} ${g.role}  ${g.email ?? g.uid}  by ${g.by}${g.reason ? `  (${g.reason})` : ''}`);
    }
    const admins = (await auth().listUsers(1000)).users.filter(u => u.customClaims?.admin === true);
    console.log(`\nAdmins now: ${admins.map(u => u.email ?? u.uid).join(', ') || 'none'}`);
    return;
  }
  if ((command !== 'grant' && command !== 'revoke') || !email) fail('Usage: npm run db:role -- grant|revoke <email> [--reason "..."] | list');

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
