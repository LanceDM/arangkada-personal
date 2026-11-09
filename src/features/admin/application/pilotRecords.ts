/**
 * The study's records for the dashboard: every enrolled participant read as
 * the export reads it, and turned into its row by the definitions the export
 * uses, which are handed in.
 *
 * Read once per tab, then kept: an attempt is append-only and the records
 * beside it are written once, so a refresh reads only what was saved since,
 * the cursor (which moves) and the other modes' timestamps (a few small
 * documents). An attempt whose records are not all there yet is asked for
 * again on the next refresh until `graceMs` after it was saved; after that a
 * missing record is missing for good, as the export would find it. Only what
 * the definitions read of an FSM record is kept (`keepFsm`), since the log
 * itself can be a large document.
 *
 * This module imports no other feature, so it can be driven as it is against
 * the emulators; the dashboard binds it to Driving Sim's definitions in
 * `usePilotRecords`.
 */
import { compareParticipantCodes, type StudyCohort } from '@/domain/study/participantCode';
import type { AttemptRecordDocuments, PilotRecordsRepository, PoolAccountEntry } from './pilotPorts';

/** One attempt and its records, as the definitions take them. */
export interface AttemptDocumentsRead {
  id: string;
  attempt: unknown;
  fsm: unknown;
  decisions: unknown;
  routing: unknown;
}

/** One account's documents, as the definitions take them. */
export interface AccountDocumentsRead {
  uid: string;
  participant: { code: string; cohort: StudyCohort };
  assignment: unknown;
  cursor: unknown;
  attempts: AttemptDocumentsRead[];
  examSittings: Array<{ timestamp: number }>;
  dailyAnswers: Array<{ timestamp: number }>;
}

export interface RecordDefinitions<Source, Exported> {
  /** From the documents as read to what the definitions take. */
  sourceOf: (documents: AccountDocumentsRead) => Source;
  /** The definitions: one account's row. */
  exportOf: (source: Source) => Exported;
  /** Of an FSM record, what is kept between reads. */
  keepFsm: (fsm: unknown) => unknown;
}

export interface AccountRecords<Source, Exported> {
  code: string;
  cohort: StudyCohort;
  uid: string;
  /** Null until the account has been read once. */
  source: Source | null;
  exported: Exported | null;
  /** Attempts read so far. */
  attempts: number;
  /** Attempts saved within the grace whose records are not all there yet. */
  pending: number;
  /** Why the last read of this account failed; what was read before is kept. */
  error: string | null;
}

export interface PilotRecordsSnapshot<Source, Exported> {
  /** Every enrolled participant, in code order. */
  accounts: Array<AccountRecords<Source, Exported>>;
  readAt: number;
}

export interface PilotRecordsStore<Source, Exported> {
  /** The last snapshot, or null before the first read. */
  current(): PilotRecordsSnapshot<Source, Exported> | null;
  /** Reads what is new. A call while a read runs joins that read. */
  refresh(onProgress?: (done: number, total: number) => void): Promise<PilotRecordsSnapshot<Source, Exported>>;
}

export interface PilotRecordsOptions {
  /** How long after its save an attempt's missing records are still waited for. */
  graceMs?: number;
  /** Accounts read at once. */
  accountsAtOnce?: number;
  /** Attempts' records read at once, per account. */
  recordsAtOnce?: number;
  now?: () => number;
}

export const RECORDS_GRACE_MS = 2 * 60_000;

interface CachedAttempt {
  id: string;
  savedAt: number;
  attempt: unknown;
  records: AttemptRecordDocuments | null;
  /** Its records are complete, or past the grace: never read again. */
  settled: boolean;
}

interface CachedAccount<Source, Exported> {
  attempts: Map<string, CachedAttempt>;
  latest: number | null;
  last: AccountRecords<Source, Exported> | null;
}

/** Runs `work` over `items`, at most `limit` at a time. */
const eachLimited = async <T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>) => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  });
  await Promise.all(lanes);
};

const codeOrder = (a: { code: string }, b: { code: string }) => compareParticipantCodes(a.code, b.code);

