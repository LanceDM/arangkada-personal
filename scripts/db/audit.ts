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
import { auditStudy, type AuditCourseLog, type AuditUser } from './auditCore';
import { firestore, flag } from './admin';

const ownerOf = (snap: DocumentSnapshot) => snap.ref.parent.parent?.id ?? '';

const byOwner = <T>(docs: DocumentSnapshot[], map: (d: DocumentSnapshot) => T): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const d of docs) grouped.set(ownerOf(d), [...(grouped.get(ownerOf(d)) ?? []), map(d)]);
  return grouped;
};

const main = async () => {
  const db = firestore();
  const [tableDoc, updates, users, courseLogs, attempts, sittings, bktUpdates, bktDocs] = await Promise.all([
    db.doc('policy/competencyQ').get(),
    db.collection('policy/competencyQ/updates').get(),
    db.collection('users').get(),
    db.collectionGroup('courseLog').get(),
    db.collectionGroup('attempts').get(),
    db.collectionGroup('assessmentSittings').get(),
    db.collectionGroup('bktUpdates').get(),
    db.collectionGroup('bkt').get(),
  ]);

  const logsOf = byOwner(courseLogs.docs, d => ({ id: d.id, ...d.data() }) as AuditCourseLog);
  const attemptsOf = byOwner(attempts.docs, d => d.data() as AuditUser['attempts'][number]);
  const sittingsOf = byOwner(sittings.docs, d => ({ ...d.data(), id: d.id }) as AuditUser['sittings'][number]);
  const bktOf = byOwner(bktUpdates.docs, d => d.data() as BKTUpdateRecord);
  const profiles = new Map(bktDocs.docs.filter(d => d.id === 'profile').map(d => [ownerOf(d), d.data() as BKTProfileDoc]));

  const report = auditStudy({
    table: tableDoc.exists ? tableDoc.get('table') : null,
    tableUpdates: tableDoc.exists ? tableDoc.get('updates') : null,
    qUpdates: updates.docs.map(d => d.data() as QLogEntry),
    users: users.docs.map(u => ({
      uid: u.id,
      courseLogs: (logsOf.get(u.id) ?? []).sort((a, b) => a.timestamp - b.timestamp),
      attempts: attemptsOf.get(u.id) ?? [],
      sittings: sittingsOf.get(u.id) ?? [],
      bktUpdates: bktOf.get(u.id) ?? [],
      bktProfile: profiles.get(u.id) ?? null,
    })),
    configVersion: RUN_CONFIG_VERSION,
  });

  for (const line of report.summary) console.log(line);
  const out = flag('out');
  if (out) {
    writeFileSync(out, JSON.stringify(report.rebuiltTable, null, 2));
    console.log(`The replayed table is in ${out}.`);
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
