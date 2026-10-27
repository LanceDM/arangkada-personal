/**
 * One sitting of the mock exam: where the questions came from, what has been
 * answered, how long is left, and what the finished paper is worth.
 *
 * The exam is deliberately not adaptive — items are shuffled uniformly and the
 * IRT ability estimate is computed once, after submission, for display only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { EXAM_QUESTIONS, type ExamQuestion } from '../domain/questionBank';
import {
  EXAM_TIME_SECONDS,
  getWeakAreas,
  passingScoreFor,
  scoreExam,
  wrongQuestionIds,
  type WeakArea,
} from '../domain/grading';
import { fisherYatesShuffle } from '../domain/shuffle';
import { estimateAbilityEAP } from '../domain/assessment/irt';
import { EXAM_ITEM_PARAMS } from '../domain/assessment/examItemParams';
import { mockExamDeps } from './dependencies';

export type ExamPhase = 'intro' | 'exam' | 'results';
/** Where this sitting's items came from — shown on the intro card. */
export type QuestionBankStatus = 'loading' | 'firebase' | 'fallback';

export interface MockExamState {
  phase: ExamPhase;
  questions: ExamQuestion[];
  bankSize: number;
  bankStatus: QuestionBankStatus;
  answers: (number | null)[];
  currentIndex: number;
  timeLeft: number;
  score: number;
  passed: boolean;
  requiredScore: number;
  weakAreas: WeakArea[];
  /**
   * Provisional 2PL ability estimate, or null when it cannot be trusted.
   * `EXAM_ITEM_PARAMS` is calibrated against the local bank only, so a
   * Firebase-sourced bank of different content gets no estimate rather than a
   * meaningless number.
   */
  estimatedAbility: number | null;
  goTo: (index: number) => void;
  answer: (choiceIndex: number) => void;
  start: () => void;
  submit: () => void;
  restart: () => void;
}

export const useMockExam = (): MockExamState => {
  const { user, isLoggedIn } = useAuthSession();
  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [bank, setBank] = useState<ExamQuestion[]>(EXAM_QUESTIONS);
  const [bankStatus, setBankStatus] = useState<QuestionBankStatus>('loading');
  const [questions, setQuestions] = useState(() => fisherYatesShuffle(EXAM_QUESTIONS));
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(EXAM_QUESTIONS.length).fill(null)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME_SECONDS);

  useEffect(() => {
    let live = true;

    const loadBank = async () => {
      let next = EXAM_QUESTIONS;
      let status: QuestionBankStatus = 'fallback';
      try {
        const remote = await mockExamDeps().exam.getQuestions();
        if (remote.length > 0) {
          next = remote;
          status = 'firebase';
        }
      } catch {
        // An unreadable collection is not an error the learner needs to see:
        // the local bank is a complete exam on its own.
      }
      if (!live) return;
      setBank(next);
      setQuestions(fisherYatesShuffle(next));
      setAnswers(new Array(next.length).fill(null));
      setBankStatus(status);
    };

    void loadBank();
    return () => {
      live = false;
    };
  }, []);

  const submit = useCallback(() => setPhase('results'), []);

  useEffect(() => {
    if (phase !== 'exam') return;
    const timer = setInterval(() => {
      setTimeLeft(remaining => {
        if (remaining <= 1) {
          clearInterval(timer);
          submit();
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, submit]);

  const score = scoreExam(questions, answers);
  const wrongIds = wrongQuestionIds(questions, answers);
  const requiredScore = passingScoreFor(questions.length);
  const passed = score >= requiredScore;

  const paramsById = useMemo(
    () => new Map(EXAM_QUESTIONS.map((q, i) => [q.id, EXAM_ITEM_PARAMS[i]])),
    []
  );
  const estimatedAbility =
    bankStatus === 'fallback'
      ? estimateAbilityEAP(
          questions.reduce<{ params: (typeof EXAM_ITEM_PARAMS)[number]; correct: boolean }[]>(
            (acc, q, i) => {
              const params = paramsById.get(q.id);
              if (params) acc.push({ params, correct: answers[i] === q.correctIndex });
              return acc;
            },
            []
          )
        )
      : null;

  // Persisted once per sitting, signed-in players only — the foundation for
  // eventually recalibrating IRT on real responses instead of simulated ones.
  const savedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'results') {
      savedRef.current = false;
      return;
    }
    if (savedRef.current || !isLoggedIn || !user) return;
    savedRef.current = true;

    void (async () => {
      try {
        const { exam } = mockExamDeps();
        await exam.saveAttempt(user.uid, {
          score,
          passed,
          wrongIds,
          questionIds: questions.map(q => q.id),
          timestamp: Date.now(),
        });
        if (score > (await exam.getBestScore(user.uid))) await exam.saveBestScore(user.uid, score);
      } catch (error) {
        console.error('Failed to save exam attempt:', error);
      }
    })();
    // Fires once on the transition into results, not on every recompute of the
    // derived score/wrongIds above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const reset = useCallback(
    (next: ExamPhase) => {
      const shuffled = fisherYatesShuffle(bank);
      setQuestions(shuffled);
      setAnswers(new Array(shuffled.length).fill(null));
      setCurrentIndex(0);
      setTimeLeft(EXAM_TIME_SECONDS);
      setPhase(next);
    },
    [bank]
  );

  return {
    phase,
    questions,
    bankSize: bank.length,
    bankStatus,
    answers,
    currentIndex,
    timeLeft,
    score,
    passed,
    requiredScore,
    weakAreas: getWeakAreas(wrongIds),
    estimatedAbility,
    goTo: setCurrentIndex,
    answer: choiceIndex =>
      setAnswers(previous => previous.map((a, i) => (i === currentIndex ? choiceIndex : a))),
    start: () => reset('exam'),
    submit,
    restart: () => reset('intro'),
  };
};
