// Which road signs a learner has actually met, and how they did with each.
//
// The level module teaches 140 signs. A drive shows eight. Drawing those eight
// at random means a learner could replay twenty times and still never meet
// whole families of signs — by the coupon-collector maths it takes on the order
// of ninety runs to see everything. That is not a syllabus, it is a lottery.
//
// Persistence lives in infrastructure/LocalSignCoverageRepository; everything
// here is pure ordering logic over a coverage record.
//
// Recording what has been shown turns the same eight slots into deliberate
// coverage: unseen signs first, then ones the learner got wrong, then the rest
// by how long ago they were last met. The full set is reached in roughly
// eighteen runs, and the record doubles as the per-sign evidence the adaptive
// layer in this folder was built to consume.

export interface SignRecord {
  seen: number;
  correct: number;
  wrong: number;
  /** Epoch milliseconds, so the least recently met can be resurfaced. */
  lastSeenAt: number;
}

export type SignCoverage = Record<string, SignRecord>;

/**
 * How badly a learner needs to meet this sign next. Lower is more urgent, so
 * the ordering reads: never shown, then failed, then shown but never right,
 * then already mastered.
 */
export const NEVER_SHOWN = 0;
export const FAILING = 1;
export const UNPROVEN = 2;
export const MASTERED = 3;

export const coveragePriority = (record?: SignRecord): number => {
  if (!record || record.seen === 0) return NEVER_SHOWN;
  if (record.wrong > record.correct) return FAILING;
  if (record.correct === 0) return UNPROVEN;
  return MASTERED;
};

/**
 * Anything carrying a named plate can be ordered for coverage.
 *
 * A pavement marking is covered by exactly the same argument as a sign: Level 4
 * teaches around thirty-five of them and a drive shows nine, so drawing at
 * random is the same lottery. The two never appear on one event, so a single
 * name is all this needs.
 */
interface HasPlate {
  sign?: { name: string };
  marking?: { name: string };
}

/** The name a plate is recorded under, whichever kind of plate it is. */
export const plateName = (option: HasPlate): string | undefined =>
  option.sign?.name ?? option.marking?.name;

/**
 * Picks the option a learner most needs to meet next: the most urgent priority
 * band, and within it whichever has gone longest without being shown. Ties are
 * broken at random so two equally-due signs do not always appear in the same
 * order. `rng` defaults to `Math.random`; passing a seeded generator (see
 * `shared/lib/rng.ts`) makes that tie-break reproducible, which the dev
 * scenario harness relies on.
 */
export const pickForCoverage = <T extends HasPlate>(
  pool: T[],
  coverage: SignCoverage,
  rng: () => number = Math.random
): T => {
  if (pool.length === 0) throw new Error('pickForCoverage needs a non-empty pool');

  const scored = pool.map(option => {
    const name = plateName(option);
    const record = name ? coverage[name] : undefined;
    return {
      option,
      priority: coveragePriority(record),
      lastSeenAt: record?.lastSeenAt ?? 0,
    };
  });

  const mostUrgent = Math.min(...scored.map(entry => entry.priority));
  const dueNow = scored.filter(entry => entry.priority === mostUrgent);
  const oldest = Math.min(...dueNow.map(entry => entry.lastSeenAt));
  const equallyDue = dueNow.filter(entry => entry.lastSeenAt === oldest);

  return equallyDue[Math.floor(rng() * equallyDue.length)].option;
};

export interface CoverageSummary {
  /** Distinct signs the level can show. */
  total: number;
  /** How many of them the learner has met at least once. */
  met: number;
  /** How many they have answered correctly at least once. */
  mastered: number;
  /** Signs they have got wrong more often than right. */
  struggling: string[];
}

export const summariseCoverage = (
  signNames: string[],
  coverage: SignCoverage
): CoverageSummary => {
  let met = 0;
  let mastered = 0;
  const struggling: string[] = [];

  for (const name of signNames) {
    const record = coverage[name];
    if (!record || record.seen === 0) continue;
    met += 1;
    if (record.correct > 0) mastered += 1;
    if (record.wrong > record.correct) struggling.push(name);
  }

  return { total: signNames.length, met, mastered, struggling };
};
