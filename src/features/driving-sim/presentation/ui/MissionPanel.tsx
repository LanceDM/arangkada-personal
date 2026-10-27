import { CheckCircle2, Flag, Gauge, ListChecks, Target, XCircle } from 'lucide-react';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { getCompetencyLabel } from '@/domain/learner/profile';
import type { DecisionEntry } from '@/features/driving-sim/application/useScenarioEvaluation';
import { actionLabel, expectedLabel } from './actionCopy';

interface MissionPanelProps {
  level: LevelConfig;
  score: number;
  progress: number;
  eventsCleared: number;
  decisions: DecisionEntry[];
  compact?: boolean;
}

const skillLabel = getCompetencyLabel;

/**
 * What a player sees beside the road. The FSM diagram is an instructor tool, so
 * this shows the same run in plain language: the objective, how far along the
 * route they are, and how their last calls were judged.
 */
const MissionPanel = ({ level, score, progress, eventsCleared, decisions, compact }: MissionPanelProps) => {
  const totalEvents = level.events.length;
  const routePercent = Math.min(Math.round(progress * 100), 100);

  return (
    <div className={`rounded-xl border border-border bg-card/95 backdrop-blur ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-primary" />
        <span className="font-display text-[11px] tracking-wider text-muted-foreground">MISSION</span>
        <span className="ml-auto font-display text-[10px] tracking-wider text-muted-foreground">
          LVL {level.id}
        </span>
      </div>

      <p className="mt-2 font-display text-sm font-black uppercase leading-tight text-foreground">
        {level.name}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{level.description}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-secondary px-2 py-2 text-center">
          <p className="font-display text-base text-primary">{score}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Points</p>
        </div>
        <div className="rounded-lg bg-secondary px-2 py-2 text-center">
          <p className="font-display text-base text-foreground">
            {eventsCleared}<span className="text-muted-foreground">/{totalEvents}</span>
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Events</p>
        </div>
        <div className="rounded-lg bg-secondary px-2 py-2 text-center">
          <p className="font-display text-base text-foreground">{level.speedLimit}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Limit</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
            <Flag className="h-3 w-3" />
            Route
          </span>
          <span className="font-display text-[10px] text-foreground">{routePercent}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${routePercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
          <ListChecks className="h-3 w-3" />
          Your last calls
        </span>

        {decisions.length === 0 ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Nothing scored yet. React to each road event as it comes up.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {decisions.map((decision) => (
              <li
                key={decision.id}
                className="flex items-start gap-2 rounded-lg bg-secondary/60 px-2.5 py-2"
              >
                {decision.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-4 text-foreground">
                    {skillLabel(decision.competency)}
                  </p>
                  {/* Garage calls are Go / No-Go judgements, so the driving
                      verbs used on the road would read as nonsense there. */}
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                    {decision.kind === 'garage' ? (
                      <>
                        {decision.title} — {decision.isCorrect ? 'correct call' : 'wrong call'}
                      </>
                    ) : (
                      <>
                        You {actionLabel(decision.action)}
                        {!decision.isCorrect && decision.expectedAction
                          ? ` — this one wanted ${expectedLabel(decision.expectedAction)}`
                          : ''}
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2">
        <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[10px] leading-4 text-muted-foreground">
          Stay at or under {level.speedLimit} km/h and score {level.requiredScore} to pass.
        </p>
      </div>
    </div>
  );
};

export default MissionPanel;
