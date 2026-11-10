/**
 * The order BKT reads a participant's answers in, and the fixed ids their
 * records are saved under.
 *
 * Every record that holds graded answers (a drive, a quiz, the pre-test's
 * seed) gets a per-participant number when it is saved: `evidenceSeq`,
 * 1, 2, 3..., handed out by a counter inside the same Firestore transaction
 * that saves the record. BKT reads the records in that order, and each
 * record's answers in the order they were given. The device clock is kept
 * only as a recorded field: a clock that jumps (a manual change, a time sync)
 * no longer reorders the evidence.
 *
 * Records saved before the counter existed have no number; they are read
 * first, in the order of their own timestamps, as before.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { canonicalJSON } from './canonical';
import type { EvidenceOrigin } from './bktLog';

/** The tutorial (Level 0) teaches the controls; its steps are not evidence. */
export const TUTORIAL_LEVEL = 0;

export interface EvidenceRecord {
  kind: EvidenceOrigin['kind'];
  levelId: number | null;
  /** The quiz attempt (1-3); null for anything else. */
  attempt: number | null;
  /** The record's per-participant number; absent on records saved before the counter. */
  evidenceSeq?: number | null;
  /** When the record was saved (device ms): orders the unnumbered records only. */
  timestamp: number;
  logs: readonly ActionLog[];
  /** The record's own id, where the store gives one. */
  ref?: string | null;
}

/**
 * Every answer BKT reads, in order, with where each came from. The tutorial is
 * left out. The post-test is never a record here: it is the outcome measure,
 * not evidence.
 */
export const orderEvidence = (records: readonly EvidenceRecord[]): { logs: ActionLog[]; origins: EvidenceOrigin[] } => {
  const counted = records.filter(r => !(r.kind === 'attempt' && r.levelId === TUTORIAL_LEVEL));
  const legacy = counted.filter(r => typeof r.evidenceSeq !== 'number');
  const numbered = counted.filter(r => typeof r.evidenceSeq === 'number').sort((a, b) => a.evidenceSeq! - b.evidenceSeq!);

  // Unnumbered records: every answer by its own time, as BKT read them before.
  const early = legacy
    .flatMap(r => r.logs.map(log => ({ log, origin: originOf(r) })))
    .sort((a, b) => a.log.timestamp - b.log.timestamp);
  // Numbered records: in the order they were saved; within one, in the order given.
  const late = numbered.flatMap(r =>
    [...r.logs].map((log, i) => ({ log, i, origin: originOf(r) })).sort((a, b) => a.log.timestamp - b.log.timestamp || a.i - b.i)
  );
  const all = [...early, ...late];
  return { logs: all.map(t => t.log), origins: all.map(t => t.origin) };
};

const originOf = (r: EvidenceRecord): EvidenceOrigin => ({ kind: r.kind, levelId: r.levelId, ref: r.ref ?? null, attempt: r.attempt });

/** A short, stable fingerprint of a value (FNV-1a over its canonical JSON). */
export const fingerprintOf = (value: unknown): string => {
  const text = canonicalJSON(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * The fixed id a step's record is saved under: what it is, where in the course,
 * and the exact position it was taken from. Saving the same step twice lands
 * on the same id.
 */
export const stepRecordId = (kind: 'drive' | 'quiz' | 'final', where: string, position: unknown): string =>
  `${kind}_${where.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${fingerprintOf(position)}`;

/** The pre-test seeds BKT once: one fixed id. */
export const PRE_TEST_SEED_RECORD_ID = 'pre_test';

/**
 * What the pre-test tells BKT: per competency,
 * items answered and correct. BKT reads the pre-test with no learning step,
 * under which the order of the answers does not change the result, so counts
 * are all it needs, and the participant's device never keeps which items they
 * missed. An item left unanswered is not evidence, as a question
 * whose time ran out is not in a drive.
 */
export interface PreTestSeed {
  schemaVersion: 1;
  counts: Partial<Record<DrivingCompetency, { correct: number; total: number }>>;
  timestamp: number;
}

export const preTestSeedOf = (
  responses: readonly { competency: string; chosen: number | null; correct: boolean }[],
  timestamp: number
): PreTestSeed => {
  const counts: PreTestSeed['counts'] = {};
  for (const r of responses) {
    if (r.chosen === null || !(COMPETENCIES as readonly string[]).includes(r.competency)) continue;
    const c = (counts[r.competency as DrivingCompetency] ??= { correct: 0, total: 0 });
    c.total += 1;
    if (r.correct) c.correct += 1;
  }
  return { schemaVersion: 1, counts, timestamp };
};
