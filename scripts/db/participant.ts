/**
 * npm run db:participant -- enroll <code> <email> --consent <version> [--note "..."]
 * npm run db:participant -- finish <code>
 * npm run db:participant -- withdraw <code> [--note "..."]
 * npm run db:participant -- list
 *
 * Enrols a signed-up account under a study code (P01, P02...), so exports can
 * show the code instead of the account. Writes `participants/{code}` and
 * `participantCode`/`status` on `users/{uid}` together (A), or the
 * `Participant` row (B). Withdrawing marks the participant; it deletes nothing.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { auth, databaseMode, fail, firestore, flag, sql } from './admin';

const positional = () => {
  const values = new Set([flag('consent'), flag('note')]);
  return process.argv.slice(2).filter(arg => !arg.startsWith('--') && !values.has(arg));
};

const main = async () => {
  const [command, code, email] = positional();
  const db = firestore();
  const now = Date.now();

  if (command === 'list') {
    const snap = await db.collection('participants').orderBy('enrolledAt').get();
    for (const d of snap.docs) {
      const p = d.data();
      const status = p.withdrawnAt ? 'withdrawn' : p.finishedAt ? 'finished' : 'active';
      console.log(`${d.id.padEnd(6)} ${String(p.email ?? p.uid).padEnd(32)} ${status.padEnd(9)} consent ${p.consentVersion}`);
    }
    return;
  }
  if (!code) fail('Usage: npm run db:participant -- enroll <code> <email> --consent <version> | finish <code> | withdraw <code> | list');
  const ref = db.collection('participants').doc(code!);

  if (command === 'enroll') {
    const consent = flag('consent');
    if (!email || !consent) fail('enroll needs <email> and --consent <version>');
    const user = await auth().getUserByEmail(email!);
    const taken = await db.collection('participants').where('uid', '==', user.uid).get();
    if (!taken.empty && taken.docs[0].id !== code) fail(`${email} is already enrolled as ${taken.docs[0].id}.`);
    if ((await ref.get()).exists && taken.empty) fail(`${code} is already used by another account.`);
    const batch = db.batch();
    batch.set(ref, { uid: user.uid, email: user.email ?? null, consentVersion: consent, consentedAt: now, enrolledAt: now, finishedAt: null, withdrawnAt: null, note: flag('note') ?? null });
    batch.set(db.doc(`users/${user.uid}`), { participantCode: code, status: 'active' }, { merge: true });
    await batch.commit();
    if (databaseMode() === 'firestore+sql') {
      await sql().executeGraphql(
        `mutation($uid: String!, $email: String, $code: String!, $consent: String!, $at: Timestamp!, $note: String) {
          user_upsert(data: { uid: $uid, email: $email })
          participant_upsert(data: { code: $code, userUid: $uid, consentVersion: $consent, consentedAt: $at, enrolledAt: $at, note: $note })
        }`,
        { variables: { uid: user.uid, email: user.email ?? null, code, consent, at: new Date(now).toISOString(), note: flag('note') ?? null } }
      );
    }
    console.log(`Enrolled ${email} as ${code}.`);
    return;
  }

  if (command === 'finish' || command === 'withdraw') {
    const snap = await ref.get();
    if (!snap.exists) fail(`No participant ${code}.`);
    const field = command === 'finish' ? 'finishedAt' : 'withdrawnAt';
    const batch = db.batch();
    batch.set(ref, { [field]: now, ...(flag('note') ? { note: flag('note') } : {}) }, { merge: true });
    if (command === 'withdraw') batch.set(db.doc(`users/${snap.get('uid')}`), { status: 'withdrawn', withdrawnAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    if (databaseMode() === 'firestore+sql') {
      await sql().executeGraphql(
        command === 'finish'
          ? `mutation($code: String!, $at: Timestamp!) { participant_update(key: { code: $code }, data: { finishedAt: $at }) }`
          : `mutation($code: String!, $at: Timestamp!, $uid: String!) {
              participant_update(key: { code: $code }, data: { withdrawnAt: $at })
              user_update(key: { uid: $uid }, data: { status: "withdrawn" })
            }`,
        { variables: { code, at: new Date(now).toISOString(), uid: snap.get('uid') } }
      );
    }
    console.log(`${code} marked ${command === 'finish' ? 'finished' : 'withdrawn'}.`);
    return;
  }
  fail(`Unknown command ${command}.`);
};

main().then(
  () => process.exit(0),
  error => fail(String(process.env.DEBUG ? error?.stack : (error?.message ?? error)))
);
