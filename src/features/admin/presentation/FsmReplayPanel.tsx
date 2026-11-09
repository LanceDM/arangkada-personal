/**
 * The Replay's driving FSM: a game screen (a HUD, the board, and a card for
 * the step shown with the controls under it) beside the list of steps.
 *
 * Stepping never moves the page: the list scrolls inside its own box, so the
 * board stays where it is. Play steps on by itself and stops at the end, or
 * at any other control.
 */
import { useMemo, useState } from 'react';
import { Workflow } from 'lucide-react';

import { getCompetencyLabel } from '@/domain/learner/profile';
import type { FsmGraph } from '@/features/driving-sim';
import { cn } from '@/shared/ui/cn';
import type { FsmLogState } from '@/features/admin/application/useAttemptReplay';
import { edgeCountsThrough, type FsmReplay, type TimelineStep } from '@/features/admin/domain/replayTimeline';
import { EmptyState, Notice, Panel } from './adminUi';
import { BoardChip as Chip, BoardHud, GameScreen, StepControls } from './boardControls';
import { useListScroll, usePlayback } from './useBoardStepping';
import { FsmBoard } from './FsmBoard';
import { boardMove, boardProgress, type BoardMove, type BoardProgress } from './fsmBoardMap';
import { durationLabel, offsetLabel, stateLabel, thetaLabel } from './replayFormat';

const MOVE_NOTE: Record<BoardMove['kind'], string | null> = {
  road: null,
  loop: 'Stayed in this state: a self-loop, counted on its stop.',
  rest: 'Came to rest: back to Idle, counted on its stop.',
  crash: 'Crashed: the run ends at Run over.',
  'time-up': "Time's up: the level's driving time ran out, and the run ends at Run over.",
  direct: 'Off the roads: a direct move, drawn as a dashed hop while it is shown.',
};

const StepCard = ({
  step,
  progress,
  position,
  last,
  playing,
  onSelect,
  onPlay,
}: {
  step: TimelineStep | null;
  progress: BoardProgress;
  position: number;
  last: number;
  playing: boolean;
  onSelect: (position: number) => void;
  onPlay: (play: boolean) => void;
}) => {
  const move = step ? boardMove(step.from, step.to, step.trigger) : null;
  const note = move ? MOVE_NOTE[move.kind] : null;
  return (
    <div className="grid gap-3 rounded-xl border border-[#2A3352] bg-[#161C35] px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        {step ? (
          <>
            <p className="font-display text-sm tracking-[0.1em] text-white">
              {stateLabel(step.from)}
              {step.selfLoop ? <span className="text-[#F4C524]"> ↺</span> : <span className="text-[#F4C524]"> ▸ </span>}
              {!step.selfLoop && stateLabel(step.to)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip label="trigger" value={step.trigger} />
              {step.count > 1 && <Chip label="folded" value={`×${step.count} over ${durationLabel(step.lastAt - step.firstAt)}`} />}
              <Chip label="stayed" value={step.dwellMs === null ? 'to the end' : durationLabel(step.dwellMs)} />
              <Chip label="skill" value={step.competency === 'unassigned' ? 'none yet' : getCompetencyLabel(step.competency)} />
              <Chip label="approach scale θ" value={thetaLabel(step.approachScale)} />
            </div>
            {note && <p className="mt-2 text-xs text-[#9AA3BF]">{note}</p>}
          </>
        ) : (
          <p className="text-sm text-[#9AA3BF]">No step to show.</p>
        )}
        <p className="mt-2 text-xs text-[#7A84A6]">
          Off-road so far: came to rest {progress.rests} · direct moves {progress.direct} · crashes {progress.crashes} · time ran out {progress.timeouts}
        </p>
      </div>
      <StepControls position={position} last={last} playing={playing} onSelect={onSelect} onPlay={onPlay} />
    </div>
  );
};

