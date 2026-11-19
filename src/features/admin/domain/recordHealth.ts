/**
 * The health of the pilot's records, from each account's export row: the
 * export's own flags, so the dashboard and the export can never disagree on
 * what is missing, plus the checks the analysis runs on the treatment and the
 * instrument.
 *
 * - **Records:** a record missing or cut to fit, or saved without what the
 *   analysis needs to tell penalties apart or how the drive was played.
 *   "Pending" is an attempt saved moments ago whose records are still on
 *   their way; it becomes missing only once the store stops waiting.
 * - **Device lag:** an attempt in which the device lost a second or more of
 *   real time (`fell-behind`).
 * - **Procedure:** something about how a session was run that the analysis
 *   handles, a run that ended with time's up among them.
 * - **Instrument:** a post-test that was not the final exam on its fixed roll.
 * - **Fidelity:** a Conventional account given a practice item or a review,
 *   which its routing never adds.
 *
 * `no-attempts`, `no-post-test`, `manual-assignment`, `not-enrolled` and
 * `unassigned` describe where an account is, not a fault, and are left to
 * the overview.
 */
import { POST_TEST_SEED, type ParticipantExport } from '@/features/driving-sim';

export type HealthKind = 'records' | 'device' | 'procedure' | 'instrument' | 'fidelity';

export interface HealthCheck {
  id: string;
  kind: HealthKind;
  meaning: string;
}

/** Every check, in the order the overview lists them. */
export const HEALTH_CHECKS: readonly HealthCheck[] = [
  { id: 'missing-routing-record', kind: 'records', meaning: 'An attempt saved without its routing record.' },
  { id: 'missing-fsm-record', kind: 'records', meaning: 'An attempt saved without its FSM transition log.' },
  { id: 'missing-decision-record', kind: 'records', meaning: 'An attempt saved without its per-decision record.' },
  { id: 'truncated-telemetry', kind: 'records', meaning: 'A record was cut to fit one document.' },
  { id: 'penalties-unknown', kind: 'records', meaning: 'Standing penalties cannot be told apart from decisions in some attempt.' },
  { id: 'play-unrecorded', kind: 'records', meaning: 'An attempt saved without how it was played.' },
  { id: 'fell-behind', kind: 'device', meaning: 'The device lost a second or more of real time in some attempt.' },
  { id: 'group-mismatch', kind: 'procedure', meaning: 'An attempt played in a group other than the assigned one, with no override.' },
  { id: 'override', kind: 'procedure', meaning: "An attempt played under an admin's test-mode override." },
  { id: 'legacy-attempts', kind: 'procedure', meaning: 'An attempt from a Legacy build.' },
  { id: 'played-before-assignment', kind: 'procedure', meaning: 'An attempt saved before the account was assigned.' },
  { id: 'repeat-post-test', kind: 'procedure', meaning: 'More than one post-test; the first is the one used.' },
  { id: 'played-after-post-test', kind: 'procedure', meaning: 'Story attempts after the post-test; they are not training.' },
  { id: 'mock-exam-during-play', kind: 'procedure', meaning: 'The Mock Exam was used during the play time.' },
  { id: 'daily-challenge-during-play', kind: 'procedure', meaning: 'The Daily Challenge was used during the play time.' },
  { id: 'timed-out', kind: 'procedure', meaning: "An attempt ended with time's up: the level's driving time ran out." },
  { id: 'post-test-not-final-exam', kind: 'instrument', meaning: 'The attempt recorded as the post-test is not the final exam.' },
  { id: 'post-test-seed', kind: 'instrument', meaning: `The post-test was not played on the fixed roll (seed ${POST_TEST_SEED}).` },
  { id: 'conventional-add-on', kind: 'fidelity', meaning: 'A Conventional account was given a practice item or a review.' },
];

/** One account as the store read it. */
export interface AccountHealthInput {
  code: string;
  exported: ParticipantExport | null;
  attempts: number;
  pending: number;
  error: string | null;
}

export interface HealthIssue extends HealthCheck {
  /** The accounts it applies to, in code order. */
  codes: string[];
}

export interface RecordHealth {
  accountsRead: number;
  attemptsRead: number;
  /** Only the checks that found something, in `HEALTH_CHECKS` order. */
  issues: HealthIssue[];
  pending: Array<{ code: string; attempts: number }>;
  unreadable: Array<{ code: string; error: string }>;
}

/** The checks one account's row fails. */
export const failedChecks = ({ row }: ParticipantExport): Set<string> => {
  const failed = new Set(row.flags ? row.flags.split(';') : []);
  if (row.postTestSeed !== null && row.postTestSeed !== POST_TEST_SEED) failed.add('post-test-seed');
  if (row.group === 'conventional' && (row.practiceItems > 0 || row.reviews > 0)) failed.add('conventional-add-on');
  return failed;
};

export const recordHealth = (accounts: readonly AccountHealthInput[]): RecordHealth => {
  const read = accounts.filter(account => account.exported !== null);
  const failed = new Map(read.map(account => [account.code, failedChecks(account.exported!)]));
  return {
    accountsRead: read.length,
    attemptsRead: read.reduce((sum, account) => sum + account.attempts, 0),
    issues: HEALTH_CHECKS.flatMap(check => {
      const codes = read.filter(account => failed.get(account.code)!.has(check.id)).map(account => account.code);
      return codes.length > 0 ? [{ ...check, codes }] : [];
    }),
    pending: accounts.filter(account => account.pending > 0).map(account => ({ code: account.code, attempts: account.pending })),
    unreadable: accounts.flatMap(account => (account.error ? [{ code: account.code, error: account.error }] : [])),
  };
};
