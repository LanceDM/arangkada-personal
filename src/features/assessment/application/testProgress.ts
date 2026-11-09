/**
 * Where a participant's two tests stand, for the study's order: not opened, open, or finished. It reads the status documents,
 * which hold no answer and no score.
 */
import type { TestProgress } from '@/domain/study/studyStage';
import { assessmentDeps } from './dependencies';

const progressOf = (status: { status: 'open' | 'finished' } | null): TestProgress => (status ? status.status : 'none');

export const loadTestProgress = async (uid: string): Promise<{ pre: TestProgress; post: TestProgress }> => {
  const { sittings } = assessmentDeps();
  const [pre, post] = await Promise.all([sittings.status(uid, 'pre'), sittings.status(uid, 'post')]);
  return { pre: progressOf(pre), post: progressOf(post) };
};
