/**
 * npm run db:validate
 *
 * Runs the schema (scripts/db/schema.ts) through the database: reads every
 * document of every path, checks its shape, then checks that the logs are
 * whole: each participant's events, BKT updates and evidence (drives and
 * sittings) numbered 1, 2, 3..., the
 * BKT profile's count equal to its log, the Q-table's update count equal to
 * its log, and `policy/config` equal to the settings in code.
 *
 * Read-only. Exits 1 when anything is wrong.
 */
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { RUN_CONFIG_FINGERPRINT, RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { SCHEMA, sequenceProblems, type Source } from './schema';
import { fail, firestore } from './admin';

const read = async (source: Source): Promise<DocumentSnapshot[]> => {
  const db = firestore();
  if (source.kind === 'doc') {
    const snap = await db.doc(source.path).get();
    return snap.exists ? [snap] : [];
  }
  if (source.kind === 'collection') return (await db.collection(source.path).get()).docs;
  const docs = (await db.collectionGroup(source.id).get()).docs;
  return source.docId ? docs.filter(d => d.id === source.docId) : docs;
};

const ownerOf = (snap: DocumentSnapshot) => snap.ref.parent.parent?.id ?? '';

const main = async () => {
  const problems: string[] = [];
  const byPath = new Map<string, DocumentSnapshot[]>();

  for (const entry of SCHEMA) {
    const docs = await read(entry.source);
    byPath.set(entry.path, docs);
    let bad = 0;
    for (const snap of docs) {
      const found = entry.check(snap.data() ?? {}, snap.id);
      if (found.length > 0) {
        bad++;
        if (bad <= 3) problems.push(`${snap.ref.path}: ${found.join('; ')}`);
      }
    }
    console.log(`${bad === 0 ? 'ok  ' : 'FAIL'} ${entry.path.padEnd(42)} ${String(docs.length).padStart(6)} docs${bad ? `, ${bad} wrong` : ''}`);
  }

  // Each participant's event stream and BKT log are numbered without gaps.
  const groupBy = (docs: DocumentSnapshot[]) => {
    const map = new Map<string, DocumentSnapshot[]>();
    for (const d of docs) map.set(ownerOf(d), [...(map.get(ownerOf(d)) ?? []), d]);
    return map;
  };
  for (const [uid, docs] of groupBy(byPath.get('users/{uid}/events/{eventId}') ?? [])) {
    problems.push(...sequenceProblems(`events of ${uid}`, docs.map(d => d.get('seq'))));
  }
  const profiles = new Map((byPath.get('users/{uid}/bkt/profile') ?? []).map(d => [ownerOf(d), d]));
  for (const [uid, docs] of groupBy(byPath.get('users/{uid}/bktUpdates/{updateId}') ?? [])) {
    const current = docs.filter(d => d.get('configVersion') === profiles.get(uid)?.get('configVersion'));
    problems.push(...sequenceProblems(`BKT updates of ${uid}`, current.map(d => d.get('userSeq'))));
    const counted = profiles.get(uid)?.get('updates');
    if (counted !== current.length) problems.push(`BKT profile of ${uid} counts ${counted} updates; the log has ${current.length}`);
  }

  // Each participant's drives and sittings are numbered 1, 2, 3... by their evidence counter.
  const counters = new Map((byPath.get('users/{uid}/state/evidence') ?? []).map(d => [ownerOf(d), d.get('nextSeq') as number]));
  const records = groupBy([...(byPath.get('users/{uid}/attempts/{id}') ?? []), ...(byPath.get('users/{uid}/assessmentSittings/{id}') ?? [])]);
  for (const [uid, docs] of records) {
    const numbered = docs.map(d => d.get('evidenceSeq')).filter((v): v is number => typeof v === 'number');
    problems.push(...sequenceProblems(`evidence of ${uid}`, numbered));
    if (numbered.length > 0 && counters.get(uid) !== numbered.length + 1) {
      problems.push(`evidence counter of ${uid} is ${counters.get(uid)}; ${numbered.length} numbered records`);
    }
  }

  // The shared table's counter equals its log.
  const updates = byPath.get('policy/competencyQ/updates/{updateId}') ?? [];
  problems.push(...sequenceProblems('Q-table updates', updates.map(d => d.get('globalSeq'))));
  const table = byPath.get('policy/competencyQ')?.[0];
  if (table && table.get('updates') !== updates.length) problems.push(`policy/competencyQ counts ${table.get('updates')} updates; the log has ${updates.length}`);

  // The settings in force are the settings in code.
  const config = byPath.get('policy/config')?.[0];
  if (!config) problems.push('policy/config is missing: run npm run db:init');
  else if (config.get('tag') !== RUN_CONFIG_VERSION || config.get('fingerprint') !== RUN_CONFIG_FINGERPRINT()) {
    problems.push(`policy/config runs ${config.get('tag')} (${config.get('fingerprint')}); the code is ${RUN_CONFIG_VERSION} (${RUN_CONFIG_FINGERPRINT()}): run npm run db:init`);
  }

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nEverything matches the schema.');
};

main().then(
  () => process.exit(0),
  error => fail(String(process.env.DEBUG ? error?.stack : (error?.message ?? error)))
);
