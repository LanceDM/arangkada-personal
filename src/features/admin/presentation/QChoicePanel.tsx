/**
 * One Optimized account's choices on the table, in order: a game screen (a
 * HUD, the board with the state each choice read pulsing, and the choice's
 * card with the controls) above the list of choices. Each choice opens the
 * attempt it decided in Replay.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, ExternalLink } from 'lucide-react';

import { getCompetencyLabel } from '@/domain/learner/profile';
import { cn } from '@/shared/ui/cn';
import { moveLabel } from '@/features/admin/domain/attemptReplay';
import { ACTION_LABEL, qChecksHold, type QChoice, type QChoices, type QDimensionLabels, type QGridRow } from '@/features/admin/domain/qMapping';
import { EmptyState, Notice, Panel } from './adminUi';
import { BoardChip, BoardHud, GameScreen, StepControls } from './boardControls';
import { QBoard, QStateCard } from './QBoard';
import { useListScroll, usePlayback } from './useBoardStepping';
import { toShortDateTime } from './formatDate';
import { replayHref, stopLabel } from './routingFormat';

const controlOf = (state: string) => state.replace(/^REVIEW\((\d+)->.*\)$/, 'REVIEW($1)');

/** What a choice read and did, under the state's own order. */
const ChoiceDetails = ({ choice, labels, code }: { choice: QChoice; labels: QDimensionLabels; code: string }) => {
  const parts = choice.parts;
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <BoardChip
          label="weakest"
          value={`${choice.weakest ? getCompetencyLabel(choice.weakest) : 'none'}${parts ? `, ${labels.mastery[parts.mastery].label.toLowerCase()}` : ''}`}
        />
        <BoardChip label="budget spent" value={`${choice.budget.spent}${choice.budget.size !== null ? ` of ${choice.budget.size}` : ''}`} />
        <BoardChip label="state" value={choice.qState} />
      </div>
      <p className="text-xs text-[#C7CCE0]">
        Taken: <b className="font-medium text-white">{choice.action ? ACTION_LABEL[choice.action].label : 'the plain move: the row ran out'}</b>
        {' · '}
        {moveLabel(choice.move)}
      </p>
      <p className="text-xs text-[#7A84A6]">
        {toShortDateTime(choice.at)} ·{' '}
        <Link
          to={replayHref(code, choice.attempt)}
          aria-label={`Open attempt #${choice.attempt.number} in Replay`}
          className="inline-flex items-center gap-1 text-[#8FB8FF] underline-offset-2 hover:underline"
        >
          Open attempt #{choice.attempt.number} in Replay <ExternalLink className="h-3 w-3" />
        </Link>
      </p>
    </>
  );
};

const REASON: Record<QChoices['unasked'][number]['reason'], string> = {
  'no-reading': 'no BKT reading yet',
  'one-action': 'only one of its actions legal',
};

export const QChoicePanel = ({
  rows,
  labels,
  read,
  code,
}: {
  rows: readonly QGridRow[];
  labels: QDimensionLabels;
  read: QChoices;
  code: string;
}) => {
  const { choices, unasked } = read;
  const [position, setPosition] = useState(0);
  const last = choices.length - 1;
  const choice = choices[position] ?? null;
  const row = choice ? (rows.find(each => each.state === choice.qState) ?? null) : null;
  const [playing, setPlaying] = usePlayback(position, last, setPosition);
  const select = (to: number) => {
    setPlaying(false);
    setPosition(to);
  };
  const seen = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const each of choices.slice(0, position + 1)) counts[each.qState] = (counts[each.qState] ?? 0) + 1;
    return counts;
  }, [choices, position]);
  const list = useListScroll<HTMLOListElement>(position);
  const reasons = Object.entries(
    unasked.reduce<Record<string, number>>((sum, each) => ({ ...sum, [each.reason]: (sum[each.reason] ?? 0) + 1 }), {})
  );

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          {code}'s choices on the table
        </span>
      }
      description="Each time the table chose a move for this account: the state it read, pulsing on the board, and under it the order that state tries, with the action taken outlined and the actions the routing FSM did not allow struck through."
    >
      {!qChecksHold(choices) && (
        <div className="mb-4">
          <Notice tone="error">
            A recorded choice does not agree with the table shown: its table id, its row, or the move its action names. The
            failing choices are marked in the list.
          </Notice>
        </div>
      )}
      {choices.length === 0 && unasked.length === 0 ? (
        <EmptyState icon={BrainCircuit} title="No choice yet">
          The table chooses after a course entry, where at least two of its actions are legal.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <GameScreen
            label="Choice controls: left and right arrows step, space plays"
            position={position}
            last={last}
            onSelect={select}
            onTogglePlay={() => setPlaying(play => !play)}
          >
            <BoardHud
              label="CHOICE"
              position={position}
              total={choices.length}
              time={choice ? `AFTER ${stopLabel(controlOf(choice.from)).toUpperCase()}` : '-'}
            />
            <QBoard
              rows={rows}
              labels={labels}
              current={choice?.qState ?? null}
              counts={seen}
              label="The table as a board: the state each choice read, with how many choices read it so far"
            />
            {choice && row ? (
              <QStateCard
                row={row}
                labels={labels}
                heading={`AFTER ${stopLabel(controlOf(choice.from)).toUpperCase()} · CHOICE ${position + 1}`}
                taken={choice.action ?? 'plain'}
                masked={choice.masked}
                details={<ChoiceDetails choice={choice} labels={labels} code={code} />}
                controls={<StepControls position={position} last={last} playing={playing} onSelect={select} onPlay={setPlaying} noun="choice" />}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2A3352] bg-[#161C35] px-3.5 py-3">
                <p className="text-sm text-[#9AA3BF]">The table has not been asked to choose for this account yet.</p>
                <StepControls position={position} last={last} playing={playing} onSelect={select} onPlay={setPlaying} noun="choice" />
              </div>
            )}
          </GameScreen>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Choices</p>
            {choices.length > 0 && (
              <ol ref={list} aria-label="Choices" className="max-h-[16rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {choices.map(each => {
                  const holds = Object.values(each.checks).every(Boolean);
                  return (
                    <li key={each.index}>
                      <button
                        type="button"
                        onClick={() => select(each.index)}
                        aria-current={each.index === position ? 'step' : undefined}
                        className={cn(
                          'flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-left text-xs transition-colors',
                          each.index === position ? 'bg-[#F4C524]/15 ring-1 ring-inset ring-[#F4C524]/50' : 'hover:bg-muted/60'
                        )}
                      >
                        <span className="w-14 shrink-0 tabular-nums text-muted-foreground">#{each.attempt.number}</span>
                        <span className="font-medium text-foreground">{stopLabel(controlOf(each.from))}</span>
                        <code className="font-mono">{each.qState}</code>
                        <span>→ {each.action ? ACTION_LABEL[each.action].short : 'plain'}</span>
                        {!holds && <span className="font-medium text-destructive">does not agree with the table</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="text-xs text-muted-foreground">
              {choices.length} choice{choices.length === 1 ? '' : 's'} on the table.
              {unasked.length > 0 &&
                ` The table was not asked at ${unasked.length} other move${unasked.length === 1 ? '' : 's'}, which took the plain move: ${reasons
                  .map(([reason, count]) => `${count} with ${REASON[reason as keyof typeof REASON]}`)
                  .join(', ')}.`}
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
};
