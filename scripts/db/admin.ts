/**
 * The service-account connection the db:* scripts share.
 *
 * Credentials: set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON
 * of the Firebase project (Project settings > Service accounts > Generate new
 * private key). Never commit that file: .gitignore already refuses it.
 *
 * Project: FIREBASE_PROJECT_ID, or the project id inside the credentials.
 * Emulators: set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and
 * FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 to run against `npm run emulators`.
 *
 * Mode: DATABASE_MODE=firestore (Implementation A, default) or
 * DATABASE_MODE=firestore+sql (Implementation B; also set SQL_SERVICE and
 * SQL_LOCATION if they differ from dataconnect/dataconnect.yaml).
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDataConnect } from 'firebase-admin/data-connect';

export type DatabaseMode = 'firestore' | 'firestore+sql';

export const databaseMode = (): DatabaseMode => (process.env.DATABASE_MODE === 'firestore+sql' ? 'firestore+sql' : 'firestore');

const app = () => {
  if (getApps().length > 0) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
  const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulated && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON (see scripts/db/admin.ts), or FIRESTORE_EMULATOR_HOST for the emulators.');
  }
  return initializeApp({
    ...(emulated ? {} : { credential: applicationDefault() }),
    ...(projectId ? { projectId } : emulated ? { projectId: 'demo-arangkada' } : {}),
  });
};

export const firestore = () => getFirestore(app());
export const auth = () => getAuth(app());
export const sql = () =>
  getDataConnect({ serviceId: process.env.SQL_SERVICE ?? 'arangkada', location: process.env.SQL_LOCATION ?? 'asia-southeast1' }, app());

/** Who ran the script, for the audit records. */
export const operator = () => process.env.OPERATOR ?? process.env.USER ?? process.env.USERNAME ?? 'unknown';

/** `--name value` from the command line. */
export const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

export const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};
