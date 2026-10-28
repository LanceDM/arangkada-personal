/**
 * The database schema, as data: every Firestore path the study uses, what it
 * holds, who writes it and how, and a check for each document's shape.
 *
 * Firestore itself has no schema. This file is the one place that states it,
 * and the scripts run it against the database:
 *
 * - `npm run db:init` records the schema version in `meta/schema`;
 * - `npm run db:validate` reads every document of every path below, checks
 *   each one, and checks the logs' numbering (events, BKT updates, Q updates).
 *
 * `firestore.rules` enforces the same shapes on every app write. When a path or
 * a shape changes, change this file, the rules, and DATABASE.md together, and
 * bump DATABASE_SCHEMA_VERSION.
 */

export const DATABASE_SCHEMA_VERSION = 2;

type Data = Record<string, unknown>;
type Check = (data: Data, id: string) => string[];

/** How a path is read for validation: one document, a collection, or a collection group. */
export type Source =
  | { kind: 'doc'; path: string }
  | { kind: 'collection'; path: string }
  | { kind: 'group'; id: string; docId?: string };

export interface SchemaEntry {
  path: string;
  description: string;
  /** Who writes it: the app (as the participant), a script (service account), or nobody any more. */
  writer: 'app' | 'script' | 'frozen';
  writes: 'append-only' | 'write-once' | 'overwrite' | 'transaction';
  /** Implementation B moves this record to SQL Connect. */
  sqlInB?: string;
  source: Source;
  check: Check;
}

// --- small checks ----------------------------------------------------------------

const is = {
  string: (v: unknown) => typeof v === 'string',
  number: (v: unknown) => typeof v === 'number' && Number.isFinite(v),
  int: (v: unknown) => Number.isInteger(v),
  bool: (v: unknown) => typeof v === 'boolean',
  map: (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v),
  list: (v: unknown) => Array.isArray(v),
  nullOr: (test: (v: unknown) => boolean) => (v: unknown) => v === null || v === undefined || test(v),
  oneOf: (...values: unknown[]) => (v: unknown) => values.includes(v),
};

const fields = (spec: Record<string, (v: unknown) => boolean>): Check => data =>
  Object.entries(spec).flatMap(([key, test]) => (test(data[key]) ? [] : [`${key}: unexpected ${JSON.stringify(data[key])?.slice(0, 60)}`]));

const all = (...checks: Check[]): Check => (data, id) => checks.flatMap(check => check(data, id));

const envelope: Check = (data, id) => [
  ...fields({ schemaVersion: is.oneOf(1), eventId: is.string, uid: is.string, at: is.number, sessionId: is.string, appBuild: is.string, configVersion: is.string })(data, id),
  ...(data.eventId === id ? [] : ['eventId differs from the document id']),
];

const EVENT_TYPES = [
  'session_started', 'page_viewed', 'course_transition', 'sitting_submitted', 'item_answered', 'background_submitted',
  'drive_planned', 'decision_made', 'drive_ended', 'verdict_computed', 'policy_decision', 'reward_computed', 'app_error',
];
const SOURCES = ['drive', 'quiz', 'diagnostic', 'post_exam'];

// --- the paths ----------------------------------------------------------------------

