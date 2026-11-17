/**
 * The four mastery levels the Q-state reads, from a competency's BKT mastery.
 *
 * | Level | BKT P(L)    | Meaning           |
 * |-------|-------------|-------------------|
 * | 1     | below 0.50  | not yet mastered  |
 * | 2     | 0.50 - 0.79 | developing        |
 * | 3     | 0.80 - 0.94 | nearly mastered   |
 * | 4     | 0.95 and up | mastered          |
 *
 * Cutoffs follow Zhang et al. (2025); four discrete levels keep the table small
 * enough for about 40 participants (Azhar, Segal & Gal, 2022).
 */
export type MasteryLevel = 1 | 2 | 3 | 4;

export const MASTERY_CUTOFFS = { developing: 0.5, connecting: 0.8, benchmarking: 0.95 } as const;

export const MASTERY_DESCRIPTORS: Record<MasteryLevel, string> = {
  1: 'not yet mastered',
  2: 'developing',
  3: 'nearly mastered',
  4: 'mastered',
};

/**
 * Minimum evidence (TENTATIVE, 2026-10-28): a competency is capped at
 * level 3 until it has at least this many graded drive answers. With few
 * observations BKT saturates fast (3 correct drive answers give 0.98 at the
 * current values, and the pre-test alone can reach 0.95), so a competency
 * cannot read as level 4 on multiple-choice evidence alone. A system rule,
 * not a model change.
 */
export const MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING = 3;

export const masteryLevel = (p: number, driveEvidence = Number.POSITIVE_INFINITY): MasteryLevel => {
  const raw: MasteryLevel =
    p >= MASTERY_CUTOFFS.benchmarking ? 4 : p >= MASTERY_CUTOFFS.connecting ? 3 : p >= MASTERY_CUTOFFS.developing ? 2 : 1;
  return raw === 4 && driveEvidence < MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING ? 3 : raw;
};
