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
import { useCallback, useMemo } from 'react';
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
import { timeLimitSecondsFor } from '@/features/driving-sim/domain/scenario/levelTimeLimits';
import { FINAL_EXAM_LEVEL } from '@/domain/routing/routingTypes';
import { summariseCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { loadSignCoverage } from '@/features/driving-sim/application/signCoverage';
import { competencyText, getCompetencyLabel } from '@/domain/learner/profile';
import type { WeakArea } from '@/domain/learner/competency';
import type { CourseNote } from '@/features/driving-sim/domain/adaptive/routingBriefing';
import { useProgressStore } from '@/features/progression';
import { useAuthSession } from '@/features/auth';
import { useBriefing, type QuizGate } from '@/features/driving-sim/application/useBriefing';
import { recordQuizSitting, useLevelQuiz, type LevelQuizLoad } from '@/features/driving-sim/application/levelQuiz';
import type { QuizItemDoc, QuizSittingDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import LessonReader from './LessonReader';
import MissionQuiz from './MissionQuiz';
import type { TextOf } from '@/shared/i18n/useText';
import { briefingMessages as m } from './messages';

/**
 * The per-competency course's part of a briefing:
 * its own quiz draw and verdict in place of the level's sitting, and a drive
 * that opens only once the course has planned it.
 */
export interface BriefingCourse {
  /** The course's draw for this attempt; `no-quiz` once the quiz is behind the participant. */
  quiz: LevelQuizLoad;
  passes: (answers: Readonly<Record<string, number>>, items: readonly QuizItemDoc[]) => boolean;
  onQuizFinish: (sitting: QuizSittingDoc) => void;
  onQuizRetry: () => void;
  retryLoad: () => void;
  driveReady: boolean;
  /** This stage's quiz is behind the participant: its step stays, shown passed. */
  quizDone: boolean;
  /** The graded scenarios the planned drive counts; null until it is planned. */
  countedScenarios: number | null;
}

interface MissionBriefingProps {
  level: LevelConfig;
  weakArea?: WeakArea | null;
  /** In a New group, the routing FSM's move into this entry and why. Absent in Legacy. */
  courseNote?: CourseNote | null;
  onBack: () => void;
  onStartGame: () => void;
  course?: BriefingCourse | null;
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

const MissionBriefing = ({ level, weakArea, courseNote, onBack, onStartGame, course = null }: MissionBriefingProps) => {
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
  const own = useLevelQuiz(level.moduleId);
  const quizLoad = course ? course.quiz : own.quiz;
  const retryQuiz = course ? course.retryLoad : own.retry;
  const levelQuiz = quizLoad.kind === 'quiz' && !isTutorial(level) ? quizLoad.quiz : null;
  // The tutorial teaches the controls and has no quiz, whatever the bank holds for its module.
  const gate: QuizGate = isTutorial(level) ? 'open' : quizLoad.kind === 'quiz' ? 'required' : quizLoad.kind === 'no-quiz' ? 'open' : 'blocked';
  // A blocked quiz still shows its step: that is where the retry is.
  const hasQuiz = gate !== 'open' || (course?.quizDone ?? false);
  const quizSize = levelQuiz?.itemsPerSitting ?? 0;
  const readMinutes = moduleReadMinutes(levelModule);
  const subtitle = moduleSubtitle(level, hasQuiz, t);
  const checkpoint = levelQuiz
    ? t(m.checkpointSized(quizSize, isTutorial(level)))
    : hasQuiz
      ? t(m.checkpointPlain(isTutorial(level)))
      : t(m.thenOnly);
  const primaryObjective = isTutorial(level)
    ? t(m.objectiveTutorial(checkpoint))
    : t(m.objective(levelModule.title, checkpoint));
  const composition = missionComposition(level);
  const parts = compositionParts(composition, t);
  // The road tile's count is the road events; whatever else is scored is named
  // under it. A garage alone (Level 2) has no road to count, so the tile counts
  // its checks instead.
  const garageTile = composition.road === 0 && composition.garage > 0;
  const otherParts = parts
    .filter(part => !(garageTile ? / garage checks?$/ : / road events?$/).test(part))
    .map(part => (part.startsWith('+') ? part : `+${part}`));
  const limitsLine = isTutorial(level) ? null : postedLimitsLine(postedLimits(level), t);
  const timeLimit = timeLimitSecondsFor(level.id);
  const { isAdmin, user } = useAuthSession();
  const uid = user?.uid ?? null;
  const moduleBadge = t(levelModule.sourceLevel === 0 ? m.tutorialModule : m.manualModuleNumber(levelModule.sourceLevel));
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
  } = useBriefing(level.moduleId, gate, isAdmin);

  // Signed-in players only: a guest's sittings are never stored.
  const handleQuizFinish = useCallback(
    (sitting: QuizSittingDoc) => {
      if (course) course.onQuizFinish(sitting);
      else if (uid) recordQuizSitting(uid, sitting);
    },
    [uid, course]
  );

  const quizStep = course?.quizDone
    ? { detail: t(m.coursePassed), actionText: t(m.coursePassed), disabled: true, active: false, onClick: openQuiz }
    : quizLoad.kind === 'loading'
      ? { detail: t(m.loadingCheckpoint), actionText: t(m.loading), disabled: true, active: false, onClick: openQuiz }
      : gate === 'blocked'
        ? { detail: t(m.quizLoadFailed), actionText: t(m.retry), disabled: false, active: true, onClick: retryQuiz }
        : {
            detail: t(m.checkpointItems(quizSize)),
            actionText: t(quizPassed ? m.retake : m.start),
            disabled: !canStartQuiz,
            active: canStartQuiz && !quizPassed,
            onClick: openQuiz,
          };

  const allSteps = [
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
      done: (quizPassed && gate === 'required') || (course?.quizDone ?? false),
      icon: BrainCircuit,
    },
    {
      title: t(m.drivingSimulation),
      detail: course && course.countedScenarios !== null ? t(m.courseCounted(course.countedScenarios)) : parts.join(' · '),
      done: course ? false : simulationDone,
      active: canStartMission && (course ? course.driveReady : !simulationDone),
      disabled: !canStartMission || (course !== null && !course.driveReady),
      actionText: t(simulationDone && !course ? m.replay : m.drive),
      onClick: onStartGame,
      icon: Route,
    },
  ];
  // A level with no quiz has no quiz step to show.
  const steps = hasQuiz ? allSteps : allSteps.filter(step => step.title !== t(m.shortQuiz));

  if (showReader) {
    return (
      <LessonReader
        module={levelModule}
        quizSize={levelQuiz ? quizSize : gate === 'open' ? 0 : undefined}
        onClose={closeReader}
        onFinish={markLessonsRead}
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
                <p className="font-display text-2xl font-black text-foreground">{garageTile ? composition.garage : composition.road}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(garageTile ? m.garageChecks : m.roadEvents)}</p>
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

            {/* The routing FSM's move into this entry, and why. The same panel in both groups; it never
                names the group or the policy. */}
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

      {showQuiz && levelQuiz && (
        <MissionQuiz
          quiz={levelQuiz}
          levelId={level.id}
          onPass={markQuizPassed}
          onClose={closeQuiz}
          onFinish={handleQuizFinish}
          course={course ? { passes: course.passes, onRetry: () => { closeQuiz(); course.onQuizRetry(); } } : undefined}
        />
      )}
    </div>
  );
};

export default MissionBriefing;
