/**
 * `/admin/scenarios/play/:levelId/:scenarioId` (2026-11-16): one scenario,
 * alone, through the real game screen, for checking it. The drive starts just
 * before the scenario (singleScenarioDrive). Nothing is saved: no attempt, no
 * BKT, no course, no Q-table.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GameScreen, singleScenarioDrive } from '@/features/driving-sim';
import type { LevelResult } from '@/domain/learner/attempt';
import { Button } from '@/shared/ui/button';

const ScenarioPlayPage = () => {
  const { levelId = '', scenarioId = '' } = useParams();
  const drive = useMemo(() => singleScenarioDrive(Number(levelId), scenarioId), [levelId, scenarioId]);
  // A new run is a new mount of the game screen.
  const [run, setRun] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [result, setResult] = useState<LevelResult | null>(null);
  const back = `/admin/scenarios`;

  if (!drive) {
    return (
      <div className="p-6 text-sm">
        <p>Scenario {scenarioId} cannot be placed on Level {levelId}.</p>
        <Link to={back} className="underline">
          Back to Scenarios
        </Link>
      </div>
    );
  }

  if (playing) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <GameScreen
          key={run}
          level={drive.level}
          initialDistance={drive.initialDistance}
          // The scenario alone: no route changes toward a weak area mid-drive.
          liveReroll={false}
          // Checking takes as long as it takes: no clock, no running out of time.
          noTimeLimit
          onComplete={finished => {
            setResult(finished);
            setPlaying(false);
          }}
          onExit={() => {
            setResult(null);
            setPlaying(false);
          }}
        />
      </div>
    );
  }

  const mine = result?.logs.filter(log => log.scenarioId === scenarioId) ?? [];
  // A question's answers in its own words: "action stop" says nothing about a child seat.
  const point = [...(drive.level.garage?.hotspots ?? []), ...(drive.level.aftermath?.hotspots ?? [])].find(
    h => (h.scenarioId ?? h.id) === scenarioId
  );
  const choices = (drive.level.events.find(e => e.id === scenarioId)?.choices ?? point?.choices ?? []) as Array<{
    label: string;
    action: string;
  }>;
  const choiceFor = (action: string | undefined) => choices.find(choice => choice.action === action)?.label;
  return (
    <div className="space-y-4 p-6 text-sm">
      <h1 className="text-lg font-semibold">Scenario check</h1>
      <p className="font-mono text-xs text-muted-foreground">
        L{levelId} · {scenarioId} · {drive.where}
      </p>
      {result ? (
        <div className="space-y-1">
          <p>
            {result.crashReason ? `Ended in a crash: ${result.crashReason}.` : result.timedOut ? 'Ran out of time.' : 'Drive finished.'}
          </p>
          {mine.length === 0 && <p>This scenario was not graded on that run.</p>}
          {mine.map((log, i) => (
            <div key={i} className="space-y-0.5">
              <p>
                Graded <span className="font-semibold">{log.result}</span>: action {log.action}
                {log.expectedAction ? `, expected ${log.expectedAction}` : ''} ({log.points} points)
              </p>
              {choiceFor(log.action) && <p className="text-muted-foreground">Answered: {choiceFor(log.action)}</p>}
              {log.result !== 'correct' && choiceFor(log.expectedAction) && (
                <p className="text-muted-foreground">Right answer: {choiceFor(log.expectedAction)}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>Exited before the end. Nothing was saved.</p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setRun(n => n + 1);
            setResult(null);
            setPlaying(true);
          }}
        >
          Play again
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to={back}>Back to Scenarios</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Nothing from this page is saved: no attempt, BKT, course or Q-table change.</p>
    </div>
  );
};

export default ScenarioPlayPage;