export const SCHEMA: SchemaEntry[] = [
  {
    path: 'users/{uid}',
    description: 'Profile: email, username, created, totals; participantCode set by the enrolment script',
    writer: 'app', writes: 'overwrite', sqlInB: 'User',
    source: { kind: 'collection', path: 'users' },
    check: fields({ email: is.nullOr(is.string), username: is.nullOr(is.string), createdAt: is.nullOr(is.number), participantCode: is.nullOr(is.string) }),
  },
  {
    path: 'users/{uid}/events/{eventId}',
    description: 'The participant\'s event stream: one record per thing that happened',
    writer: 'app', writes: 'append-only',
    source: { kind: 'group', id: 'events' },
    check: all(envelope, fields({ type: is.oneOf(...EVENT_TYPES), seq: is.nullOr(is.int), payload: is.map })),
  },
  {
    path: 'users/{uid}/state/events',
    description: 'The event stream\'s counter: the next seq',
    writer: 'app', writes: 'transaction',
    source: { kind: 'group', id: 'state', docId: 'events' },
    check: fields({ nextSeq: is.int }),
  },
  {
    path: 'users/{uid}/bkt/profile',
    description: 'The participant\'s own BKT now: P(L), level, counts per competency',
    writer: 'app', writes: 'overwrite',
    source: { kind: 'group', id: 'bkt', docId: 'profile' },
    check: all(
      fields({ schemaVersion: is.oneOf(1), uid: is.string, configVersion: is.string, pInit: is.number, updates: is.int, competencies: is.map, updatedAt: is.number }),
      data => (is.map(data.competencies) && Object.keys(data.competencies as Data).length === 11 ? [] : ['competencies: expected 11'])
    ),
  },
  {
    path: 'users/{uid}/bktUpdates/{updateId}',
    description: 'One BKT update per graded answer, with the raw answer and every computed value',
    writer: 'app', writes: 'append-only',
    source: { kind: 'group', id: 'bktUpdates' },
    check: all(envelope, fields({
      userSeq: is.int, competency: is.string, source: is.oneOf(...SOURCES), correct: is.bool, action: is.string, params: is.map,
      pBefore: is.number, predictedCorrect: is.number, posterior: is.number, pAfter: is.number, levelBefore: is.int, levelAfter: is.int,
    })),
  },
  {
    path: 'users/{uid}/attempts/{id}',
    description: 'One drive: score, every graded decision, timing',
    writer: 'app', writes: 'append-only',
    source: { kind: 'group', id: 'attempts' },
    check: fields({ levelId: is.int, timestamp: is.number, finalScore: is.number, violations: is.number, correctDecisions: is.number, logs: is.list }),
  },
  {
    path: 'users/{uid}/courseLog/{id}',
    description: 'Each drive\'s, quiz\'s, final\'s or post-exam\'s decisions, rewards and the table after',
    writer: 'app', writes: 'append-only',
    source: { kind: 'group', id: 'courseLog' },
    check: fields({ schemaVersion: is.oneOf(1), kind: is.oneOf('drive', 'quiz', 'post_exam', 'final'), decisions: is.list, rewards: is.list, timestamp: is.number }),
  },
  {
    path: 'users/{uid}/assessmentSittings/{id}',
    description: 'Quiz, diagnostic and post-exam answers',
    writer: 'app', writes: 'append-only',
    source: { kind: 'group', id: 'assessmentSittings' },
    check: fields({ schemaVersion: is.oneOf(1), kind: is.oneOf('quiz', 'diagnostic', 'post_exam'), answers: is.list, timestamp: is.number }),
  },
  {
    path: 'users/{uid}/routing/competencyCourse',
    description: 'Where the participant is in the course',
    writer: 'app', writes: 'overwrite',
    source: { kind: 'group', id: 'routing', docId: 'competencyCourse' },
    check: fields({ schemaVersion: is.oneOf(1), phase: is.map, stage: is.map, pending: is.list, seen: is.map, flagged: is.list, seq: is.int }),
  },
  {
    path: 'users/{uid}/study/background',
    description: 'The background form (muted by default)',
    writer: 'app', writes: 'write-once', sqlInB: 'BackgroundResponse',
    source: { kind: 'group', id: 'study', docId: 'background' },
    check: fields({ schemaVersion: is.oneOf(1), formVersion: is.int, answers: is.map, timestamp: is.number }),
  },
  {
    path: 'policy/competencyQ',
    description: 'The shared Q-table, each state\'s phase and tag, the last change',
    writer: 'app', writes: 'transaction',
    source: { kind: 'doc', path: 'policy/competencyQ' },
    check: fields({ schemaVersion: is.oneOf(1), table: is.map, updates: is.int, updatedAt: is.number, states: is.nullOr(is.map) }),
  },
  {
    path: 'policy/competencyQ/updates/{updateId}',
    description: 'Every change to the shared table, numbered by globalSeq',
    writer: 'app', writes: 'append-only',
    source: { kind: 'collection', path: 'policy/competencyQ/updates' },
    check: all(envelope, fields({ globalSeq: is.int, kind: is.oneOf('visit', 'learn'), stateKey: is.string, action: is.string, tableAfter: is.map, statesAfter: is.map })),
  },
  {
    path: 'policy/config',
    description: 'The settings version in force',
    writer: 'script', writes: 'overwrite',
    source: { kind: 'doc', path: 'policy/config' },
    check: fields({ tag: is.string, fingerprint: is.string, config: is.map, activatedAt: is.number }),
  },
  {
    path: 'configVersions/{tag}',
    description: 'Every settings version the study ran',
    writer: 'script', writes: 'write-once', sqlInB: 'ConfigVersion',
    source: { kind: 'collection', path: 'configVersions' },
    check: fields({ fingerprint: is.string, config: is.map, activeFrom: is.number, activeTo: is.nullOr(is.number) }),
  },
  {
    path: 'participants/{code}',
    description: 'Study enrolment under a participant code',
    writer: 'script', writes: 'overwrite', sqlInB: 'Participant',
    source: { kind: 'collection', path: 'participants' },
    check: fields({ uid: is.string, consentVersion: is.string, consentedAt: is.number, enrolledAt: is.number, finishedAt: is.nullOr(is.number) }),
  },
  {
    path: 'roleGrants/{id}',
    description: 'Admin grants and revokes',
    writer: 'script', writes: 'append-only', sqlInB: 'RoleGrant',
    source: { kind: 'collection', path: 'roleGrants' },
    check: fields({ uid: is.string, role: is.oneOf('admin'), action: is.oneOf('grant', 'revoke'), by: is.string, at: is.number }),
  },
  {
    path: 'meta/schema',
    description: 'The schema version the database was set up with',
    writer: 'script', writes: 'overwrite',
    source: { kind: 'doc', path: 'meta/schema' },
    check: fields({ version: is.int, mode: is.oneOf('firestore', 'firestore+sql'), appliedAt: is.number }),
  },
];

// --- numbering checks --------------------------------------------------------------

/** 1, 2, 3... with no gap and no repeat; returns what is wrong. */
export const sequenceProblems = (label: string, values: readonly (number | null | undefined)[]): string[] => {
  const numbered = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  const problems: string[] = [];
  numbered.forEach((value, i) => {
    if (value !== i + 1) problems.push(`${label}: expected ${i + 1}, found ${value}`);
  });
  const unnumbered = values.length - numbered.length;
  if (unnumbered > 0) problems.push(`${label}: ${unnumbered} written offline without a number (ordered by time)`);
  return problems.slice(0, 5);
};
