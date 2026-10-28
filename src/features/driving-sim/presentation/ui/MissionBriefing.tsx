import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  ListChecks,
  Route,
  Target,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { signNamesForLevel } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { getLevelModule, LEVEL_MODULES } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { summariseCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { loadSignCoverage } from '@/features/driving-sim/application/signCoverage';
import { getCompetencyLabel } from '@/domain/learner/profile';
import type { WeakArea } from '@/domain/learner/competency';
import type { CourseNote } from '@/features/driving-sim/domain/adaptive/routingBriefing';
import { useProgressStore } from '@/features/progression';
import { useBriefing } from '@/features/driving-sim/application/useBriefing';
import LessonReader from './LessonReader';
import MissionQuiz from './MissionQuiz';
import BankQuiz, { type BankQuizResult } from './BankQuiz';
import type { BankItem } from '@/domain/assessment/questionBank';
import type { Lesson } from '@/features/driving-sim/domain/scenario/lessonModule';

/**
 * The per-competency course's briefing (2026-10-28): the module, then the
 * bank-drawn short quiz as a gate, then the drive. Replaces the local
 * quiz-passed flag and restores the gate (it was bypassed for testing).
 */
export interface BriefingGate {
  lessonsRead: boolean;
  onLessonsRead: () => Promise<void>;
  /** The quiz attempt to sit now; null when there is none (passed, tutorial, or a drive phase). */
  quiz: {
    items: readonly BankItem[];
    attempt: number;
    cap: number;
    onSubmit: (choices: (number | null)[]) => Promise<BankQuizResult[]>;
    onDone: () => void;
  } | null;
  /** Whether the stage has a quiz at all (the tutorial has none). */
  hasQuiz: boolean;
  quizPassed: boolean;
  /** Module sections to read before the drive: after the quiz cap, or after a review decision. */
  review: { title: string; lessons: Lesson[]; onDone: () => Promise<void> } | null;
  canDrive: boolean;
  driveDetail: string;
  /** Short lines for the course panel. */
  notes: string[];
}

interface MissionBriefingProps {
  level: LevelConfig;
  weakArea?: WeakArea | null;
  /** In a New group, the routing FSM's move into this entry and why. Absent in Legacy. */
  courseNote?: CourseNote | null;
  onBack: () => void;
  onStartGame: () => void;
  /** The per-competency course's gate; absent in Legacy, which keeps its own quiz. */
  gate?: BriefingGate | null;
}

const getReadMinutes = (text: string) =>
  Math.max(2, Math.ceil(text.split(/\s+/).filter(Boolean).length / 180));

const moduleSubtitle = (title: string) => {
  if (title.toLowerCase().includes('tutorial')) {
    return 'Learn the module, quiz, simulation, scoring, and FSM flow before starting the road lessons.';
  }

  return 'Study the key LTO concepts, confirm your understanding, and apply them in a focused driving scenario.';
};

const MissionBriefing = ({ level, weakArea, courseNote, onBack, onStartGame, gate = null }: MissionBriefingProps) => {
  const levelModule = LEVEL_MODULES[level.moduleId] ?? getLevelModule(level.id);
  const levelResult = useProgressStore(state => state.levelResults[level.id]);
  // Only levels that draw from a sign pool have a syllabus to report progress
  // against; everywhere else this is simply absent.
  const coverage = useMemo(() => {
    const names = signNamesForLevel(level.id);
    return names.length ? summariseCoverage(names, loadSignCoverage()) : null;
  }, [level.id]);
  const simulationDone = Boolean(levelResult?.completed);
  const readMinutes = getReadMinutes(levelModule.desc);
  const subtitle = moduleSubtitle(levelModule.title);
  const primaryObjective = gate
    ? level.id === 0
      ? 'Learn how Arangkada works, then try the first guided drive.'
      : `Study ${levelModule.title}, pass the short quiz (3 items per competency, 2 of 3 to pass), then apply it in the drive: 3 scenarios per competency, 2 of 3 to pass each.`
    : level.id === 0
    ? `Learn how Arangkada works, pass the ${levelModule.quiz.length}-item tutorial checkpoint, then try the first guided simulation.`
    : `Study ${levelModule.title}, pass the ${levelModule.quiz.length}-item checkpoint, then apply the lesson in the driving simulation.`;
  const moduleBadge = levelModule.sourceLevel === 0 ? 'Tutorial Module' : `LTO Module ${levelModule.sourceLevel}`;
  const {
    lessonsRead,
    quizPassed,
    showReader,
    showQuiz,
    canStartQuiz,
    canStartMission,
    openReader,
    closeReader,
    closeQuiz,
    openQuiz,
    markLessonsRead,
    markQuizPassed,
  } = useBriefing(level.moduleId);
  const [showReview, setShowReview] = useState(false);
  // The attempt being sat, held while it is open: submitting it moves the
  // cursor (and the gate's quiz) on before its results are shown.
  const [activeQuiz, setActiveQuiz] = useState<NonNullable<BriefingGate['quiz']> | null>(null);

  const gatedSteps = gate && [
    {
      title: 'Learning Module',
      detail: `${levelModule.lessons.length} study notes`,
      done: gate.lessonsRead,
      active: !gate.lessonsRead,
      disabled: false,
      actionText: gate.lessonsRead ? 'Review' : 'Open',
      onClick: openReader,
      icon: BookOpen,
    },
    ...(gate.hasQuiz
      ? [
          {
            title: 'Short Quiz',
            detail: gate.quiz
              ? `Attempt ${gate.quiz.attempt} of ${gate.quiz.cap} · ${gate.quiz.items.length} items, 3 per competency`
              : gate.quizPassed
                ? 'Passed: 2 of 3 per competency'
                : '3 items per competency, 2 of 3 to pass',
            done: gate.quizPassed,
            active: gate.lessonsRead && gate.quiz !== null,
            disabled: !gate.lessonsRead || gate.quiz === null,
            actionText: gate.quizPassed ? 'Passed' : 'Start',
            onClick: () => gate.quiz && setActiveQuiz(gate.quiz),
            icon: BrainCircuit,
          },
        ]
      : []),
    ...(gate.review
      ? [
          {
            title: gate.review.title,
            detail: `${gate.review.lessons.length} module sections`,
            done: false,
            active: true,
            disabled: false,
            actionText: 'Read',
            onClick: () => setShowReview(true),
            icon: BookOpen,
          },
        ]
      : []),
    {
      title: 'Driving Simulation',
      detail: gate.driveDetail,
      done: false,
      active: gate.canDrive,
      disabled: !gate.canDrive,
      actionText: 'Drive',
      onClick: onStartGame,
      icon: Route,
    },
  ];

  const legacySteps = [
    {
      title: 'Learning Module',
      detail: `${levelModule.lessons.length} study notes`,
      done: lessonsRead,
      active: !lessonsRead,
      disabled: false,
      actionText: lessonsRead ? 'Review' : 'Open',
      onClick: openReader,
      icon: BookOpen,
    },
    {
      title: 'Short Quiz',
      detail: `${levelModule.quiz.length} checkpoint items`,
      done: quizPassed,
      active: canStartQuiz && !quizPassed,
      disabled: !canStartQuiz,
      actionText: quizPassed ? 'Retake' : 'Start',
      onClick: openQuiz,
      icon: BrainCircuit,
    },
    {
      title: 'Driving Simulation',
      detail: `${level.events.length} road events`,
      done: simulationDone,
      active: canStartMission && !simulationDone,
      disabled: !canStartMission,
      actionText: simulationDone ? 'Replay' : 'Drive',
      onClick: onStartGame,
      icon: Route,
    },
  ];
  const steps = gatedSteps ?? legacySteps;

  if (showReader) {
    return (
      <LessonReader
        module={levelModule}
        onClose={closeReader}
        onFinish={() => {
          if (gate) {
            closeReader();
            void gate.onLessonsRead();
          } else {
            markLessonsRead();
          }
        }}
      />
    );
  }

  if (showReview && gate?.review) {
    const review = gate.review;
    return (
      <LessonReader
        module={{ ...levelModule, title: `${levelModule.title}: ${review.title}`, lessons: review.lessons }}
        onClose={() => setShowReview(false)}
        onFinish={() => {
          setShowReview(false);
          void review.onDone();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen px-5 pb-12 pt-24 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <button
            onClick={onBack}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Map
          </button>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest text-primary">
              Level {level.id}
            </span>
            {levelModule.sourceLevel !== undefined && (
              <span className="rounded-lg border border-border bg-card px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {moduleBadge}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="rounded-lg border border-border bg-card p-6 md:p-8">
            <div className="mb-8 max-w-4xl">
              <p className="mb-3 font-display text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                Mission Briefing
              </p>
              <h1 className="text-3xl font-black uppercase leading-tight tracking-tight text-foreground md:text-5xl">
                {level.name}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                {subtitle}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <Route className="mb-3 h-5 w-5 text-primary" />
                <p className="font-display text-2xl font-black text-foreground">{level.events.length}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Road events</p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <Gauge className="mb-3 h-5 w-5 text-primary" />
                <p className="font-display text-2xl font-black text-foreground">{level.speedLimit}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Speed limit</p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <ListChecks className="mb-3 h-5 w-5 text-primary" />
                <p className="font-display text-2xl font-black text-foreground">{level.requiredScore}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Pass score</p>
              </div>
            </div>

            {/* How much of this level's sign syllabus the learner has actually
                met. Each attempt fills its slots from what is still unseen, so
                this is a progress bar through the material rather than a score. */}
            {coverage && (
              <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    Sign coverage
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-display text-base font-black text-foreground">{coverage.met}</span>
                    {' '}of {coverage.total} signs met
                    {coverage.mastered > 0 && ` · ${coverage.mastered} answered correctly`}
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((coverage.met / Math.max(1, coverage.total)) * 100)}%` }}
                  />
                </div>
                {coverage.struggling.length > 0 && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Coming back for: {coverage.struggling.slice(0, 3).join(', ')}
                    {coverage.struggling.length > 3 && ` and ${coverage.struggling.length - 3} more`}.
                  </p>
                )}
              </div>
            )}

            {/* The routing FSM's move into this entry, and why. The same panel in
                both groups; it never names the group or the policy. */}
            {gate && gate.notes.length > 0 && (
              <div className="mt-4 rounded-lg border-l-4 border-accent bg-accent/10 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Route className="h-4 w-4 text-accent" />
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                    Your Course
                  </p>
                </div>
                {gate.notes.map(line => (
                  <p key={line} className="mt-1 max-w-3xl text-sm leading-6 text-foreground">
                    {line}
                  </p>
                ))}
              </div>
            )}

            {courseNote && (
              <div className="mt-4 rounded-lg border-l-4 border-accent bg-accent/10 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Route className="h-4 w-4 text-accent" />
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                    Your Course
                  </p>
                </div>
                <p className="max-w-3xl text-base font-semibold leading-7 text-foreground">{courseNote.heading}</p>
                {courseNote.lines.map(line => (
                  <p key={line} className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* Pre-level heads-up driven by the same BKT competency scores the
                Q-learning recommendation uses - this level's pool selection
                (where it has one) is also biased toward this competency. */}
            {weakArea && (
              <div className="mt-4 rounded-lg border-l-4 border-signal-amber bg-signal-amber/10 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-signal-amber" />
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-signal-amber">
                    Weak Area Detected
                  </p>
                </div>
                <p className="max-w-3xl text-base font-semibold leading-7 text-foreground">
                  {getCompetencyLabel(weakArea.competency)} <span className="text-sm font-normal text-muted-foreground">({weakArea.score}%)</span>
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  This level will bring you more {getCompetencyLabel(weakArea.competency).toLowerCase()} questions to help you improve.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-lg border-l-4 border-primary bg-primary/10 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Primary Objective
                </p>
              </div>
              <p className="max-w-3xl text-base font-semibold leading-7 text-foreground">
                {primaryObjective}
              </p>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    Academy
                  </p>
                  <h2 className="mt-1 text-xl font-black uppercase leading-tight text-foreground">
                    {levelModule.title}
                  </h2>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="font-display text-lg font-black">{levelModule.lessons.length}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Notes</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="font-display text-lg font-black">{levelModule.quiz.length}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Quiz</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="font-display text-lg font-black">{readMinutes}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">Min</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {steps.map(step => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.title}
                      disabled={step.disabled}
                      onClick={step.onClick}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                        step.active
                          ? 'animate-pulse border-primary/50 bg-primary/15 shadow-lg shadow-primary/10 hover:bg-primary/25'
                          : step.done
                            ? 'border-accent/30 bg-accent/10'
                            : 'border-border bg-background/40 opacity-60'
                      }`}
                    >
                      <div className={`rounded-lg p-2 ${step.done ? 'text-accent' : step.active ? 'text-primary' : 'text-muted-foreground'}`}>
                        {step.done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black uppercase text-foreground">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.detail}</p>
                      </div>
                      <span className={`rounded-md px-2 py-1 font-display text-[9px] font-black uppercase tracking-wider ${
                        step.active
                          ? 'bg-primary text-primary-foreground'
                          : step.done
                            ? 'bg-accent/20 text-accent'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.actionText}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {activeQuiz && (
        <BankQuiz
          // A new attempt is a new paper.
          key={`attempt-${activeQuiz.attempt}`}
          items={activeQuiz.items}
          kind="quiz"
          title="Short Quiz"
          subtitle={`Attempt ${activeQuiz.attempt} of ${activeQuiz.cap}`}
          onSubmit={activeQuiz.onSubmit}
          onDone={() => {
            setActiveQuiz(null);
            activeQuiz.onDone();
          }}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      {!gate && showQuiz && (
        <MissionQuiz
          module={levelModule}
          onPass={markQuizPassed}
          onClose={closeQuiz}
        />
      )}
    </div>
  );
};

export default MissionBriefing;
