/**
 * npm run db:audit [-- --out rebuilt-table.json]
 *
 * Recomputes the study's values from the raw records and reports every
 * difference (see auditCore.ts): the shared Q-table replayed from its update
 * log, each participant's decisions and rewards against that log and against
 * their own verdicts, and each participant's BKT rebuilt from their raw answers.
 *
 * The rules decide who may write and in what shape; this is the check on the
 * numbers. Run it after a session, and before any analysis.
 *
 * Read-only. `--out` writes the table the log replays to, for comparison or
 * for restoring the shared table by hand. Exits 1 when anything is wrong.
 */
import { writeFileSync } from 'node:fs';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import type { QLogEntry } from '@/domain/study/qLog';
import type { BKTProfileDoc, BKTUpdateRecord } from '@/domain/study/bktLog';
import { auditStudy, type AuditCourseLog, type AuditTable, type AuditUser } from './auditCore';
import { qTableDocId, type QTableId } from '@/domain/competencyRouting/qTables';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import { auth, firestore, flag } from './admin';

const ownerOf = (snap: DocumentSnapshot) => snap.ref.parent.parent?.id ?? '';

const byOwner = <T>(docs: DocumentSnapshot[], map: (d: DocumentSnapshot) => T): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const d of docs) grouped.set(ownerOf(d), [...(grouped.get(ownerOf(d)) ?? []), map(d)]);
  return grouped;
};

/** One Q-table, its log, and what its last reset started it from (2026-11-19). */
const readTable = async (db: ReturnType<typeof firestore>, id: QTableId): Promise<AuditTable> => {
  const path = `policy/${qTableDocId(id)}`;
  const [doc, updates] = await Promise.all([db.doc(path).get(), db.collection(`${path}/updates`).get()]);
  const lastReset = doc.exists ? (doc.get('lastReset') ?? null) : null;
  let lastResetStart: QTable | null = null;
  if (lastReset?.resetId) {
    const record = await db.doc(`${path}/resets/${lastReset.resetId}`).get();
    lastResetStart = record.exists ? ((record.get('start') as QTable | undefined) ?? null) : null;
  }
  return {
    id,
    table: doc.exists ? doc.get('table') : null,
    tableUpdates: doc.exists ? doc.get('updates') : null,
    qUpdates: updates.docs.map(d => d.data() as QLogEntry),
    lastReset,
    lastResetStart,
  };
};

const main = async () => {
  const db = firestore();
  const [studyTable, ...otherTables] = await Promise.all((['study', 'dryrun', 'test', 'public'] as const).map(id => readTable(db, id)));
  const [users, courseLogs, attempts, sittings, bktUpdates, bktDocs] = await Promise.all([
    db.collection('users').get(),
    db.collectionGroup('courseLog').get(),
    db.collectionGroup('attempts').get(),
    db.collectionGroup('assessmentSittings').get(),
    db.collectionGroup('bktUpdates').get(),
    db.collectionGroup('bkt').get(),
  ]);

  // Admin accounts' play is test play: read from the table, never written to it.
  // Admins by the claim, and (2026-11-18) by the admin page's list.
  const adminIds = new Set((await auth().listUsers(1000)).users.filter(u => u.customClaims?.admin === true).map(u => u.uid));
  for (const d of (await firestore().collection('admins').get()).docs) adminIds.add(d.id);

  const logsOf = byOwner(courseLogs.docs, d => ({ id: d.id, ...d.data() }) as AuditCourseLog);
  const attemptsOf = byOwner(attempts.docs, d => d.data() as AuditUser['attempts'][number]);
  const sittingsOf = byOwner(sittings.docs, d => ({ ...d.data(), id: d.id }) as AuditUser['sittings'][number]);
  const bktOf = byOwner(bktUpdates.docs, d => d.data() as BKTUpdateRecord);
  const profiles = new Map(bktDocs.docs.filter(d => d.id === 'profile').map(d => [ownerOf(d), d.data() as BKTProfileDoc]));

  const report = auditStudy({
    table: studyTable.table,
    tableUpdates: studyTable.tableUpdates,
    qUpdates: studyTable.qUpdates,
    lastResetStart: studyTable.lastResetStart,
    otherTables,
    users: users.docs.map(u => ({
      uid: u.id,
      admin: adminIds.has(u.id),
      courseLogs: (logsOf.get(u.id) ?? []).sort((a, b) => a.timestamp - b.timestamp),
      attempts: attemptsOf.get(u.id) ?? [],
      sittings: sittingsOf.get(u.id) ?? [],
      bktUpdates: bktOf.get(u.id) ?? [],
      bktProfile: profiles.get(u.id) ?? null,
    })),
    configVersion: RUN_CONFIG_VERSION,
    lastReset: studyTable.lastReset,
  });

  for (const line of report.summary) console.log(line);
  const out = flag('out');
  if (out) {
    writeFileSync(out, JSON.stringify(report.rebuiltTable, null, 2));
    console.log(`The replayed table is in ${out}.`);
  }
  if (report.adminNotes.length > 0) {
    console.log(`\nAdmin accounts (test play, not study data; not counted):`);
    for (const note of report.adminNotes) console.log(`  - ${note}`);
  }
  if (report.problems.length > 0) {
    console.log(`\n${report.problems.length} problem(s):`);
    for (const p of report.problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nEvery value follows from the raw records.');
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
