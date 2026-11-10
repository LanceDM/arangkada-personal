import { useLanguage, useText } from '@/shared/i18n/useText';
import { playableModule } from '@/features/driving-sim/application/use-cases/playableLevel';
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
import { useCallback, useMemo, useState } from 'react';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { rollLeansToWeakArea, signNamesForLevel } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { getLevelModule, LEVEL_MODULES } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { moduleReadMinutes } from '@/features/driving-sim/domain/scenario/lessonModule';
import {
  compositionParts,
  missionComposition,
  postedLimits,
  postedLimitsLine,
} from '@/features/driving-sim/domain/scenario/missionComposition';
import { isTutorial } from '@/features/driving-sim/domain/systems/tutorial';
import { PANEL_SECONDS, timeLimitSecondsFor } from '@/features/driving-sim/domain/scenario/levelTimeLimits';
import { FINAL_EXAM_LEVEL } from '@/domain/routing/routingTypes';
import { summariseCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { loadSignCoverage } from '@/features/driving-sim/application/signCoverage';
import { competencyText, getCompetencyLabel } from '@/domain/learner/profile';
import type { WeakArea } from '@/domain/learner/competency';
import type { CourseNote } from '@/features/driving-sim/domain/adaptive/routingBriefing';
import { useProgressStore } from '@/features/progression';
import { useAuthSession } from '@/features/auth';
import { useBriefing, type QuizGate } from '@/features/driving-sim/application/useBriefing';
import { recordQuizSitting, useLevelQuiz } from '@/features/driving-sim/application/levelQuiz';
import type { QuizSittingDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import LessonReader from './LessonReader';
import MissionQuiz from './MissionQuiz';
import type { TextOf } from '@/shared/i18n/useText';
import { briefingMessages as m } from './messages';
import BankQuiz, { type BankQuizResult } from './BankQuiz';
import DriveOverview from './DriveOverview';
import type { DrivePreview } from '@/features/driving-sim/domain/scenario/drivePreview';
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
    onSubmit: (choices: (number | null)[], responseMs: (number | null)[]) => Promise<BankQuizResult[]>;
    /** Each answer as it is given, for the log. */
    onAnswer?: (position: number, item: BankItem, choice: number, responseMs: number) => void;
    onDone: () => void;
  } | null;
  /** Whether the stage has a quiz at all (the tutorial has none). */
  hasQuiz: boolean;
  quizPassed: boolean;
  /** Module sections to read before the drive: after the quiz cap, or after a review decision. */
  review: { title: string; lessons: Lesson[]; onDone: () => Promise<void> } | null;
  canDrive: boolean;
  driveDetail: string;
  /** The planned drive's setting and scenarios, shown before it starts. */
  preview: DrivePreview | null;
  /** Short lines for the course panel. */
  notes: string[];
  /** Every action on the briefing, for the study log (module, quiz, review, overview, drive). */
  log?: (action: string, detail?: Record<string, unknown>) => void;
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

const moduleSubtitle = (level: LevelConfig, hasQuiz: boolean, t: TextOf) => {
  if (isTutorial(level)) {
    return hasQuiz
      ? t(m.tutorialSubtitleQuiz)
      : t(m.tutorialSubtitle);
  }
  if (level.id === FINAL_EXAM_LEVEL) {
    return t(m.finalSubtitle);
  }

  return hasQuiz
    ? t(m.levelSubtitleQuiz)
    : t(m.levelSubtitle);
};

/** What the Legacy weak-area panel may promise: only Levels 1-5 roll toward it. */
/** "3 min 30 s", "4 min". */
const timeLimitLabel = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return [minutes > 0 && `${minutes} min`, rest > 0 && `${rest} s`].filter(Boolean).join(' ');
};

const weakAreaLine = (levelId: number, label: string, t: TextOf) =>
  rollLeansToWeakArea(levelId)
    ? t(m.weakRoll(label))
    : t(m.weakPractice);

