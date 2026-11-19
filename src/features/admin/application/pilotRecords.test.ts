/**
 * The dashboard's records store, against an in-memory repository: what it
 * reads, what it keeps, and what it reads again.
 */
import { describe, expect, it } from 'vitest';
import type { AttemptDocument, AttemptRecordDocuments, PilotRecordsRepository, PoolAccountEntry } from './pilotPorts';
import { createPilotRecordsStore, type AccountDocumentsRead } from './pilotRecords';

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 9, 22, 1, 0, 0);

interface Account {
  routing: { assignment: unknown; cursor: unknown };
  attempts: AttemptDocument[];
  records: Record<string, AttemptRecordDocuments>;
  failing?: boolean;
}

const RECORDS: AttemptRecordDocuments = { fsm: { transitions: [{ timestamp: 1 }, { timestamp: 2 }], truncated: false, totalCount: 2 }, decisions: { d: 1 }, routing: { r: 1 } };

/** An in-memory pool that counts every read. */
const world = () => {
  const pool: PoolAccountEntry[] = [
    { code: 'P10', cohort: 'study', uid: 'u10' },
    { code: 'P02', cohort: 'study', uid: 'u2' },
    { code: 'E01A', cohort: 'test', uid: 'ue' },
  ];
  const accounts: Record<string, Account> = {
    u10: { routing: { assignment: { group: 'optimized' }, cursor: null }, attempts: [], records: {} },
    u2: {
      routing: { assignment: { group: 'conventional' }, cursor: { at: 'DRIVE(1)' } },
      attempts: [
        { id: 'b', savedAt: T0, data: { levelId: 0 } },
        { id: 'a', savedAt: T0, data: { levelId: 0 } },
        { id: 'c', savedAt: T0 + MINUTE, data: { levelId: 1 } },
      ],
      records: { a: RECORDS, b: RECORDS, c: RECORDS },
    },
    ue: { routing: { assignment: null, cursor: null }, attempts: [], records: {} },
  };
  const reads = { pool: 0, records: [] as string[], from: [] as Array<number | null>, fsmLogs: 0 };
  const repository: PilotRecordsRepository = {
    pool: async () => {
      reads.pool += 1;
      return pool;
    },
    routing: async uid => accounts[uid].routing,
    attemptsFrom: async (uid, from) => {
      if (accounts[uid].failing) throw new Error('Missing or insufficient permissions.');
      reads.from.push(from);
      return accounts[uid].attempts.filter(attempt => from === null || attempt.savedAt >= from).sort((a, b) => a.savedAt - b.savedAt);
    },
    attemptRecords: async (uid, id) => {
      reads.records.push(id);
      return accounts[uid].records[id] ?? { fsm: null, decisions: null, routing: null };
    },
    otherModes: async () => ({ examSittings: [{ timestamp: T0 }], dailyAnswers: [] }),
    fsmLog: async (uid, id) => {
      reads.fsmLogs += 1;
      return accounts[uid].records[id]?.fsm ?? null;
    },
  };
  return { pool, accounts, reads, repository };
};

/** Definitions that show what they were handed. */
const echo = {
  sourceOf: (documents: AccountDocumentsRead) => documents,
  exportOf: (source: AccountDocumentsRead) => ({ code: source.participant.code, ids: source.attempts.map(attempt => attempt.id) }),
  keepFsm: (fsm: unknown) => ({ kept: (fsm as { transitions: unknown[] }).transitions.slice(0, 1) }),
};

