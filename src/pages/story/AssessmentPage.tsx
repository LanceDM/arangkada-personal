import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { BankQuiz } from '@/features/driving-sim';
import { useStoryRun } from './storyRunContext';

/**
 * The two exams around the course (2026-10-28): the diagnostic pre-test, which
 * sets each competency's starting mastery (5 items per competency, no feedback),
 * and the post-evaluation exam, scored with Rasch, which opens once the final
 * exam is passed. Both are sat once, from the same bank, with different items.
 */
const AssessmentPage = ({ kind }: { kind: 'diagnostic' | 'post_exam' }) => {
  const navigate = useNavigate();
  const { course } = useStoryRun();
  const [sitting, setSitting] = useState(false);
  const assessments = course?.assessments;

  if (!assessments) return <Navigate to="/play/story" replace />;
  const done = kind === 'diagnostic' ? assessments.diagnosticDone : assessments.postExamDone;
  const open = kind === 'diagnostic' || assessments.postExamOpen;
  const items = kind === 'diagnostic' ? assessments.diagnosticItems : assessments.postExamItems;
  const title = kind === 'diagnostic' ? 'Diagnostic Test' : 'Post-Evaluation Exam';

  if (sitting) {
    return (
      <BankQuiz
        items={items}
        kind={kind}
        title={title}
        onSubmit={async (choices, responseMs) => {
          await (kind === 'diagnostic' ? assessments.submitDiagnostic(choices, responseMs) : assessments.submitPostExam(choices, responseMs));
          return null;
        }}
        onDone={() => navigate('/play/story')}
      />
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-4 py-12 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">{title}</h1>
        <p className="text-muted-foreground">
          {kind === 'diagnostic'
            ? `${items.length} multiple-choice items, 5 for each of the 11 driving competencies. Answer what you know; there is no feedback and no pass mark. It sets your starting point.`
            : `${items.length} multiple-choice items covering every competency. Answer on your own; there is no feedback. It measures what you learned.`}
        </p>
        {done ? (
          <p className="text-sm text-accent">Already done. Thank you.</p>
        ) : !open ? (
          <p className="text-sm text-muted-foreground">It opens once you pass the final exam.</p>
        ) : (
          <button
            onClick={() => setSitting(true)}
            className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            START →
          </button>
        )}
        <button onClick={() => navigate('/play/story')} className="text-sm text-muted-foreground underline hover:text-foreground">
          Back to the map
        </button>
      </div>
    </AppLayout>
  );
};

export const DiagnosticPage = () => <AssessmentPage kind="diagnostic" />;
export const PostExamPage = () => <AssessmentPage kind="post_exam" />;