const StepList = ({
  steps,
  position,
  onSelect,
  hideInputs,
  onHideInputs,
  replay,
}: {
  steps: TimelineStep[];
  position: number;
  onSelect: (position: number) => void;
  hideInputs: boolean;
  onHideInputs: (hide: boolean) => void;
  replay: FsmReplay;
}) => {
  const list = useListScroll<HTMLOListElement>(position);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Steps</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={hideInputs} onChange={event => onHideInputs(event.target.checked)} />
          Hide driving inputs
        </label>
      </div>
      <ol
        ref={list}
        aria-label="Timeline"
        className="relative max-h-[22rem] divide-y divide-border overflow-y-auto rounded-lg border border-border xl:max-h-[34rem]"
      >
        {steps.map((each, index) => (
          <li key={each.index}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={index === position ? 'step' : undefined}
              className={cn(
                'flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-left text-xs transition-colors',
                index === position ? 'bg-[#F4C524]/15 ring-1 ring-inset ring-[#F4C524]/50' : 'hover:bg-muted/60',
                each.selfLoop && index !== position && 'text-muted-foreground'
              )}
            >
              <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{offsetLabel(each.offsetMs)}</span>
              <span className="font-medium text-foreground">
                {each.selfLoop ? `${stateLabel(each.from)} ↺` : `${stateLabel(each.from)} → ${stateLabel(each.to)}`}
              </span>
              <span className="font-mono">{each.trigger}</span>
              {each.count > 1 && (
                <span className="rounded bg-muted px-1.5 font-medium tabular-nums text-foreground" title="Consecutive identical self-loops, folded into one step">
                  ×{each.count} · {durationLabel(each.lastAt - each.firstAt)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {replay.transitions.toLocaleString()} transitions in {replay.steps.length.toLocaleString()} steps: a run of the same
        self-loop is one step with its count. Times are wall-clock from the first transition.
      </p>
      {replay.truncated && (
        <Notice tone="error">
          The log was cut to fit one document: {replay.transitions.toLocaleString()} of {replay.totalCount.toLocaleString()} transitions
          were kept, and the rest were never stored. The board and the counts cover the kept part only.
        </Notice>
      )}
    </div>
  );
};

export const FsmReplayPanel = ({
  fsm,
  graph,
  steps,
  position,
  onSelect,
  hideInputs,
  onHideInputs,
}: {
  fsm: FsmLogState | null;
  graph: FsmGraph;
  /** The steps shown, driving inputs hidden or not. */
  steps: TimelineStep[];
  position: number;
  onSelect: (position: number) => void;
  hideInputs: boolean;
  onHideInputs: (hide: boolean) => void;
}) => {
  const replay = fsm?.status === 'ready' ? fsm.replay : null;
  const step = steps[position] ?? null;
  const last = steps.length - 1;
  const [showTable, setShowTable] = useState(false);

  // Every step counts towards the board, the hidden ones included.
  const progress = useMemo(() => boardProgress(replay?.steps ?? [], step, replay?.initial ?? null), [replay, step]);
  const table = useMemo(() => (replay && showTable ? edgeCountsThrough(replay.steps, step) : null), [replay, showTable, step]);

  const [playing, setPlaying] = usePlayback(position, last, onSelect);

  const select = (to: number) => {
    setPlaying(false);
    onSelect(to);
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          The driving FSM
        </span>
      }
      description="Each state is a stop on the road. The road this attempt has driven is lit, the current stop pulses, and moves off the road are counted on their stops. Full table draws the machine's exact transitions."
    >
      {!fsm || fsm.status === 'loading' ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-label="Reading the FSM log" />
      ) : fsm.status === 'missing' ? (
        <EmptyState icon={Workflow} title="No FSM log for this attempt">
          The records read found no FSM record beside this attempt. Refresh records to look again.
        </EmptyState>
      ) : fsm.status === 'error' ? (
        <Notice tone="error">The FSM log could not be read: {fsm.error}</Notice>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <GameScreen
            label="Replay controls: left and right arrows step, space plays"
            position={position}
            last={last}
            onSelect={select}
            onTogglePlay={() => setPlaying(play => !play)}
          >
            <BoardHud
              position={position}
              total={steps.length}
              time={step ? offsetLabel(step.offsetMs).toUpperCase() : '-'}
              toggle={{ label: 'FULL TABLE', on: showTable, onChange: setShowTable }}
            />
            <FsmBoard graph={graph} step={step} initial={fsm.replay.initial} progress={progress} table={table} />
            <StepCard
              step={step}
              progress={progress}
              position={position}
              last={last}
              playing={playing}
              onSelect={onSelect}
              onPlay={setPlaying}
            />
          </GameScreen>
          <StepList
            steps={steps}
            position={position}
            onSelect={select}
            hideInputs={hideInputs}
            onHideInputs={onHideInputs}
            replay={fsm.replay}
          />
        </div>
      )}
    </Panel>
  );
};
