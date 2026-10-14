import { Star, ArrowLeft, RotateCcw, BarChart3, ClipboardList, Target, AlertTriangle, Sparkles } from 'lucide-react';
import { LevelResult } from '@/domain/learner/attempt';
import { LevelConfig } from '@/features/driving-sim';
import type { ActionLog } from '@/domain/learner/attempt';
import type { LevelRecommendation } from '@/features/driving-sim';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { useAuthSession } from '@/features/auth';

interface LevelCompleteProps {
  result: LevelResult;
  level: LevelConfig;
  onNext: () => void;
  onRetry: () => void;
  onMenu: () => void;
  hasNextLevel: boolean;
  /** Q-learning-driven suggestion - a highlight only, never a forced redirect. */
  recommendation?: LevelRecommendation | null;
  onPracticeRecommended?: () => void;
  /**
   * In a New group the routing FSM decides what comes next, so the
   * screen offers Continue and the map in place of Next, Retry and the
   * suggestion. Absent in Legacy.
   */
  course?: LevelCompleteCourse | null;
}

export interface LevelCompleteCourse {
  /** What Continue leads to, in a sentence. */
  note: string;
  /** Null once the course is complete, or while the attempt is still being saved. */
  onContinue: (() => void) | null;
}

const formatCompetency = getCompetencyLabel;

/**
 * Competencies are seeded at 100 and only move when the run touches them, so a
 * score alone can't tell "never driven" from "driven perfectly". The run log
 * can: these are the skills this level actually put in front of the player.
 */
const getPracticedCompetencies = (logs: ActionLog[], scores: Record<string, number>) => {
  const practiced = new Set<string>();
  for (const log of logs) {
    if ((log.result === 'correct' || log.result === 'violation') && log.competency) {
      practiced.add(log.competency);
    }
  }

  return [...practiced]
    .map(competency => [competency, scores[competency] ?? 100] as [string, number])
    .sort((a, b) => a[1] - b[1]);
};

const formatValue = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : 'Not recorded';

const getMasteryState = (score: number) => {
  if (score >= 85) {
    return {
      label: 'Mastered',
      phase: 'Level Complete',
      className: 'text-accent',
      barClassName: 'bg-accent',
    };
  }

  if (score >= 70) {
    return {
      label: 'Improving',
      phase: 'Mastery Check',
      className: 'text-primary',
      barClassName: 'bg-primary',
    };
  }

  if (score >= 50) {
    return {
      label: 'Needs Practice',
      phase: 'Remediation',
      className: 'text-signal-amber',
      barClassName: 'bg-signal-amber',
    };
  }

  return {
    label: 'Critical',
    phase: 'Remediation',
    className: 'text-destructive',
    barClassName: 'bg-destructive',
  };
};

/**
 * Players get plain driving-school language; the FSM/learning-model vocabulary
 * is kept for admins reviewing a run.
 */
const copyFor = (isAdmin: boolean) => isAdmin
  ? {
    focus: 'Layered FSM Learning State',
    strength: 'Layered FSM Learning State',
    report: 'After-Action Report',
    mastery: 'Mastery Estimate',
    recent: 'Recent Evaluations',
    steps: ['Action Captured', 'Rule Evaluation', 'Learning State', 'Recommendation'],
  }
  : {
    focus: 'Focus Area',
    strength: 'Strongest Skill',
    report: 'What Happened',
    mastery: 'Skill Breakdown',
    recent: 'Recent Decisions',
    steps: ['What you did', 'How it was judged', 'What happened next', 'Practice next'],
  };

const buildAfterActionSteps = (
  logs: ActionLog[],
  weakestCompetency: string | null | undefined,
  labels: string[],
  isAdmin: boolean,
) => {
  const evaluated = logs.filter(log => log.result === 'correct' || log.result === 'violation');
  const firstViolation = evaluated.find(log => log.result === 'violation');
  const keyLog = firstViolation ?? evaluated[0];

  if (!keyLog) return [];

  const isViolation = keyLog.result === 'violation';

  return [
    {
      label: labels[0],
      value: `You chose ${formatValue(keyLog.action)}.`,
    },
    {
      label: labels[1],
      value: isViolation
        ? `${formatValue(keyLog.severity)} ${formatCompetency(keyLog.competency)} violation detected.`
        : `${formatCompetency(keyLog.competency)} decision was correct.`,
    },
    {
      label: labels[2],
      value: isViolation
        ? isAdmin
          ? 'Feedback moved the learner into remediation.'
          : 'You were shown a correction before driving on.'
        : isAdmin
          ? 'Practice continued toward mastery.'
          : 'You carried on without a penalty.',
    },
    {
      label: labels[3],
      value: weakestCompetency
        ? `Focus next practice on ${formatCompetency(weakestCompetency)}.`
        : 'Continue to the next scenario.',
    },
  ];
};

