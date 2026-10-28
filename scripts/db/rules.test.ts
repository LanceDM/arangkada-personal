/**
 * The security rules for the study logs, on the Firestore emulator.
 *
 * Skipped unless the emulator is running: start it with `npm run emulators`,
 * then run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx vitest run scripts/db/rules.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;

const envelope = (uid: string, eventId: string) => ({
  schemaVersion: 1, eventId, uid, at: 1, sessionId: 's', appBuild: 'b', configVersion: 'c',
});

describe.skipIf(!host)('security rules for the study logs', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    const [hostname, port] = host!.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-arangkada-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: hostname, port: Number(port) },
    });
  });
  afterAll(async () => env?.cleanup());

  it('lets a participant append to their own event stream, and never rewrite it', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const ref = doc(db, 'users/alice/events/e1');
    await assertSucceeds(setDoc(ref, { ...envelope('alice', 'e1'), type: 'page_viewed', seq: 1, payload: { path: '/' } }));
    await assertFails(updateDoc(ref, { payload: { path: '/changed' } }));
    await assertFails(setDoc(doc(db, 'users/bob/events/e2'), { ...envelope('bob', 'e2'), type: 'page_viewed', seq: 1, payload: {} }));
    await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'users/alice/events/e1')));
  });

  it('refuses an event whose id or owner does not match', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'users/alice/events/e3'), { ...envelope('alice', 'other'), type: 'page_viewed', seq: 1, payload: {} }));
    await assertFails(setDoc(doc(db, 'users/alice/events/e4'), { ...envelope('alice', 'e4'), type: 'made_up', seq: 1, payload: {} }));
  });

  it('keeps the event counter moving forward only', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice/state/events'), { nextSeq: 5 }));
    await assertFails(setDoc(doc(db, 'users/alice/state/events'), { nextSeq: 3 }));
  });

  it('accepts a table change only together with its log entry, and only admins read the log', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const entry = { ...envelope('alice', 'q1'), globalSeq: 1, kind: 'visit', stateKey: 'M1-failed', action: 'practice', tableAfter: {}, statesAfter: {} };
    const table = (updates: number, updateId: string, uid = 'alice') => ({
      schemaVersion: 1, table: {}, updates, updatedAt: 1, states: {},
      lastUpdate: { updateId, globalSeq: updates, kind: 'visit', uid, participantCode: null, at: 1 },
    });
    // Alone, neither is accepted.
    await assertFails(setDoc(doc(alice, 'policy/competencyQ/updates/q1'), entry));
    await assertFails(setDoc(doc(alice, 'policy/competencyQ'), table(1, 'q1')));
    // Together, they are.
    const batch = writeBatch(alice);
    batch.set(doc(alice, 'policy/competencyQ/updates/q1'), entry);
    batch.set(doc(alice, 'policy/competencyQ'), table(1, 'q1'));
    await assertSucceeds(batch.commit());
    // The counter never goes back, and a change cannot be attributed to someone else.
    await assertFails(setDoc(doc(alice, 'policy/competencyQ'), table(1, 'q1')));
    const forged = writeBatch(alice);
    forged.set(doc(alice, 'policy/competencyQ/updates/q2'), { ...entry, ...envelope('alice', 'q2'), globalSeq: 2 });
    forged.set(doc(alice, 'policy/competencyQ'), table(2, 'q2', 'bob'));
    await assertFails(forged.commit());
    await assertFails(getDoc(doc(alice, 'policy/competencyQ/updates/q1')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('lance', { admin: true }).firestore(), 'policy/competencyQ/updates/q1')));
  });

  it('keeps settings, enrolment and roles to the scripts', async () => {
    const admin = env.authenticatedContext('lance', { admin: true }).firestore();
    await assertFails(setDoc(doc(admin, 'roleGrants/x'), { uid: 'a' }));
    await assertFails(setDoc(doc(admin, 'participants/P01'), { uid: 'a' }));
    await assertFails(setDoc(doc(admin, 'policy/config'), { tag: 'x' }));
  });
});
