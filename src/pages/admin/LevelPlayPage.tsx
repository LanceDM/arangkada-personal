/**
 * `/admin/scenarios/play-level/:levelId?seed=N` (2026-11-16): a whole course
 * drive of a level through the real game screen, for checking how its
 * scenarios follow one another. Composed the way a learner's first drive of
 * the stage is; the seed picks which variants stand in it, so a drive can be
 * played again exactly, or another drawn. Nothing is saved: no attempt, no
 * BKT, no course, no Q-table.
 */
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { GameScreen, wholeDriveForCheck } from '@/features/driving-sim';
import type { LevelResult } from '@/domain/learner/attempt';
import { Button } from '@/shared/ui/button';

const LevelPlayPage = () => {
  const { levelId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const seed = Number(params.get('seed')) || 1;
  const level = useMemo(() => wholeDriveForCheck(Number(levelId), seed), [levelId, seed]);
  const [run, setRun] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [result, setResult] = useState<LevelResult | null>(null);
  const back = '/admin/scenarios';

  if (!level) {
    return (
      <div className="p-6 text-sm">
        <p>Level {levelId} has no drive to play.</p>
        <Link to={back} className="underline">
          Back to Scenarios
        </Link>
      </div>
    );
  }

  const again = (nextSeed: number) => {
    setParams({ seed: String(nextSeed) });
    setRun(n => n + 1);
    setResult(null);
    setPlaying(true);
  };

  if (playing) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <GameScreen
          key={`${seed}-${run}`}
          level={level}
          // The drive as composed: no route changes toward a weak area mid-drive.
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

  return (
    <div className="space-y-4 p-6 text-sm">
      <h1 className="text-lg font-semibold">Level check</h1>
      <p className="font-mono text-xs text-muted-foreground">
        L{levelId} · drive {seed} · {level.events.length} road scenarios
      </p>
      {result ? (
        <div className="space-y-1">
          <p>{result.crashReason ? `Ended in a crash: ${result.crashReason}` : result.timedOut ? 'Ran out of time.' : 'Drive finished.'}</p>
          <ol className="list-decimal space-y-0.5 pl-5">
            {result.logs.map((log, i) => (
              <li key={i}>
                <span className="font-mono text-xs">{log.scenarioId}</span>: <span className="font-semibold">{log.result}</span>
                {log.result !== 'correct' && log.expectedAction ? ` (did ${log.action}, wanted ${log.expectedAction})` : ''}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p>Exited before the end. Nothing was saved.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => again(seed)}>
          Play this drive again
        </Button>
        <Button size="sm" variant="outline" onClick={() => again(seed + 1)}>
          Draw another drive
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to={back}>Back to Scenarios</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Nothing from this page is saved: no attempt, BKT, course or Q-table change.</p>
    </div>
  );
};

export default LevelPlayPage;