const LevelComplete = ({
  result,
  level,
  onNext,
  onRetry,
  onMenu,
  hasNextLevel,
  recommendation,
  onPracticeRecommended,
  course,
}: LevelCompleteProps) => {
  const passed = result.score >= level.requiredScore;
  const competencyEntries = getPracticedCompetencies(result.logs, result.competencyScores ?? {}).slice(0, 6);
  const hasProfile = competencyEntries.length > 0;

  // Sorted weakest-first: anything below 100 is what to work on, otherwise the
  // run was clean and the top skill is worth naming instead.
  const weakest = competencyEntries.find(([, score]) => score < 100) ?? null;
  const strongest = competencyEntries.length ? competencyEntries[competencyEntries.length - 1] : null;
  const isCleanRun = !weakest;
  const highlight = weakest ?? strongest;
  const highlightState = getMasteryState(highlight?.[1] ?? 100);

  const { isAdmin } = useAuthSession();
  const copy = copyFor(isAdmin);
  const afterActionSteps = buildAfterActionSteps(result.logs, weakest?.[0] ?? null, copy.steps, isAdmin);
  const recentEvaluations = result.logs
    .filter(log => log.result === 'correct' || log.result === 'violation')
    .slice(-3)
    .reverse();

  // The signs this run got wrong, deduplicated and shown with their artwork.
  // A score alone tells a learner they failed; this tells them what to read.
  const missedSigns = (result.signOutcomes ?? [])
    .filter(outcome => !outcome.isCorrect)
    .filter((outcome, index, all) => all.findIndex(o => o.name === outcome.name) === index);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ${
          hasProfile ? 'max-w-4xl lg:flex-row' : 'max-w-md'
        }`}
      >
        {/* Outcome */}
        <div
          className={`flex min-h-0 min-w-0 flex-col overflow-y-auto border-border bg-gradient-to-b from-secondary/40 to-transparent p-6 text-center ${
            hasProfile ? 'lg:w-[320px] lg:shrink-0 lg:justify-center lg:border-r' : ''
          }`}
        >
          <span
            className={`mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.2em] ${
              passed
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {result.crashReason ? 'CRASHED' : passed ? 'PASSED' : 'FAILED'}
          </span>

          <h2 className="mt-1 font-display text-xl text-foreground">
            {result.crashReason ? 'RUN ENDED' : passed ? 'LEVEL COMPLETE' : 'TRY AGAIN'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{level.name}</p>

          {/* A collision ends the run outright, so say plainly what happened. */}
          {result.crashReason && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs leading-5 text-foreground">{result.crashReason}</p>
            </div>
          )}

          {/* Stars */}
          <div className="mt-5 flex justify-center gap-2">
            {[1, 2, 3].map(s => (
              <Star
                key={s}
                className={`h-9 w-9 transition-all duration-500 ${s <= result.stars
                  ? 'text-primary fill-primary drop-shadow-lg'
                  : 'text-muted-foreground/20'
                }`}
                style={{ animationDelay: `${s * 200}ms` }}
              />
            ))}
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="font-display text-xl text-primary">{result.score}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
            </div>
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="font-display text-xl text-accent">{result.correctActions}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="font-display text-xl text-destructive">{result.violations}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Violations</p>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Pass mark <span className="font-display text-foreground">{level.requiredScore}</span>
          </p>

          {/* Buttons */}
          {course ? (
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-xs leading-5 text-muted-foreground">{course.note}</p>
              {course.onContinue && (
                <button
                  onClick={course.onContinue}
                  className="w-full rounded-xl bg-primary py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                >
                  CONTINUE →
                </button>
              )}
              <button
                onClick={onMenu}
                className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Map
              </button>
            </div>
          ) : (
          <div className="mt-6 flex flex-col gap-2">
            {passed && hasNextLevel && (
              <button
                onClick={onNext}
                className="w-full rounded-xl bg-primary py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
              >
                NEXT LEVEL →
              </button>
            )}
            {recommendation?.action === 'practice' && recommendation.recommendedLevelId !== null && onPracticeRecommended && (
              <button
                onClick={onPracticeRecommended}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 py-3 font-display text-sm tracking-wider text-accent transition-colors hover:bg-accent/20"
              >
                <Sparkles className="h-4 w-4" />
                PRACTICE {formatCompetency(recommendation.competency).toUpperCase()} →
              </button>
            )}
            <button
              onClick={onRetry}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 font-display text-sm tracking-wider text-foreground transition-colors hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" />
              RETRY
            </button>
            <button
              onClick={onMenu}
              className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Map
            </button>
          </div>
          )}
        </div>

        {hasProfile && (
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto border-t border-border p-6 text-left lg:border-t-0">
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${isCleanRun ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'}`}>
                  <Target className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {isCleanRun ? copy.strength : copy.focus}
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {formatCompetency(highlight?.[0])}
                    {highlight && (
                      <span className={`ml-2 font-display text-xs ${highlightState.className}`}>
                        {highlight[1]}% - {highlightState.label}
                      </span>
                    )}
                  </p>
                  {isAdmin ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Suggested phase: <span className="font-semibold text-foreground">{highlightState.phase}</span>.{' '}
                      {isCleanRun
                        ? 'No competency fell below mastery on this run.'
                        : 'The system uses your weakest competency to guide the next practice state.'}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {isCleanRun
                        ? 'You handled this best on this run. Nothing dropped below full marks, so the next level moves on to new ground.'
                        : course
                          // No weak-area roll in a New group: the next run is the routing FSM's.
                          ? 'This is the skill you lost the most points on.'
                          : 'This is the skill you lost the most points on. Your next run will put more of it in your way.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {afterActionSteps.length > 0 && (
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {copy.report}
                  </p>
                </div>

                <div className="space-y-3">
                  {afterActionSteps.map((step, index) => (
                    <div key={step.label} className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-[10px] font-black text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-foreground">{step.label}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {copy.mastery}
                </p>
              </div>

              <div className="space-y-3">
                {competencyEntries.map(([competency, score]) => {
                  const state = getMasteryState(score);

                  return (
                    <div key={competency} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-foreground">{formatCompetency(competency)}</span>
                        <span className={`font-display ${state.className}`}>{score}% - {state.label}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${state.barClassName}`}
                          style={{ width: `${Math.max(4, score)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {recentEvaluations.length > 0 && (
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {copy.recent}
                </p>
                <div className="space-y-2">
                  {recentEvaluations.map((log) => (
                    <div key={`${log.timestamp}-${log.action}`} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {formatCompetency(log.competency)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Expected {formatValue(log.expectedAction)} - chose {formatValue(log.action)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 font-display text-[9px] font-black uppercase ${
                        log.result === 'correct'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-destructive/15 text-destructive'
                      }`}>
                        {log.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {missedSigns.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="mb-1 font-display text-[10px] uppercase tracking-[0.2em] text-destructive">
                  Signs and markings to revise
                </p>
                <p className="mb-3 text-[11px] leading-4 text-muted-foreground">
                  These came up on this drive and were answered wrongly. They will be brought
                  back on your next attempts until you get them right.
                </p>
                <div className="space-y-2">
                  {missedSigns.map((sign, index) => (
                    <div
                      key={`${sign.name}-${index}`}
                      className="flex items-start gap-3 rounded-lg bg-background/70 p-2.5"
                    >
                      {sign.image && (
                        <img
                          src={`/${sign.image}`}
                          alt={sign.name}
                          className="h-14 w-14 shrink-0 rounded-md border border-border bg-white object-contain p-1"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black leading-tight text-foreground">{sign.name}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {sign.category}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-foreground">{sign.meaning}</p>
                        <p className="mt-1 text-[10px] leading-4 text-destructive">
                          Expected {formatValue(sign.expectedAction)} — you {formatValue(sign.action).toLowerCase()}.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LevelComplete;
