import { describe, expect, it } from 'vitest';
import {
  PARTICIPANT_COLUMNS,
  PARTICIPANT_FLAGS,
  POST_TEST_SEED,
  type ParticipantExport,
  type ParticipantFlag,
  type ParticipantRow,
} from '@/features/driving-sim';
import { HEALTH_CHECKS, failedChecks, recordHealth, type AccountHealthInput } from './recordHealth';

/** Flags that say where an account stands rather than that something went wrong. */
const STANDING: readonly ParticipantFlag[] = ['no-attempts', 'no-post-test', 'manual-assignment', 'not-enrolled', 'unassigned'];

const exportOf = (over: Partial<ParticipantRow>): ParticipantExport => ({
  row: {
    ...(Object.fromEntries(PARTICIPANT_COLUMNS.map(column => [column, null])) as unknown as ParticipantRow),
    group: 'optimized',
    practiceItems: 0,
    reviews: 0,
    flags: '',
    ...over,
  },
  competencies: [],
  routingLog: [],
  postTestRoute: null,
});

const account = (code: string, over: Partial<ParticipantRow> = {}, extra: Partial<AccountHealthInput> = {}): AccountHealthInput => ({
  code,
  exported: exportOf({ code, ...over }),
  attempts: 3,
  pending: 0,
  error: null,
  ...extra,
});

describe('record health', () => {
  it('lists every flag the export can set as a check or as where an account stands', () => {
    const checks: readonly string[] = HEALTH_CHECKS.map(check => check.id);
    for (const flag of PARTICIPANT_FLAGS) expect(checks.includes(flag) !== STANDING.includes(flag), flag).toBe(true);
    // And every check is a flag the export sets, or one of the dashboard's own two.
    const own = ['post-test-seed', 'conventional-add-on'];
    for (const id of checks) expect((PARTICIPANT_FLAGS as readonly string[]).includes(id) || own.includes(id), id).toBe(true);
  });

  it("names each check that found something, with the accounts it found, in the checks' order", () => {
    const health = recordHealth([
      account('P02', { flags: 'fell-behind;missing-fsm-record' }),
      account('P01', { flags: 'missing-fsm-record;no-post-test' }),
      account('P03'),
    ]);
    expect(health.issues.map(issue => [issue.id, issue.codes])).toEqual([
      ['missing-fsm-record', ['P02', 'P01']],
      ['fell-behind', ['P02']],
    ]);
    expect(health).toMatchObject({ accountsRead: 3, attemptsRead: 9, pending: [], unreadable: [] });
  });

  it('holds the treatment and the instrument to the plan', () => {
    expect(failedChecks(exportOf({ group: 'conventional', practiceItems: 1 }))).toEqual(new Set(['conventional-add-on']));
    expect(failedChecks(exportOf({ group: 'conventional', reviews: 1 }))).toEqual(new Set(['conventional-add-on']));
    expect(failedChecks(exportOf({ group: 'optimized', practiceItems: 4, reviews: 1 }))).toEqual(new Set());
    expect(failedChecks(exportOf({ postTestSeed: POST_TEST_SEED }))).toEqual(new Set());
    expect(failedChecks(exportOf({ postTestSeed: 7 }))).toEqual(new Set(['post-test-seed']));
    expect(failedChecks(exportOf({ postTestSeed: null }))).toEqual(new Set());
  });

  it('reports records still on their way and accounts it could not read apart from the checks', () => {
    const health = recordHealth([
      account('P01', {}, { pending: 2 }),
      { code: 'P02', exported: null, attempts: 0, pending: 0, error: 'Missing or insufficient permissions.' },
    ]);
    expect(health.pending).toEqual([{ code: 'P01', attempts: 2 }]);
    expect(health.unreadable).toEqual([{ code: 'P02', error: 'Missing or insufficient permissions.' }]);
    expect(health.accountsRead).toBe(1);
    expect(health.issues).toEqual([]);
  });
});
