/** Mock Exam's persisted shapes. */

/** One answer of a sitting, kept per item so the bank's responses can be counted for calibration. */
export interface ExamResponse {
  itemId: string;
  level: number;
  /** The choice picked, as the item stores it; null when left unanswered. */
  chosen: number | null;
  correct: boolean;
}

/** `users/{uid}/examAttempts/{id}` — one graded sitting. */
export interface ExamAttempt {
  score: number;
  passed: boolean;
  wrongIds: string[];
  /** The bank item ids presented, in order. */
  questionIds: string[];
  responses: ExamResponse[];
  /** Which bank the items came from: the served one, or the bundled fallback. */
  bank: 'served' | 'bundled';
  timestamp: number;
}
