import { Star, ArrowLeft, RotateCcw, BarChart3, Target, AlertTriangle, Sparkles } from 'lucide-react';
import { LevelResult } from '@/domain/learner/attempt';
import { choiceLabel, isTutorial, LevelConfig, scenarioChoices } from '@/features/driving-sim';
import type { ActionLog } from '@/domain/learner/attempt';
import type { LevelRecommendation } from '@/features/driving-sim';
import { competencyText } from '@/domain/learner/profile';
import { FINAL_EXAM_LEVEL } from '@/domain/routing/routingTypes';
import { mistakesIn, starsForMistakes } from '@/domain/learner/stars';
import { publicAsset } from '@/shared/lib/publicAsset';
import { useText, type TextOf } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { resultMessages as m } from './messages';

interface LevelCompleteProps {
  result: LevelResult;
  level: LevelConfig;
  onNext: () => void;
  onRetry: () => void;
  onMenu: () => void;
  /** The menu button's words: the map, or a study participant's home. */
  menuLabel?: Localized;
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
  note: Localized | null;
  /** Null once the course is complete, or while the attempt is still being saved. */
  onContinue: (() => void) | null;
  /**
   * The per-competency course: the topics this
   * drive counted, and each one's verdict once saved. The course passes a
   * topic at 2 of its 3 and reads no score, so the screen shows these in place
   * of the stars, the score and the pass mark, and names only these topics.
   */
  topics?: readonly string[];
  verdicts?: readonly { competency: string; correct: number; total: number; passed: boolean }[] | null;
  /**
   * The course's verdict on the drive, once saved: every topic passed, or the
   * final exam's 70% of its scenarios. Null while saving or when the save
   * failed, and then the screen claims neither a pass nor a fail.
   */
  passed?: boolean | null;
}

const formatCompetency = (competency: string | null | undefined, t: TextOf) => t(competencyText(competency));

const formatValue = (value: string | null | undefined, t: TextOf) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : t(m.notRecorded);

/** A topic's count on this drive: never an estimate of what the player knows. */
interface TopicRow {
  competency: string;
  correct: number;
  total: number;
}

/**
 * The decisions this drive graded, counted as the stars count them
 * (`domain/learner/stars`): a standing penalty is no decision, and a practice
 * item scores nothing either way.
 */
const isCountedDecision = (log: ActionLog) =>
  (log.result === 'correct' || log.result === 'violation') && !log.standing && !log.remediation;

/** Each topic this drive put in front of the player, in the order met. */
const topicRowsOf = (logs: readonly ActionLog[]): TopicRow[] => {
  const rows = new Map<string, TopicRow>();
  for (const log of logs) {
    if (!isCountedDecision(log) || !log.competency) continue;
    const row = rows.get(log.competency) ?? { competency: log.competency, correct: 0, total: 0 };
    row.total += 1;
    if (log.result === 'correct') row.correct += 1;
    rows.set(log.competency, row);
  }
  return [...rows.values()];
};

/** The topic with the most mistakes on this drive (the first met on a tie), or null on a clean drive. */
const topicToWorkOn = (rows: readonly TopicRow[]): TopicRow | null =>
  rows.reduce<TopicRow | null>(
    (worst, row) => (row.total - row.correct > (worst ? worst.total - worst.correct : 0) ? row : worst),
    null,
  );

/**
 * What a decision was, in the words the player saw. A question (a garage or
 * crash-scene point, a frozen prompt) is named by its choices' labels: its
 * `action` is only the token a choice submits, and "You chose Accelerate"
 * would be read as the car's. A scenario driven with the car keeps its move.
 */
const describeDecision = (log: ActionLog, level: LevelConfig, t: TextOf) => {
  const choices = scenarioChoices(level, log.scenarioId);
  if (!choices) {
    return { question: false, chose: formatValue(log.action, t), expected: formatValue(log.expectedAction, t) };
  }
  return {
    question: true,
    chose: choiceLabel(choices, log.action) ?? (log.unanswered ? t(m.noAnswer) : formatValue(log.action, t)),
    expected: choiceLabel(choices, log.expectedAction) ?? formatValue(log.expectedAction, t),
  };
};