const complete = (records: AttemptRecordDocuments) => records.fsm != null && records.decisions != null && records.routing != null;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const createPilotRecordsStore = <Source, Exported>(
  repository: PilotRecordsRepository,
  definitions: RecordDefinitions<Source, Exported>,
  { graceMs = RECORDS_GRACE_MS, accountsAtOnce = 6, recordsAtOnce = 8, now = Date.now }: PilotRecordsOptions = {}
): PilotRecordsStore<Source, Exported> => {
  const cache = new Map<string, CachedAccount<Source, Exported>>();
  let snapshot: PilotRecordsSnapshot<Source, Exported> | null = null;
  let running: Promise<PilotRecordsSnapshot<Source, Exported>> | null = null;

  const readAccount = async (entry: PoolAccountEntry): Promise<AccountRecords<Source, Exported>> => {
    const cached = cache.get(entry.uid) ?? { attempts: new Map(), latest: null, last: null };
    cache.set(entry.uid, cached);
    try {
      const [routing, fresh, other] = await Promise.all([
        repository.routing(entry.uid),
        repository.attemptsFrom(entry.uid, cached.latest),
        repository.otherModes(entry.uid),
      ]);
      for (const attempt of fresh) {
        if (cached.attempts.has(attempt.id)) continue;
        cached.attempts.set(attempt.id, { id: attempt.id, savedAt: attempt.savedAt, attempt: attempt.data, records: null, settled: false });
        cached.latest = Math.max(cached.latest ?? attempt.savedAt, attempt.savedAt);
      }
      const unsettled = [...cached.attempts.values()].filter(attempt => !attempt.settled);
      await eachLimited(unsettled, recordsAtOnce, async attempt => {
        const records = await repository.attemptRecords(entry.uid, attempt.id);
        attempt.records = { ...records, fsm: records.fsm == null ? null : definitions.keepFsm(records.fsm) };
        attempt.settled = complete(records) || now() - attempt.savedAt >= graceMs;
      });

      // Oldest first, ties by id: the order the export's query returns them in.
      const attempts = [...cached.attempts.values()].sort((a, b) => a.savedAt - b.savedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const source = definitions.sourceOf({
        uid: entry.uid,
        participant: { code: entry.code, cohort: entry.cohort },
        assignment: routing.assignment ?? null,
        cursor: routing.cursor ?? null,
        attempts: attempts.map(attempt => ({
          id: attempt.id,
          attempt: attempt.attempt,
          fsm: attempt.records?.fsm ?? null,
          decisions: attempt.records?.decisions ?? null,
          routing: attempt.records?.routing ?? null,
        })),
        examSittings: other.examSittings,
        dailyAnswers: other.dailyAnswers,
      });
      cached.last = {
        code: entry.code,
        cohort: entry.cohort,
        uid: entry.uid,
        source,
        exported: definitions.exportOf(source),
        attempts: attempts.length,
        pending: attempts.filter(attempt => !attempt.settled).length,
        error: null,
      };
    } catch (error) {
      cached.last = {
        code: entry.code,
        cohort: entry.cohort,
        uid: entry.uid,
        source: cached.last?.source ?? null,
        exported: cached.last?.exported ?? null,
        attempts: cached.last?.attempts ?? 0,
        pending: cached.last?.pending ?? 0,
        error: message(error),
      };
    }
    return cached.last;
  };

  const read = async (onProgress?: (done: number, total: number) => void) => {
    const pool = [...(await repository.pool())].sort(codeOrder);
    const accounts: Array<AccountRecords<Source, Exported>> = [];
    let done = 0;
    onProgress?.(0, pool.length);
    await eachLimited(pool, accountsAtOnce, async entry => {
      accounts.push(await readAccount(entry));
      onProgress?.(++done, pool.length);
    });
    const present = new Set(pool.map(entry => entry.uid));
    for (const uid of cache.keys()) if (!present.has(uid)) cache.delete(uid);
    snapshot = { accounts: accounts.sort(codeOrder), readAt: now() };
    return snapshot;
  };

  return {
    current: () => snapshot,
    refresh: onProgress => {
      running ??= read(onProgress).finally(() => {
        running = null;
      });
      return running;
    },
  };
};
