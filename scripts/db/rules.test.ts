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
    // The settings version in force, as db:init writes it: every envelope here carries 'c'.
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'policy/config'), { tag: 'c', fingerprint: 'f', config: {}, activatedAt: 1 }));
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
      lastUpdate: { updateId, globalSeq: updates, kind: 'visit', uid, participantCode: null, at: 1, configVersion: 'c' },
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
    // A tab running settings older than the ones in force cannot change the table.
    const stale = writeBatch(alice);
    stale.set(doc(alice, 'policy/competencyQ/updates/q3'), { ...entry, ...envelope('alice', 'q3'), globalSeq: 2, configVersion: 'old' });
    stale.set(doc(alice, 'policy/competencyQ'), { ...table(2, 'q3'), lastUpdate: { ...table(2, 'q3').lastUpdate, configVersion: 'old' } });
    await assertFails(stale.commit());
    await assertFails(getDoc(doc(alice, 'policy/competencyQ/updates/q1')));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('lance', { admin: true }).firestore(), 'policy/competencyQ/updates/q1')));
  });

  it('never writes an older course cursor over a newer one', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const cursor = (seq: number) => ({
      schemaVersion: 1, phase: { kind: 'DRIVE', level: 1 }, stage: {}, pending: [], seen: {}, flagged: [], seq, updatedAt: 1,
    });
    const ref = doc(db, 'users/alice/routing/competencyCourse');
    await assertSucceeds(setDoc(ref, cursor(4)));
    await assertSucceeds(setDoc(ref, cursor(4)));
    await assertSucceeds(setDoc(ref, cursor(6)));
    await assertFails(setDoc(ref, cursor(5)));
  });

  it('numbers each drive and sitting with the evidence counter moved in the same write', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const sitting = (evidenceSeq: number) => ({ schemaVersion: 1, kind: 'quiz', levelId: 1, attempt: 1, answers: [], timestamp: 1, evidenceSeq });
    // Numbered, but the counter does not move with it: refused.
    await assertFails(setDoc(doc(db, 'users/alice/assessmentSittings/q1'), sitting(1)));
    const ok = writeBatch(db);
    ok.set(doc(db, 'users/alice/assessmentSittings/q1'), sitting(1));
    ok.set(doc(db, 'users/alice/state/evidence'), { nextSeq: 2 });
    await assertSucceeds(ok.commit());
    // The same id again is a rewrite: refused.
    const again = writeBatch(db);
    again.set(doc(db, 'users/alice/assessmentSittings/q1'), sitting(2));
    again.set(doc(db, 'users/alice/state/evidence'), { nextSeq: 3 });
    await assertFails(again.commit());
    // The counter never goes back.
    await assertFails(setDoc(doc(db, 'users/alice/state/evidence'), { nextSeq: 1 }));
  });

  it('keeps the open quiz or drive to its owner, in its shape', async () => {
    const db = env.authenticatedContext('alice').firestore();
    const active = { kind: 'quiz', position: 'abc', seed: 42, openedAt: 1, opens: 1 };
    await assertSucceeds(setDoc(doc(db, 'users/alice/state/active'), active));
    await assertFails(setDoc(doc(db, 'users/alice/state/active'), { ...active, kind: 'other' }));
    await assertFails(setDoc(doc(db, 'users/bob/state/active'), active));
  });

  it('keeps settings, enrolment and roles to the scripts', async () => {
    const admin = env.authenticatedContext('lance', { admin: true }).firestore();
    await assertFails(setDoc(doc(admin, 'roleGrants/x'), { uid: 'a' }));
    await assertFails(setDoc(doc(admin, 'participants/P01'), { uid: 'a' }));
    await assertFails(setDoc(doc(admin, 'policy/config'), { tag: 'x' }));
  });

  it('lets only an admin save a value set with its log, never edit it, and keeps the log from players', async () => {
    const admin = env.authenticatedContext('ada', { admin: true }).firestore();
    const alice = env.authenticatedContext('alice').firestore();
    const set = { setId: 'cal-1', number: 1, model: { pInit: 0.2 }, appliedAt: 1 };
    const log = { ...set, pilots: [{ uid: 'bob', label: 'Bob' }], appliedBy: 'ada', appliedByEmail: 'ada@example.com' };
    const state = { activeSetId: 'cal-1', number: 1, appliedAt: 1, appliedBy: 'ada' };
    // A player can write none of them; the state cannot name a set that does not exist; a set needs its log.
    await assertFails(setDoc(doc(alice, 'bktSets/cal-1'), set));
    await assertFails(setDoc(doc(admin, 'bktCalibration/state'), state));
    await assertFails(setDoc(doc(admin, 'bktSets/cal-1'), set));
    // Names do not go in the document players read.
    const leaky = writeBatch(admin);
    leaky.set(doc(admin, 'bktSets/cal-1'), log);
    leaky.set(doc(admin, 'bktSetLogs/cal-1'), log);
    await assertFails(leaky.commit());
    const batch = writeBatch(admin);
    batch.set(doc(admin, 'bktSets/cal-1'), set);
    batch.set(doc(admin, 'bktSetLogs/cal-1'), log);
    batch.set(doc(admin, 'bktCalibration/state'), state);
    await assertSucceeds(batch.commit());
    // Saved sets never change; players read the values and the state, not the log.
    await assertFails(updateDoc(doc(admin, 'bktSets/cal-1'), { model: { pInit: 0.4 } }));
    await assertFails(updateDoc(doc(admin, 'bktSetLogs/cal-1'), { note: 'changed' }));
    await assertSucceeds(getDoc(doc(alice, 'bktSets/cal-1')));
    await assertSucceeds(getDoc(doc(alice, 'bktCalibration/state')));
    await assertFails(getDoc(doc(alice, 'bktSetLogs/cal-1')));
    // Numbers only move forward by one.
    const skip = writeBatch(admin);
    skip.set(doc(admin, 'bktSets/cal-3'), { ...set, setId: 'cal-3', number: 3 });
    skip.set(doc(admin, 'bktSetLogs/cal-3'), { ...log, setId: 'cal-3', number: 3 });
    skip.set(doc(admin, 'bktCalibration/state'), { ...state, activeSetId: 'cal-3', number: 3 });
    await assertFails(skip.commit());
    // An edited start (set-N) is the next number, with a start strictly between 0 and 1.
    const edited = { setId: 'set-2', number: 2, model: { pInit: 0.4 }, appliedAt: 2 };
    const editedLog = { ...edited, kind: 'start', pilots: [], appliedBy: 'ada', appliedByEmail: null };
    const outOfRange = writeBatch(admin);
    outOfRange.set(doc(admin, 'bktSets/set-2'), { ...edited, model: { pInit: 1 } });
    outOfRange.set(doc(admin, 'bktSetLogs/set-2'), { ...editedLog, model: { pInit: 1 } });
    outOfRange.set(doc(admin, 'bktCalibration/state'), { ...state, activeSetId: 'set-2', number: 2 });
    await assertFails(outOfRange.commit());
    const start = writeBatch(admin);
    start.set(doc(admin, 'bktSets/set-2'), edited);
    start.set(doc(admin, 'bktSetLogs/set-2'), editedLog);
    start.set(doc(admin, 'bktCalibration/state'), { ...state, activeSetId: 'set-2', number: 2 });
    await assertSucceeds(start.commit());
  });

  it('lets only an admin mark pilot players, and keeps the log append-only', async () => {
    const admin = env.authenticatedContext('ada', { admin: true }).firestore();
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'bktPilots/alice'), { uid: 'alice', label: 'A', markedAt: 1, markedBy: 'alice' }));
    await assertSucceeds(setDoc(doc(admin, 'bktPilots/alice'), { uid: 'alice', label: 'A', markedAt: 1, markedBy: 'ada' }));
    await assertFails(getDoc(doc(alice, 'bktPilots/alice')));
    await assertSucceeds(setDoc(doc(admin, 'bktPilotLog/l1'), { uid: 'alice', label: 'A', action: 'marked', at: 1, by: 'ada' }));
    await assertFails(updateDoc(doc(admin, 'bktPilotLog/l1'), { action: 'unmarked' }));
  });
});