const LevelComplete = ({
  result,
  level,
  onNext,
  onRetry,
  onMenu,
  menuLabel = m.backToMap,
  hasNextLevel,
  recommendation,
  onPracticeRecommended,
  course,
}: LevelCompleteProps) => {
  const t = useText();
  const perTopic = course?.topics !== undefined;
  const verdicts = course?.verdicts ?? null;
  // In the course the pass is the course's own, never the points total.
  const passed = perTopic ? course?.passed === true : result.score >= level.requiredScore;
  const endedEarly = Boolean(result.crashReason || result.timedOut);
  const checking = perTopic && !endedEarly && (course?.passed ?? null) === null;
  // One rule on every level (2026-11-12): passed, then counted in mistakes.
  // In the course "passed" is the course's own verdict, never the points.
  // Display only: nothing reads them.
  const stars = !perTopic ? result.stars : !verdicts ? 0 : starsForMistakes(course?.passed === true, mistakesIn(result.logs));
  // The tutorial teaches the controls. Its steps carry a competency only because
  // their scenario type implies one, so naming skills after it would report as
  // knowledge what was a keypress: no breakdown, no focus, no practice.
  const tutorial = isTutorial(level);
  // Counts on this drive alone. The stored `competencyScores` (the frozen
  // design's BKT over this one drive) is never shown: one correct answer reads
  // 69% there. In the course the counts are the course's own verdicts once
  // saved, and the drive's logs on its topics until then.
  const topicRows: TopicRow[] = tutorial
    ? []
    : perTopic
      ? verdicts?.map(v => ({ competency: v.competency, correct: v.correct, total: v.total }))
        ?? topicRowsOf(result.logs).filter(row => course!.topics!.includes(row.competency))
      : topicRowsOf(result.logs);
  const hasProfile = topicRows.length > 0;
  const workOn = topicToWorkOn(topicRows);

  const recentEvaluations = result.logs
    .filter(log => (log.result === 'correct' || log.result === 'violation') && !log.standing)
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
              checking
                ? 'border-border bg-secondary text-muted-foreground'
                : passed
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {t(result.crashReason ? m.crashed : result.timedOut ? m.timesUp : checking ? m.checking : passed ? m.passed : m.failed)}
          </span>

          <h2 className="mt-1 font-display text-xl text-foreground">
            {t(endedEarly ? m.runEnded : checking ? m.driveFinished : passed ? m.levelComplete : m.tryAgain)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{level.name}</p>

          {/* A collision ends the run outright, so say plainly what happened. */}
          {result.crashReason && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs leading-5 text-foreground">{result.crashReason}</p>
            </div>
          )}

          {/* So does running out of driving time. */}
          {result.timedOut && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs leading-5 text-foreground">
                {t(m.timesUpNote)}
              </p>
            </div>
          )}

          {perTopic && (
            <div className="mt-5 space-y-2 text-left">
              {(verdicts ?? []).map(v => (
                <div key={v.competency} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                  <span className="text-xs font-medium text-foreground">{formatCompetency(v.competency, t)}</span>
                  <span className={`font-display text-xs ${v.passed ? 'text-accent' : 'text-destructive'}`}>
                    {t(endedEarly ? m.topicEnded(v.correct, v.total) : m.topicVerdict(v.correct, v.total, v.passed))}
                  </span>
                </div>
              ))}
              <p className="text-center text-[11px] text-muted-foreground">
                {t(
                  endedEarly
                    ? m.endedRule
                    : level.id === FINAL_EXAM_LEVEL
                    ? m.finalRule
                    : (verdicts ?? []).every(v => v.total === 3)
                    ? m.topicRule
                    : m.topicRuleUneven
                )}
              </p>
            </div>
          )}
          {/* Stars */}
          <div className="mt-5 flex justify-center gap-2">
            {[1, 2, 3].map(s => (
              <Star
                key={s}
                className={`h-9 w-9 transition-all duration-500 ${s <= stars
                  ? 'text-primary fill-primary drop-shadow-lg'
                  : 'text-muted-foreground/20'
                }`}
                style={{ animationDelay: `${s * 200}ms` }}
              />
            ))}
          </div>

          {!endedEarly && (
            <p className="mt-2 text-xs text-muted-foreground">{t(m.mistakes(mistakesIn(result.logs)))}</p>
          )}

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="font-display text-xl text-primary">{result.score}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t(m.score)}</p>
            </div>
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="font-display text-xl text-accent">{result.correctActions}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t(m.correct)}</p>
            </div>
            <div className="rounded-xl bg-secondary px-2 py-3">
              <p className="font-display text-xl text-destructive">{result.violations}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t(m.violations)}</p>
            </div>
          </div>

          {/* The course passes by its topics, never the points: no points pass mark there. */}
          {!perTopic && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t(m.passMark)} <span className="font-display text-foreground">{level.requiredScore}</span>
            </p>
          )}

          {/* Buttons */}
          {course ? (
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-xs leading-5 text-muted-foreground">{course.note && t(course.note)}</p>
              {course.onContinue && (
                <button
                  onClick={course.onContinue}
                  className="w-full rounded-xl bg-primary py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {t(m.continue)}
                </button>
              )}
              <button
                onClick={onMenu}
                className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                {t(menuLabel)}
              </button>
            </div>
          ) : (
          <div className="mt-6 flex flex-col gap-2">
            {passed && hasNextLevel && (
              <button
                onClick={onNext}
                className="w-full rounded-xl bg-primary py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t(m.nextLevel)}
              </button>
            )}
            {!tutorial && recommendation?.action === 'practice' && recommendation.recommendedLevelId !== null && onPracticeRecommended && (
              <button
                onClick={onPracticeRecommended}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 py-3 font-display text-sm tracking-wider text-accent transition-colors hover:bg-accent/20"
              >
                <Sparkles className="h-4 w-4" />
                {t(m.practice(formatCompetency(recommendation.competency, t).toUpperCase()))}
              </button>
            )}
            <button
              onClick={onRetry}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 font-display text-sm tracking-wider text-foreground transition-colors hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" />
              {t(m.retry)}
            </button>
            <button
              onClick={onMenu}
              className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              {t(menuLabel)}
            </button>
          </div>
          )}
        </div>

        {hasProfile && (
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto border-t border-border p-6 text-left lg:border-t-0">
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${workOn ? 'bg-primary/15 text-primary' : 'bg-accent/15 text-accent'}`}>
                  <Target className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {t(workOn ? m.focus : m.cleanHeading)}
                  </p>
                  {workOn ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-foreground">{formatCompetency(workOn.competency, t)}</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {t(m.focusNote(workOn.correct, workOn.total))}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-bold text-foreground">{t(m.cleanRun)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* In the course the topics and their verdicts stand in the outcome column already. */}
            {!perTopic && (
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {t(m.breakdown)}
                  </p>
                </div>

                <div className="space-y-2">
                  {topicRows.map(row => (
                    <div key={row.competency} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-foreground">{formatCompetency(row.competency, t)}</span>
                      <span className={`font-display ${row.correct === row.total ? 'text-accent' : 'text-signal-amber'}`}>
                        {t(m.topicCount(row.correct, row.total))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentEvaluations.length > 0 && (
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t(m.recent)}
                </p>
                <div className="space-y-2">
                  {recentEvaluations.map((log) => {
                    const decision = describeDecision(log, level, t);
                    return (
                    <div key={`${log.timestamp}-${log.action}`} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {formatCompetency(log.competency, t)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {decision.question
                            ? t(m.youAnswered(decision.chose))
                            : t(m.expectedChose(decision.expected, decision.chose))}
                        </p>
                        {decision.question && log.result !== 'correct' && (
                          <p className="text-[10px] text-muted-foreground">{t(m.correctIs(decision.expected))}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 font-display text-[9px] font-black uppercase ${
                        log.result === 'correct'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-destructive/15 text-destructive'
                      }`}>
                        {t(log.result === 'correct' ? m.answerRight : m.answerWrong)}
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {missedSigns.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="mb-1 font-display text-[10px] uppercase tracking-[0.2em] text-destructive">
                  {t(m.signsToRevise)}
                </p>
                <p className="mb-3 text-[11px] leading-4 text-muted-foreground">
                  {t(m.signsToReviseNote)}
                </p>
                <div className="space-y-2">
                  {missedSigns.map((sign, index) => (
                    <div
                      key={`${sign.name}-${index}`}
                      className="flex items-start gap-3 rounded-lg bg-background/70 p-2.5"
                    >
                      {sign.image && (
                        <img
                          src={publicAsset(sign.image)}
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
                          {t(m.expectedYou(formatValue(sign.expectedAction, t), formatValue(sign.action, t).toLowerCase()))}
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
