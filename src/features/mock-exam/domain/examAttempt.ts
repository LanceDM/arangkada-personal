/** Mock Exam's persisted shapes. */

/** `users/{uid}/examAttempts/{id}` — one graded sitting. */
export interface ExamAttempt {
  score: number;
  passed: boolean;
  wrongIds: number[];
  /**
   * The ids actually presented, in order, so a future real-data IRT
   * calibration can reconstruct the response matrix even though the bank
   * varies between attempts.
   */
  questionIds: number[];
  timestamp: number;
}

/**
 * An exam item as authored in Firestore's `exam_questions` collection. The
 * local bank in `questionBank.ts` is the fallback when that collection is empty
 * or unreadable, and it matches this shape.
 */
export interface RemoteExamQuestion {
  id: number;
  question: string;
  choices: string[];
  correctIndex: number;
  lawCitation: string;
  category:
    | 'right_of_way'
    | 'traffic_signals'
    | 'road_signs'
    | 'speed_limits'
    | 'overtaking'
    | 'parking'
    | 'pedestrians'
    | 'emergency'
    | 'number_coding'
    | 'general_rules';
  difficulty?: 'easy' | 'medium' | 'hard';
  isActive?: boolean;
}
