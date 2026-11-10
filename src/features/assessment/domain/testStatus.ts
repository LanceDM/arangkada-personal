/**
 * Where a participant stands on a test:
 * `users/{uid}/testStatus/{kind}`.
 *
 * Opened before the first item is read and finished in the same write that
 * saves the record. The rules let a participant read the test items only
 * while it is open, and never read their own record back, so this document
 * carries no answer: only the seed the sitting is drawn from and its state.
 *
 * It also holds the clock (amendment 5): `startedAt` is a server timestamp, and
 * every device counts the deadline from it.
 *
 * A post-test's status also names its design and its stage (amendment 3). It
 * opens on the routing block, and changes once to stage 2 with the block the
 * routing chose, which is what lets that block's items be read. It never
 * carries the routing score. `stage2StartedAt`, a server timestamp written when
 * part 2 is started, is the second part's clock.
 */
import type { TestKind } from '@/domain/assessment/testResponse';
import { millisOf } from '@/domain/assessment/sittingClock';
import type { Stage2Block } from '@/domain/assessment/twoStageDesign';

export interface PostTestStage {
  designId: string;
  stage: 'routing' | 'stage2';
  block: Stage2Block | null;
  /** Server time: when the routing block closed. */
  stage2At: number | null;
  /** Server time: when part 2 was started. */
  stage2StartedAt: number | null;
}

export interface TestStatusDoc {
  schemaVersion: 1;
  kind: TestKind;
  playerCode: string;
  seed: number;
  openedAt: number;
  /** Server time: the clock of the sitting's first part. */
  startedAt: number;
  status: 'open' | 'finished';
  finishedAt: number | null;
}

export type PostTestStatusDoc = TestStatusDoc & PostTestStage & { kind: 'post' };

/** A status to write: the repository adds `startedAt`, a server timestamp. */
export type NewTestStatus = Omit<TestStatusDoc, 'startedAt'>;
export type NewPostTestStatus = Omit<PostTestStatusDoc, 'startedAt'>;

export const openTestStatus = (kind: TestKind, playerCode: string, seed: number, openedAt: number): NewTestStatus => ({
  schemaVersion: 1,
  kind,
  playerCode,
  seed,
  openedAt,
  status: 'open',
  finishedAt: null,
});

export const openPostTestStatus = (playerCode: string, seed: number, openedAt: number, designId: string): NewPostTestStatus => ({
  ...openTestStatus('post', playerCode, seed, openedAt),
  kind: 'post',
  designId,
  stage: 'routing',
  block: null,
  stage2At: null,
  stage2StartedAt: null,
});

export const readTestStatus = (data: Record<string, unknown> | null): TestStatusDoc | null => {
  const startedAt = millisOf(data?.startedAt);
  return data &&
  startedAt !== null &&
  data.schemaVersion === 1 &&
  (data.kind === 'pre' || data.kind === 'post') &&
  typeof data.playerCode === 'string' &&
  typeof data.seed === 'number' && Number.isInteger(data.seed) &&
  typeof data.openedAt === 'number' &&
  (data.status === 'open' || data.status === 'finished')
    ? {
        schemaVersion: 1,
        kind: data.kind,
        playerCode: data.playerCode,
        seed: data.seed,
        openedAt: data.openedAt,
        startedAt,
        status: data.status,
        finishedAt: typeof data.finishedAt === 'number' ? data.finishedAt : null,
      }
    : null;
};

/** A post-test's status with its stage, or null when it is not one. */
export const readPostTestStatus = (data: Record<string, unknown> | null): PostTestStatusDoc | null => {
  const base = readTestStatus(data);
  if (!base || base.kind !== 'post' || !data) return null;
  const { designId, stage, block } = data;
  if (typeof designId !== 'string' || (stage !== 'routing' && stage !== 'stage2')) return null;
  if (!(block === null || block === 'easy' || block === 'medium' || block === 'hard')) return null;
  if (stage === 'stage2' && block === null) return null;
  return {
    ...base,
    kind: 'post',
    designId,
    stage,
    block,
    stage2At: millisOf(data.stage2At),
    stage2StartedAt: millisOf(data.stage2StartedAt),
  };
};

/** A participant's code, of any cohort: only an enrolled participant sits the tests. */
export { isParticipantCode, isOpenAccessCode, openAccessCode } from '@/domain/study/participantCode';
