import { ArrowLeft, CalendarDays, CheckCircle2, Flame, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { streakBadges } from '../domain/dailyScenarios';
import { useDailyChallenge } from '../application/useDailyChallenge';

interface DailyChallengeProps {
  onBack: () => void;
  /** Every action and answer, for the study log (the page decides where it goes). */
  onEvent?: (action: string, detail?: Record<string, unknown>) => void;
}

export const DailyChallenge = ({ onBack, onEvent }: DailyChallengeProps) => {
  const daily = useDailyChallenge();
  const { scenario, streak, selectedIndex, revealed, alreadyDone } = daily;
  const answer = (index: number) => {
    onEvent?.('daily_answer', { scenarioId: scenario.id, choice: index, correct: scenario.choices[index]?.correct ?? null });
    daily.answer(index);
  };

  const settled = revealed || alreadyDone;
  const selectedChoice = selectedIndex !== null ? scenario.choices[selectedIndex] : null;
  const badges = streakBadges(streak.longestStreak);

  const choiceStyle = (index: number, correct: boolean) => {
    if (!settled) return 'bg-card border-border hover:border-primary/40';
    if (correct) return 'bg-accent/10 border-accent';
    if (selectedIndex === index) return 'bg-destructive/10 border-destructive';
    return 'bg-card border-border opacity-50';
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {streak.currentStreak > 0 && (
            <div className="flex items-center gap-1 text-signal-amber font-display font-bold text-sm">
              <Flame className="w-5 h-5" />
              {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CalendarDays className="w-5 h-5 text-signal-amber" />
            <h1 className="font-display text-xl font-bold">ARAW-ARAW</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Daily Challenge —{' '}
            {new Date().toLocaleDateString('en-PH', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="text-xs font-display tracking-widest text-muted-foreground">
            TODAY'S SCENARIO
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm leading-relaxed whitespace-pre-line font-medium">
              {scenario.scenario}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {scenario.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={settled}
              className={`w-full text-left p-4 rounded-xl border text-sm transition-all ${choiceStyle(i, choice.correct)} ${settled ? '' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                {settled && choice.correct && (
                  <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                )}
                {settled && selectedIndex === i && !choice.correct && (
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                )}
                <span>{choice.label}</span>
              </div>
            </button>
          ))}
        </div>

        {settled && selectedChoice && (
          <div
            className={`rounded-xl p-4 border text-sm ${selectedChoice.correct ? 'bg-accent/10 border-accent/30' : 'bg-destructive/10 border-destructive/30'}`}
          >
            <p className="font-medium mb-2">{selectedChoice.correct ? '✅ Tama!' : '❌ Mali!'}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {selectedChoice.explanation}
            </p>
            <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">
              📖 {scenario.lawCitation}
            </p>
          </div>
        )}

        {alreadyDone && !revealed && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
            <p className="font-display text-sm font-bold">Challenge Complete!</p>
            <p className="text-xs text-muted-foreground">Come back tomorrow for a new scenario.</p>
          </div>
        )}

        {badges.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-display text-xs font-bold text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3" /> BADGES
            </h3>
            <div className="flex gap-2 flex-wrap">
              {badges.map(badge => (
                <span
                  key={badge.label}
                  className="px-3 py-1 rounded-full bg-card border border-border text-xs font-medium"
                >
                  {badge.icon} {badge.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="font-display text-lg font-bold text-signal-amber">
              {streak.currentStreak}
            </div>
            <div className="text-xs text-muted-foreground">Current Streak</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="font-display text-lg font-bold">{streak.longestStreak}</div>
            <div className="text-xs text-muted-foreground">Best Streak</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="font-display text-lg font-bold">{streak.completedDates.length}</div>
            <div className="text-xs text-muted-foreground">Total Days</div>
          </div>
        </div>
      </div>
    </div>
  );
};
