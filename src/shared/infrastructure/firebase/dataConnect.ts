/**
 * Implementation B's relational store: Firebase SQL Connect (formerly Data
 * Connect), a Cloud SQL for PostgreSQL database reached through the operations
 * in `dataconnect/connector/`. Used only when the build sets
 * `VITE_DATABASE_MODE=firestore+sql`; Implementation A never loads it.
 *
 * The operations are called by name with `queryRef` / `mutationRef`, so the
 * app does not depend on a generated SDK.
 */
import { connectDataConnectEmulator, getDataConnect, type DataConnect } from 'firebase/data-connect';
import { app, usingEmulator } from './client';

export type DatabaseMode = 'firestore' | 'firestore+sql';

/** A (`firestore`, the default) or B (`firestore+sql`), from the build's `.env`. */
export const databaseMode = (): DatabaseMode =>
  import.meta.env.VITE_DATABASE_MODE === 'firestore+sql' ? 'firestore+sql' : 'firestore';

let instance: DataConnect | null = null;

export const sqlConnect = (): DataConnect => {
  if (instance) return instance;
  instance = getDataConnect(app, {
    connector: import.meta.env.VITE_SQL_CONNECTOR ?? 'arangkada',
    service: import.meta.env.VITE_SQL_SERVICE ?? 'arangkada',
    location: import.meta.env.VITE_SQL_LOCATION ?? 'asia-southeast1',
  });
  if (usingEmulator) connectDataConnectEmulator(instance, '127.0.0.1', 9399);
  return instance;
};
