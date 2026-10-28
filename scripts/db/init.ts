/**
 * npm run db:init
 *
 * Sets a new (or existing) Firebase project up for the study:
 *
 * - `configVersions/{tag}`: the settings in code (RUN_CONFIG) under their
 *   version tag; refuses if that tag already holds different settings
 *   (bump RUN_CONFIG_VERSION instead). The previous version is closed.
 * - `policy/config`: the version in force, which the app reads.
 * - `policy/competencyQ`: an empty shared Q-table, only if none exists yet.
 * - `meta/schema`: the schema version this database was set up with.
 *
 * Implementation B also writes the version to the `ConfigVersion` table.
 * Safe to run again: it changes nothing that is already right.
 */
import { RUN_CONFIG, RUN_CONFIG_FINGERPRINT, RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { emptyQTable } from '@/domain/competencyRouting/qLearning';
import { statesOf } from '@/domain/study/qLog';
import { DATABASE_SCHEMA_VERSION, SCHEMA } from './schema';
import { databaseMode, fail, firestore, operator, sql } from './admin';

const main = async () => {
  const db = firestore();
  const now = Date.now();
  const fingerprint = RUN_CONFIG_FINGERPRINT();
  const config = JSON.parse(JSON.stringify(RUN_CONFIG)) as Record<string, unknown>;

  const versionRef = db.collection('configVersions').doc(RUN_CONFIG_VERSION);
  const existing = await versionRef.get();
  if (existing.exists && existing.data()?.fingerprint !== fingerprint) {
    fail(`configVersions/${RUN_CONFIG_VERSION} already holds different settings. Bump RUN_CONFIG_VERSION in src/domain/study/runConfig.ts.`);
  }

  const active = await db.doc('policy/config').get();
  const previousTag = active.exists ? (active.data()?.tag as string | undefined) : undefined;
  if (previousTag && previousTag !== RUN_CONFIG_VERSION) {
    await db.collection('configVersions').doc(previousTag).set({ activeTo: now }, { merge: true });
    console.log(`Closed settings version ${previousTag}.`);
  }
  if (!existing.exists) {
    await versionRef.set({ fingerprint, config, activeFrom: now, activeTo: null, note: process.env.NOTE ?? null, createdBy: operator() });
    console.log(`Wrote configVersions/${RUN_CONFIG_VERSION} (${fingerprint}).`);
  }
  if (previousTag !== RUN_CONFIG_VERSION) {
    await db.doc('policy/config').set({ tag: RUN_CONFIG_VERSION, fingerprint, config, activatedAt: now, activatedBy: operator() });
    console.log(`policy/config now runs ${RUN_CONFIG_VERSION}.`);
  }

  const table = await db.doc('policy/competencyQ').get();
  if (!table.exists) {
    const empty = emptyQTable();
    await db.doc('policy/competencyQ').set({ schemaVersion: 1, table: empty, updates: 0, updatedAt: now, states: statesOf(empty), lastUpdate: null });
    console.log('Created an empty shared Q-table at policy/competencyQ.');
  }

  await db.doc('meta/schema').set({
    version: DATABASE_SCHEMA_VERSION,
    mode: databaseMode(),
    appliedAt: now,
    appliedBy: operator(),
    paths: SCHEMA.map(entry => entry.path),
  });
  console.log(`meta/schema: version ${DATABASE_SCHEMA_VERSION}, mode ${databaseMode()}.`);

  if (databaseMode() === 'firestore+sql') {
    await sql().executeGraphql(
      `mutation($tag: String!, $fingerprint: String!, $config: Any!, $activeFrom: Timestamp!) {
        configVersion_upsert(data: { tag: $tag, fingerprint: $fingerprint, config: $config, activeFrom: $activeFrom })
      }`,
      { variables: { tag: RUN_CONFIG_VERSION, fingerprint, config, activeFrom: new Date(now).toISOString() } }
    );
    console.log(`SQL: ConfigVersion ${RUN_CONFIG_VERSION} written.`);
  }
};

main().then(
  () => process.exit(0),
  error => fail(String(process.env.DEBUG ? error?.stack : (error?.message ?? error)))
);
