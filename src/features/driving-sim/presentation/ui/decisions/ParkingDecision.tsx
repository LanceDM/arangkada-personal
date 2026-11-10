/**
 * The parking-technique call, docked over the frozen driving canvas.
 *
 * There is no diagram here at all. The canvas is already a top-down view of a
 * car beside a curb, which is exactly the view a parking manoeuvre is drawn in:
 * the player picks a technique, the car performs it on the road they have been
 * driving all level, and the verdict describes what they just watched.
 *
 * That is also why it docks rather than covering the screen — the car doing the
 * manoeuvre is the point — and it is why it shares `DockedDecision` with
 * `RoadDecision`. Everything either of them does with a question, a keyboard
 * and a verdict is the same thing; what differs is the words, which are here.
 */
import { SquareParking } from 'lucide-react';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import DockedDecision, { type DockedDecisionCopy } from './DockedDecision';
import { useText } from '@/shared/i18n/useText';
import { decisionMessages as m } from '../messages';

interface ParkingDecisionProps {
  event: ScenarioEvent;
  /** Start the chosen technique playing out on the driving canvas. */
  onPlay: (action: string) => void;
  /** True once the canvas has finished performing it. */
  played: boolean;
  /** Commit the answer to scoring and release the car. */
  onAnswer: (action: string) => void;
  /** Shown before the player answers, only when this event matches their current weak competency. */
  hintText?: string;
  /**
   * Seeds the order this question's answers are shown in. One per mission
   * attempt, so the correct answer does not sit in the same place every run.
   */
  choiceSeed: number;
  /** Over the board, or beside it on a touch screen. */
  placement?: 'board' | 'side';
}

const COPY: DockedDecisionCopy = {
  eyebrow: m.parking,
  Icon: SquareParking,
  resolving: m.watchCar,
  verdictOk: m.parkedOk,
  verdictBad: m.parkedBad,
  continueLabel: m.pullOut,
};

const ParkingDecision = ({ event, onPlay, played, onAnswer, hintText, choiceSeed, placement }: ParkingDecisionProps) => (
  <DockedDecision
    event={event}
    title={useText()(m.parkingTechnique)}
    copy={COPY}
    onPlay={onPlay}
    played={played}
    onAnswer={onAnswer}
    hintText={hintText}
    choiceSeed={choiceSeed}
    testId="parking-decision"
    placement={placement}
  />
);

export default ParkingDecision;
