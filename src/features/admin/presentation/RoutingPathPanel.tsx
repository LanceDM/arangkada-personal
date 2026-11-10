/**
 * One account's path through the routing FSM, move by move: a game screen (a
 * HUD, the board, and the move's card with the controls under it) above the
 * list of moves, in which the attempts played outside the machine are listed
 * but not stepped to. Each move opens the attempt that logged it in Replay.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Route } from 'lucide-react';

import { cn } from '@/shared/ui/cn';
import { KIND_LABEL, moveLabel } from '@/features/admin/domain/attemptReplay';
import { levelName } from '@/features/admin/domain/playerReport';
import type { FlowAttemptRef, FlowPath, FlowStep } from '@/features/admin/domain/routingFlow';
import type { RoutingGraph } from '@/features/admin/domain/routingGraph';
import { EmptyState, Panel } from './adminUi';
import { BoardChip, BoardHud, GameScreen, StepControls } from './boardControls';
import { useListScroll, usePlayback } from './useBoardStepping';
import { RoutingBoard } from './RoutingBoard';
import { routingProgress } from './routingBoardMap';
import { toShortDateTime } from './formatDate';
import { GROUP_LABEL, addOnLabel, replayHref, stopLabel } from './routingFormat';

const ReplayLink = ({ code, attempt, compact = false }: { code: string; attempt: FlowAttemptRef; compact?: boolean }) => (
  <Link
    to={replayHref(code, attempt)}
    className={cn(
      'inline-flex items-center gap-1 text-[#8FB8FF] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4C524]',
      compact ? 'text-[11px]' : 'text-xs'
    )}
    aria-label={`Open attempt #${attempt.number} in Replay`}
  >
    {compact ? 'Replay' : `Open attempt #${attempt.number} in Replay`}
    <ExternalLink className="h-3 w-3" />
  </Link>
);

const decidedLabel = (step: FlowStep) => {
  if (!step.entered) return 'ended its attempt';
  const group = step.decidedIn ? (GROUP_LABEL[step.decidedIn] ?? step.decidedIn) : 'not recorded';
  return step.asked ? `${group}: the table chose` : group;
};

const MoveCard = ({
  step,
  code,
  position,
  last,
  playing,
  onSelect,
  onPlay,
}: {
  step: FlowStep | null;
  code: string;
  position: number;
  last: number;
  playing: boolean;
  onSelect: (position: number) => void;
  onPlay: (play: boolean) => void;
}) => (
  <div className="grid gap-3 rounded-xl border border-[#2A3352] bg-[#161C35] px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
    <div className="min-w-0">
      {step ? (
        <>
          <p className="font-display text-sm tracking-[0.1em] text-white">
            {stopLabel(step.fromStop).toUpperCase()}
            <span className="text-[#F4C524]">{step.fromStop === step.toStop ? ' ↺ ' : ' ▸ '}</span>
            {step.fromStop !== step.toStop && stopLabel(step.toStop).toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-[#C7CCE0]">{moveLabel(step.move)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <BoardChip label="row" value={step.row ?? 'not in the table'} />
            <BoardChip label="move" value={step.move} />
            <BoardChip label="on" value={step.outcome === 'passed' ? 'a pass' : 'a fail'} />
            <BoardChip label="added" value={addOnLabel(step.addOn)} />
            <BoardChip label="legal moves" value={step.legal.length} />
            <BoardChip label="log" value={`#${step.seq}`} />
            <BoardChip label="decided" value={decidedLabel(step)} />
          </div>
          {step.addOn?.kind === 'practice' && step.addOn.item && (
            <p className="mt-2 text-xs text-[#9AA3BF]">
              Item <code className="font-mono text-[#D6DAE8]">{step.addOn.item.scenarioId}</code>, from Level {step.addOn.item.sourceLevelId}
            </p>
          )}
          <p className="mt-2 text-xs text-[#7A84A6]">
            {step.from} → {step.to}
            {step.attempt && (
              <>
                {' · '}
                <ReplayLink code={code} attempt={step.attempt} />
              </>
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-[#9AA3BF]">No move yet: the routing FSM moves only after a course entry ends.</p>
      )}
    </div>
    <StepControls position={position} last={last} playing={playing} onSelect={onSelect} onPlay={onPlay} noun="move" />
  </div>
);

const noteLabel = (kind: 'as-it-stands' | 'outside', attempt: FlowAttemptRef) =>
  kind === 'outside'
    ? `${KIND_LABEL[attempt.kind]}: outside the machine`
    : 'Played as it stood: no move into it';

export const RoutingPathPanel = ({ graph, path, code }: { graph: RoutingGraph; path: FlowPath; code: string }) => {
  const { steps, timeline } = path;
  const [position, setPosition] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const last = steps.length - 1;
  const step = steps[position] ?? null;
  const [playing, setPlaying] = usePlayback(position, last, setPosition);
  const select = (to: number) => {
    setPlaying(false);
    setPosition(to);
  };
  const progress = useMemo(() => routingProgress(steps, step ? position : -1, path.start), [steps, step, position, path.start]);
  const rowOfStep = useMemo(() => {
    const rows: number[] = [];
    timeline.forEach((item, row) => {
      if (item.type === 'step') rows[item.step.index] = row;
    });
    return rows;
  }, [timeline]);
  const list = useListScroll<HTMLOListElement>(position, at => rowOfStep[at] ?? 0);

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          {code}'s path through the routing FSM
        </span>
      }
      description="Every move the routing FSM took for this account, in order. The roads travelled so far are lit, the stop reached pulses, a retry is a count on its stop, and practice added is an orange count. Full table draws every review detour the machine has."
    >
      {timeline.length === 0 ? (
        <EmptyState icon={Route} title="No attempts yet">
          The routing FSM moves after each course entry this account plays.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <GameScreen
            label="Path controls: left and right arrows step, space plays"
            position={position}
            last={last}
            onSelect={select}
            onTogglePlay={() => setPlaying(play => !play)}
          >
            <BoardHud
              label="MOVE"
              position={position}
              total={steps.length}
              time={step ? toShortDateTime(step.at).toUpperCase() : '-'}
              toggle={{ label: 'FULL TABLE', on: showAll, onChange: setShowAll }}
            />
            <RoutingBoard
              graph={graph}
              counts={progress}
              reached={progress.reached}
              current={step && { edge: step.edge, to: step.toStop }}
              start={path.start}
              showAll={showAll}
              countsFrom={2}
              label="The routing FSM as a board: the stops this account has reached so far, and the move shown"
            />
            <MoveCard step={step} code={code} position={position} last={last} playing={playing} onSelect={select} onPlay={setPlaying} />
          </GameScreen>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Moves</p>
            <ol ref={list} aria-label="Moves" className="relative max-h-[18rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {timeline.map(item =>
                item.type === 'step' ? (
                  <li key={`step-${item.step.index}`}>
                    <button
                      type="button"
                      onClick={() => select(item.step.index)}
                      aria-current={item.step.index === position ? 'step' : undefined}
                      className={cn(
                        'flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-left text-xs transition-colors',
                        item.step.index === position ? 'bg-[#F4C524]/15 ring-1 ring-inset ring-[#F4C524]/50' : 'hover:bg-muted/60'
                      )}
                    >
                      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{item.step.attempt ? `#${item.step.attempt.number}` : '-'}</span>
                      <span className="font-medium text-foreground">
                        {item.step.fromStop === item.step.toStop
                          ? `${stopLabel(item.step.fromStop)} ↺`
                          : `${stopLabel(item.step.fromStop)} → ${stopLabel(item.step.toStop)}`}
                      </span>
                      <span className="font-mono">{item.step.move}</span>
                    </button>
                  </li>
                ) : (
                  <li key={`note-${item.note.attempt.id}`} className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-xs text-muted-foreground" data-note={item.note.kind}>
                    <span className="w-10 shrink-0 tabular-nums">#{item.note.attempt.number}</span>
                    <span>
                      {levelName(item.note.attempt.levelId)} · {noteLabel(item.note.kind, item.note.attempt)}
                    </span>
                    <ReplayLink code={code} attempt={item.note.attempt} compact />
                  </li>
                )
              )}
            </ol>
            <p className="text-xs text-muted-foreground">
              {steps.length} move{steps.length === 1 ? '' : 's'}, each beside the number of the attempt that logged it, as Replay numbers attempts. Free replays and the
              post-test are listed where they were played, outside the machine, with no verdict.
            </p>
            {path.unknown > 0 && (
              <p className="text-xs text-destructive">
                {path.unknown} move{path.unknown === 1 ? ' is' : 's are'} not one the machine offers from where {path.unknown === 1 ? 'it was' : 'they were'} logged.
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
};