const MissionBriefing = ({ level, weakArea, courseNote, onBack, onStartGame, gate = null }: MissionBriefingProps) => {
  const t = useText();
  const { language } = useLanguage();
  const authoredModule = LEVEL_MODULES[level.moduleId] ?? getLevelModule(level.id);
  const levelModule = useMemo(() => playableModule(authoredModule, language), [authoredModule, language]);
  const levelResult = useProgressStore(state => state.levelResults[level.id]);
  // Only levels that draw from a sign pool have a syllabus to report progress
  // against; everywhere else this is simply absent.
  const coverage = useMemo(() => {
    const names = signNamesForLevel(level.id);
    return names.length ? summariseCoverage(names, loadSignCoverage()) : null;
  }, [level.id]);
  const simulationDone = Boolean(levelResult?.completed);
  // Legacy's module quiz, read from the bank. The per-competency course (`gate`)
  // draws its own quiz from the same bank, by competency, and ignores this one.
  const { quiz: quizLoad, retry: retryQuiz } = useLevelQuiz(level.moduleId);
  const levelQuiz = quizLoad.kind === 'quiz' ? quizLoad.quiz : null;
  const quizGate: QuizGate = gate ? 'open' : quizLoad.kind === 'quiz' ? 'required' : quizLoad.kind === 'no-quiz' ? 'open' : 'blocked';
  // A blocked quiz still shows its step: that is where the retry is.
  const hasQuiz = gate ? gate.hasQuiz : quizGate !== 'open';
  const quizSize = levelQuiz?.itemsPerSitting ?? 0;
  const readMinutes = moduleReadMinutes(levelModule);
  const subtitle = moduleSubtitle(level, hasQuiz, t);
  const checkpoint = gate
    ? t(m.courseCheckpoint)
    : levelQuiz
      ? t(m.checkpointSized(quizSize, isTutorial(level)))
      : hasQuiz
        ? t(m.checkpointPlain(isTutorial(level)))
        : t(m.thenOnly);
  const primaryObjective = gate
    ? isTutorial(level)
      ? t(m.courseObjectiveTutorial)
      : t(m.courseObjective(levelModule.title))
    : isTutorial(level)
      ? t(m.objectiveTutorial(checkpoint))
      : t(m.objective(levelModule.title, checkpoint));
  const composition = missionComposition(level);
  const parts = compositionParts(composition, t);
  // The road tile's count is the road events; whatever else is scored is named under it.
  const otherParts = parts
    .filter(part => !/ road events?$/.test(part))
    .map(part => (part.startsWith('+') ? part : `+${part}`));
  const limitsLine = isTutorial(level) ? null : postedLimitsLine(postedLimits(level), t);
  const timeLimit = timeLimitSecondsFor(level.id);
  const { isAdmin, user } = useAuthSession();
  const uid = user?.uid ?? null;
  const moduleBadge = t(levelModule.sourceLevel === 0 ? m.tutorialModule : m.ltoModule(levelModule.sourceLevel));
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
  } = useBriefing(level.moduleId, quizGate, isAdmin);

  // Signed-in players only: a guest's sittings are never stored.
  const handleQuizFinish = useCallback(
    (sitting: QuizSittingDoc) => {
      if (uid) recordQuizSitting(uid, sitting);
    },
    [uid]
  );

  const quizStep =
    quizLoad.kind === 'loading'
      ? { detail: t(m.loadingCheckpoint), actionText: t(m.loading), disabled: true, active: false, onClick: openQuiz }
      : quizGate === 'blocked'
        ? { detail: t(m.quizLoadFailed), actionText: t(m.retry), disabled: false, active: true, onClick: retryQuiz }
        : {
            detail: t(m.checkpointItems(quizSize)),
            actionText: t(quizPassed ? m.retake : m.start),
            disabled: !canStartQuiz,
            active: canStartQuiz && !quizPassed,
            onClick: openQuiz,
          };

  const [showReview, setShowReview] = useState(false);
  // The drive's overview, opened by the Drive step before the drive starts.
  const [showOverview, setShowOverview] = useState(false);
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
      onClick: () => {
        gate.log?.('module_opened', { review: gate.lessonsRead });
        openReader();
      },
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
            onClick: () => {
              if (!gate.quiz) return;
              gate.log?.('quiz_opened', { attempt: gate.quiz.attempt, items: gate.quiz.items.map(item => item.id) });
              setActiveQuiz(gate.quiz);
            },
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
            onClick: () => {
              gate.log?.('review_opened', { title: gate.review?.title ?? null, lessons: gate.review?.lessons.map(lesson => lesson.id) ?? [] });
              setShowReview(true);
            },
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
      onClick: () => {
        gate.log?.(gate.preview ? 'drive_overview_opened' : 'drive_start_clicked');
        if (gate.preview) setShowOverview(true);
        else onStartGame();
      },
      icon: Route,
    },
  ];

  const legacySteps = [
    {
      title: t(m.learningModule),
      detail: t(m.studyNotes(levelModule.lessons.length)),
      done: lessonsRead,
      active: !lessonsRead,
      disabled: false,
      actionText: t(lessonsRead ? m.review : m.open),
      onClick: openReader,
      icon: BookOpen,
    },
    {
      title: t(m.shortQuiz),
      ...quizStep,
      done: quizPassed && quizGate === 'required',
      icon: BrainCircuit,
    },
    {
      title: t(m.drivingSimulation),
      detail: parts.join(' · '),
      done: simulationDone,
      active: canStartMission && !simulationDone,
      disabled: !canStartMission,
      actionText: t(simulationDone ? m.replay : m.drive),
      onClick: onStartGame,
      icon: Route,
    },
  ];
  // The course's own steps; otherwise Legacy's, where a level with no quiz has no quiz step to show.
  const steps = gatedSteps ?? (hasQuiz ? legacySteps : legacySteps.filter(step => step.title !== t(m.shortQuiz)));

  if (showReader) {
    return (
      <LessonReader
        module={levelModule}
        quizSize={gate ? (gate.hasQuiz ? gate.quiz?.items.length ?? 3 : 0) : levelQuiz ? quizSize : quizGate === 'open' ? 0 : undefined}
        onReadEvent={gate?.log ? event => gate.log?.(`lesson_${event.action}`, { ...event, module: levelModule.id }) : undefined}
        onClose={() => {
          gate?.log?.('module_closed', { module: levelModule.id });
          closeReader();
        }}
        onFinish={() => {
          if (gate) {
            gate.log?.('module_finished', { module: levelModule.id });
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
        onReadEvent={gate?.log ? event => gate.log?.(`review_${event.action}`, { ...event, module: levelModule.id }) : undefined}
        onClose={() => {
          gate?.log?.('review_closed', { module: levelModule.id });
          setShowReview(false);
        }}
        onFinish={() => {
          gate?.log?.('review_finished', { module: levelModule.id });
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
            onClick={() => {
              gate?.log?.('briefing_back');
              onBack();
            }}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t(m.backToMap)}
          </button>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 font-display text-[10px] font-black uppercase tracking-widest text-primary">
              {t(m.level(level.id))}
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
                {t(m.title)}
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
                <p className="font-display text-2xl font-black text-foreground">{composition.road}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(m.roadEvents)}</p>
                {otherParts.length > 0 && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{otherParts.join(' · ')}</p>
                )}
              </div>
              {/* The tutorial's limit is also the car's top speed there
. Elsewhere the road's limit is what the car cruises
                  under, and a scenario's own sign is what it is graded on. */}
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <Gauge className="mb-3 h-5 w-5 text-primary" />
                <p className="font-display text-2xl font-black text-foreground">
                  {level.speedLimit}
                </p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t(isTutorial(level) ? m.courseLimit : m.roadLimit)}
                </p>
                {limitsLine && <p className="mt-2 text-xs leading-5 text-muted-foreground">{limitsLine}</p>}
                {/* The level's driving time, said before the drive so
                    time's up is never a surprise. */}
                {timeLimit !== null && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {t(m.drivingTime(timeLimitLabel(timeLimit)))}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <ListChecks className="mb-3 h-5 w-5 text-primary" />
                <p className="whitespace-nowrap font-display text-2xl font-black text-foreground">
                  {level.requiredScore}
                  <span className="text-base text-muted-foreground"> / {composition.maxScore}</span>
                </p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(m.passScore)}</p>
                {courseNote?.practiceOnly && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {t(m.forPractice)}
                  </p>
                )}
              </div>
            </div>

            {/* How much of this level's sign syllabus the learner has actually
                met. Each attempt fills its slots from what is still unseen, so
                this is a progress bar through the material rather than a score. */}
            {coverage && (
              <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    {t(m.signCoverage)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-display text-base font-black text-foreground">{coverage.met}</span>
                    {t(m.signsMet(coverage.total))}
                    {coverage.mastered > 0 && t(m.answeredCorrectly(coverage.mastered))}
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
                    {t(m.comingBack(coverage.struggling.slice(0, 3).join(', '), coverage.struggling.length - 3))}
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
                    {t(m.yourCourse)}
                  </p>
                </div>
                <p className="max-w-3xl text-base font-semibold leading-7 text-foreground">{t(courseNote.heading)}</p>
                {courseNote.lines.map(line => (
                  <p key={line.en} className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {t(line)}
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
                    {t(m.weakArea)}
                  </p>
                </div>
                <p className="max-w-3xl text-base font-semibold leading-7 text-foreground">
                  {t(competencyText(weakArea.competency))} <span className="text-sm font-normal text-muted-foreground">({weakArea.score}%)</span>
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {weakAreaLine(level.id, getCompetencyLabel(weakArea.competency).toLowerCase(), t)}
                </p>
              </div>
            )}

            <div className="mt-6 rounded-lg border-l-4 border-primary bg-primary/10 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  {t(m.objectiveLabel)}
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
                    {t(m.academy)}
                  </p>
                  <h2 className="mt-1 text-xl font-black uppercase leading-tight text-foreground">
                    {levelModule.title}
                  </h2>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
              </div>

              <div className={`grid gap-2 ${hasQuiz ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="font-display text-lg font-black">{levelModule.lessons.length}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{t(m.notes)}</p>
                </div>
                {hasQuiz && (
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="font-display text-lg font-black">{levelQuiz ? quizSize : '–'}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{t(m.quiz)}</p>
                  </div>
                )}
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="font-display text-lg font-black">{readMinutes}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{t(m.minutes)}</p>
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

      {showOverview && gate?.preview && (
        <DriveOverview
          preview={gate.preview}
          questionLimitSec={PANEL_SECONDS}
          onClose={() => {
            gate.log?.('drive_overview_closed');
            setShowOverview(false);
          }}
          onStart={() => {
            gate.log?.('drive_start_clicked');
            setShowOverview(false);
            onStartGame();
          }}
        />
      )}

      {activeQuiz && (
        <BankQuiz
          // A new attempt is a new paper.
          key={`attempt-${activeQuiz.attempt}`}
          items={activeQuiz.items}
          kind="quiz"
          title="Short Quiz"
          subtitle={`Attempt ${activeQuiz.attempt} of ${activeQuiz.cap}`}
          onSubmit={activeQuiz.onSubmit}
          onAnswer={activeQuiz.onAnswer}
          onDone={() => {
            setActiveQuiz(null);
            activeQuiz.onDone();
          }}
          onClose={() => {
            gate?.log?.('quiz_closed', { attempt: activeQuiz.attempt });
            setActiveQuiz(null);
          }}
        />
      )}

      {!gate && showQuiz && levelQuiz && (
        <MissionQuiz
          quiz={levelQuiz}
          levelId={level.id}
          onPass={markQuizPassed}
          onClose={closeQuiz}
          onFinish={handleQuizFinish}
        />
      )}
    </div>
  );
};

export default MissionBriefing;
