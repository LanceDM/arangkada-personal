/**
 * The initial exam, opened from the main menu: the background form first when
 * it is asked (muted by default), then the diagnostic pre-test (55 items, 5 per
 * competency, no feedback). It sets each competency's starting mastery, and the
 * other modes stay locked until it is taken. Taken once: a second visit only
 * shows that it is done.
 *
 * Every answer is logged the moment it is given (`answer_given`), and the
 * sitting is saved once under a fixed id when the last item is answered.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { useInitialExam } from '@/app/initialExam/useInitialExam';
import { useAuthModal, useAuthSession } from '@/features/auth';
import {
  BACKGROUND_QUESTIONS,
  BankQuiz,
  diagnosticItems,
  isCompleteBackground,
  logAnswerGiven,
  logUiAction,
  saveBackground,
  saveDiagnostic,
} from '@/features/driving-sim';

const InitialExamPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const uid = user?.uid ?? null;
  const { open } = useAuthModal();
  const gate = useInitialExam();
  const [items] = useState(() => diagnosticItems());
  const [sitting, setSitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uid) void logUiAction(uid, 'initial_exam_viewed', { done: gate.status?.done ?? null });
    // Once per visit, when the status is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, gate.status !== null]);

  const status = gate.status;
  const needsBackground = status !== null && status.backgroundRequired && !status.backgroundDone;
  const done = status !== null && status.done && !needsBackground;

  const submitBackground = async () => {
    if (!uid || !isCompleteBackground(answers)) return;
    setSaving(true);
    setError(null);
    try {
      await saveBackground(uid, answers);
      gate.refresh();
    } catch {
      setError('Could not save your answers. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (sitting && uid) {
    return (
      <BankQuiz
        items={items}
        kind="diagnostic"
        title="Initial Exam"
        onSubmit={async (choices, responseMs) => {
          await saveDiagnostic(uid, items, choices, responseMs);
          return null;
        }}
        onAnswer={(position, item, choice, responseMs) =>
          void logAnswerGiven(uid, { sitting: 'diagnostic', attempt: null, levelId: null, phase: null, position, item, choice, responseMs })
        }
        onClose={() => {
          void logUiAction(uid, 'exam_closed', { sitting: 'diagnostic' });
          setSitting(false);
        }}
        onDone={() => {
          gate.refresh();
          navigate('/play');
        }}
      />
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">Initial Exam</h1>

        {!gate.required ? (
          <p className="text-muted-foreground">The initial exam is not part of this build's study course.</p>
        ) : !gate.signedIn ? (
          <>
            <p className="text-muted-foreground">Sign in first: your answers are saved to your account and set your starting point.</p>
            <button
              onClick={() => open({ reason: 'Sign in to take the initial exam.' })}
              className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground"
            >
              SIGN IN
            </button>
          </>
        ) : gate.loading ? (
          <p className="text-muted-foreground">Checking…</p>
        ) : gate.error ? (
          <p className="text-sm text-destructive">{gate.error}</p>
        ) : done ? (
          <p className="text-accent">
            Already taken{status?.takenAt ? ` on ${new Date(status.takenAt).toLocaleDateString()}` : ''}. Every mode is open.
          </p>
        ) : needsBackground ? (
          <div className="flex w-full flex-col gap-4 text-left">
            <p className="text-center text-sm text-muted-foreground">
              First, a few questions about your background. There are no right answers.
            </p>
            {BACKGROUND_QUESTIONS.map(question => (
              <fieldset key={question.id} className="rounded-xl border border-border bg-card p-4">
                <legend className="px-1 text-sm font-semibold">{question.prompt}</legend>
                <div className="mt-2 flex flex-col gap-2">
                  {question.options.map(option => (
                    <label key={option} className="flex cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() => {
                          void logUiAction(uid!, 'background_answer_selected', { questionId: question.id, option });
                          setAnswers(current => ({ ...current, [question.id]: option }));
                        }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <button
              onClick={() => void submitBackground()}
              disabled={!isCompleteBackground(answers) || saving}
              className="self-center rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground disabled:opacity-40"
            >
              {saving ? 'SAVING…' : 'NEXT'}
            </button>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              {items.length} multiple-choice items, 5 for each of the 11 driving competencies. Answer what you know: there is no
              feedback and no pass mark. It sets your starting point, and the other modes open once it is done. It is taken once.
            </p>
            <button
              onClick={() => {
                void logUiAction(uid!, 'exam_started', { sitting: 'diagnostic' });
                setSitting(true);
              }}
              className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              START →
            </button>
          </>
        )}

        <button onClick={() => navigate('/play')} className="text-sm text-muted-foreground underline hover:text-foreground">
          Back to the main menu
        </button>
      </div>
    </AppLayout>
  );
};

export default InitialExamPage;
