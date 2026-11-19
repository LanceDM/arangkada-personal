/**
 * The four Q-tables (2026-11-19), one per kind of player, so the study's
 * table holds only the study's learning:
 *
 * | Who plays                  | Decides from | Teaches        |
 * |----------------------------|--------------|----------------|
 * | A study participant        | study        | study, public  |
 * | A dry-run participant      | dryrun       | dryrun         |
 * | A test participant         | test         | test           |
 * | Any other signed-in player | public       | public         |
 *
 * An admin decides from the table their account would use and teaches none.
 * The public table also learns from the study, one way: nothing a regular
 * player does reaches the study's table. The study's table keeps the path
 * every table had before the split, `policy/competencyQ`, with its log.
 */
import type { StudyCohort } from '@/domain/study/participantCode';

export const Q_TABLE_IDS = ['study', 'dryrun', 'test', 'public'] as const;
export type QTableId = (typeof Q_TABLE_IDS)[number];

export const isQTableId = (value: unknown): value is QTableId => Q_TABLE_IDS.includes(value as QTableId);

/** The document under `policy/`: the study's keeps the old path. */
export const qTableDocId = (id: QTableId): string => (id === 'study' ? 'competencyQ' : `competencyQ_${id}`);

export const Q_TABLE_LABEL: Record<QTableId, string> = {
  study: 'Study',
  dryrun: 'Dry run',
  test: 'Test',
  public: 'Public',
};

export const Q_TABLE_NOTE: Record<QTableId, string> = {
  study: 'Learned from study participants only: the table the thesis reports.',
  dryrun: 'Learned from the dry run only.',
  test: "Learned from the team's test accounts only: never counted.",
  public: 'Used by everyone on the website who is not in the study, dry run or test. Learns from them and from the study participants.',
};

export interface QTableRoute {
  /** The table the player's decisions are made from. */
  decides: QTableId;
  /** Every table the player's decisions and rewards are written to, the deciding one first. */
  teaches: readonly QTableId[];
}

/** Which tables a player uses, by the cohort of the invite they joined with (null for none). */
export const qTableRoute = (cohort: StudyCohort | null): QTableRoute => {
  if (cohort === 'study') return { decides: 'study', teaches: ['study', 'public'] };
  if (cohort === 'dryrun' || cohort === 'test') return { decides: cohort, teaches: [cohort] };
  return { decides: 'public', teaches: ['public'] };
};
