import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { BACKGROUND_QUESTIONS, isCompleteBackground } from '@/features/driving-sim';
import { useStoryRun } from './storyRunContext';

/**
 * The background form (study procedure step 2), before the diagnostic.
 * Muted by default (BACKGROUND_FORM_ENABLED); when muted, the course never
 * sends anyone here and the page only says so.
 */
const BackgroundFormPage = () => {
  const navigate = useNavigate();
  const { course } = useStoryRun();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assessments = course?.assessments;

  if (!assessments) return <Navigate to="/play/story" replace />;

  const complete = isCompleteBackground(answers);

  const submit = async () => {
    if (!complete) return;
    setSaving(true);
    setError(null);
    try {
      await assessments.submitBackground(answers);
      navigate('/play/story');
    } catch {
      setError('Could not save your answers. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold uppercase">About You</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A few questions about your background before the diagnostic test. There are no right answers.
          </p>
        </div>

        {!assessments.backgroundRequired ? (
          <p className="text-center text-sm text-muted-foreground">The background form is not being asked right now.</p>
        ) : assessments.backgroundDone ? (
          <p className="text-center text-sm text-accent">Already done. Thank you.</p>
        ) : (
          <>
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
                        onChange={() => setAnswers(current => ({ ...current, [question.id]: option }))}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <button
              onClick={() => void submit()}
              disabled={!complete || saving}
              className="self-center rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'SAVING…' : 'SUBMIT'}
            </button>
          </>
        )}
        <button onClick={() => navigate('/play/story')} className="text-sm text-muted-foreground underline hover:text-foreground">
          Back to the map
        </button>
      </div>
    </AppLayout>
  );
};

export default BackgroundFormPage;
