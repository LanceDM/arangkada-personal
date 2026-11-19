/**
 * What Mock Exam needs from the outside world, stated as an interface.
 *
 * The Firestore implementation is bound by this feature's `composition.ts`.
 */
import type { ExamAttempt } from '@/features/mock-exam/domain/examAttempt';
import type { ExamQuestion } from '@/features/mock-exam/domain/examItems';

export interface ExamRepository {
  /**
   * The served question bank's quiz items (switched on, `use == 'quiz'`), as
   * exam items. An empty result is normal: the bundled bank is the fallback.
   */
  getQuestions(): Promise<ExamQuestion[]>;
  saveAttempt(uid: string, attempt: ExamAttempt): Promise<void>;
  /** The denormalized best score on the account document, for the admin report. */
  getBestScore(uid: string): Promise<number>;
  saveBestScore(uid: string, bestExamScore: number): Promise<void>;
}
