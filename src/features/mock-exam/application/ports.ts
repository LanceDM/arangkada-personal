/**
 * What Mock Exam needs from the outside world, stated as an interface.
 *
 * The Firestore implementation is bound by this feature's `composition.ts`.
 */
import type { ExamAttempt, RemoteExamQuestion } from '@/features/mock-exam/domain/examAttempt';

export interface ExamRepository {
  /** The authored bank. An empty result is normal: the local bank is the fallback. */
  getQuestions(): Promise<RemoteExamQuestion[]>;
  saveAttempt(uid: string, attempt: ExamAttempt): Promise<void>;
  /** The denormalized best score on the account document, for the admin report. */
  getBestScore(uid: string): Promise<number>;
  saveBestScore(uid: string, bestExamScore: number): Promise<void>;
}