describe('the records store', () => {
  it('reads every pool account in code order, with each one\'s attempts oldest first and ties by id', async () => {
    const { repository } = world();
    const snapshot = await createPilotRecordsStore(repository, echo, { now: () => T0 + 10 * MINUTE }).refresh();
    expect(snapshot.accounts.map(account => account.code)).toEqual(['E01A', 'P02', 'P10']);
    const p02 = snapshot.accounts.find(account => account.code === 'P02')!;
    expect(p02.exported).toEqual({ code: 'P02', ids: ['a', 'b', 'c'] });
    expect(p02.source).toMatchObject({
      uid: 'u2',
      participant: { code: 'P02', cohort: 'study' },
      assignment: { group: 'conventional' },
      cursor: { at: 'DRIVE(1)' },
      examSittings: [{ timestamp: T0 }],
      dailyAnswers: [],
    });
    expect(p02.source!.attempts[0]).toEqual({ id: 'a', attempt: { levelId: 0 }, fsm: { kept: [{ timestamp: 1 }] }, decisions: { d: 1 }, routing: { r: 1 } });
    expect(p02).toMatchObject({ attempts: 3, pending: 0, error: null });
  });

  it('reads again only what was saved since, and never a record it already holds', async () => {
    const { repository, accounts, reads } = world();
    const store = createPilotRecordsStore(repository, echo, { now: () => T0 + 10 * MINUTE });
    await store.refresh();
    expect(reads.records.sort()).toEqual(['a', 'b', 'c']);

    accounts.u2.attempts.push({ id: 'd', savedAt: T0 + 2 * MINUTE, data: { levelId: 1 } });
    accounts.u2.records.d = RECORDS;
    reads.records.length = 0;
    reads.from.length = 0;
    const snapshot = await store.refresh();
    expect(reads.records).toEqual(['d']);
    expect(reads.from).toContain(T0 + MINUTE);
    expect(snapshot.accounts.find(account => account.code === 'P02')!.exported).toEqual({ code: 'P02', ids: ['a', 'b', 'c', 'd'] });
  });

  it('waits for an attempt\'s records within the grace, and calls them missing after it', async () => {
    const { repository, accounts, reads } = world();
    let now = T0 + 30_000;
    accounts.u10.attempts.push({ id: 'x', savedAt: T0, data: {} }, { id: 'y', savedAt: T0, data: {} });
    accounts.u10.records.y = { ...RECORDS, routing: null };
    const store = createPilotRecordsStore(repository, echo, { now: () => now, graceMs: 2 * MINUTE });

    const first = await store.refresh();
    expect(first.accounts.find(account => account.code === 'P10')!.pending).toBe(2);

    // x's records arrive; y's routing record never does.
    accounts.u10.records.x = RECORDS;
    reads.records.length = 0;
    const second = await store.refresh();
    expect(reads.records.sort()).toEqual(['x', 'y']);
    expect(second.accounts.find(account => account.code === 'P10')!.pending).toBe(1);

    now = T0 + 3 * MINUTE;
    reads.records.length = 0;
    const third = await store.refresh();
    expect(reads.records).toEqual(['y']);
    expect(third.accounts.find(account => account.code === 'P10')!.pending).toBe(0);
    const y = (third.accounts.find(account => account.code === 'P10')!.source as AccountDocumentsRead).attempts.find(a => a.id === 'y')!;
    expect(y.routing).toBeNull();

    reads.records.length = 0;
    await store.refresh();
    expect(reads.records).toEqual([]);
    // A whole FSM log is the Replay's to ask for, one attempt at a time; the store never does.
    expect(reads.fsmLogs).toBe(0);
  });

  it('joins a read already under way', async () => {
    const { repository, reads } = world();
    const store = createPilotRecordsStore(repository, echo);
    const [a, b] = await Promise.all([store.refresh(), store.refresh()]);
    expect(a).toBe(b);
    expect(reads.pool).toBe(1);
    expect(store.current()).toBe(a);
  });

  it('reports an account it could not read, keeps what it read before, and reads the rest', async () => {
    const { repository, accounts } = world();
    const store = createPilotRecordsStore(repository, echo, { now: () => T0 + 10 * MINUTE });
    await store.refresh();
    accounts.u2.failing = true;
    const snapshot = await store.refresh();
    const p02 = snapshot.accounts.find(account => account.code === 'P02')!;
    expect(p02.error).toBe('Missing or insufficient permissions.');
    expect(p02.exported).toEqual({ code: 'P02', ids: ['a', 'b', 'c'] });
    expect(snapshot.accounts.filter(account => account.error === null)).toHaveLength(2);
  });

  it('drops an account that left the pool, and reports progress as it reads', async () => {
    const { repository, pool } = world();
    const store = createPilotRecordsStore(repository, echo);
    await store.refresh();
    pool.splice(0, 1);
    const progress: Array<[number, number]> = [];
    const snapshot = await store.refresh((done, total) => progress.push([done, total]));
    expect(snapshot.accounts.map(account => account.code)).toEqual(['E01A', 'P02']);
    expect(progress).toEqual([[0, 2], [1, 2], [2, 2]]);
  });
});
