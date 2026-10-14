/**
 * The call the road stops to ask, docked over the frozen driving canvas.
 *
 * This was `RightOfWayDecision`, and it was named for the first level that
 * needed it. Every frozen scenario that is not a vehicle failure and not a
 * parking manoeuvre arrives here — Level 5's priority judgments, Level 10's
 * ringing phone — and the panel said "Right Of Way" over all of them, called
 * the wait "Watch the junction…" when there was no junction, and reported
 * leaving a phone alone as "Right of way given". Renamed for what it is.
 *
 * Deliberately without a diagram of its own. The canvas behind it is already a
 * top-down view of the exact road being asked about, with the exact other
 * vehicle on it, so a schematic copy drawn on top would show one situation
 * twice in two visual languages and hide the accurate one behind the
 * approximate one. It also means the two pictures can no longer disagree: the
 * old diagram had its own hand-written geometry for who came from where, and
 * when the NPC lane placement was wrong on the canvas the diagram stayed
 * confidently right.
 *
 * So it docks, and the answer resolves on the road the player has been driving
 * all level — `rightOfWayPose` in `domain/systems/maneuvers` drives it.
 */
import { Eye } from 'lucide-react';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import DockedDecision, { type DockedDecisionCopy } from './DockedDecision';

interface RoadDecisionProps {
  event: ScenarioEvent;
  /** Start the answer playing out on the driving canvas. */
  onPlay: (action: string) => void;
  /** True once the canvas has finished playing it. */
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
}

/**
 * The words this panel uses, and the reason they are not about junctions.
 *
 * A verdict has to be able to describe leaving a phone in its cradle as well as
 * letting a jeepney out, so it names the call rather than the manoeuvre. What
 * actually happened is the scenario's own reward or penalty line, immediately
 * underneath.
 */
const COPY: DockedDecisionCopy = {
  eyebrow: 'Paused',
  Icon: Eye,
  resolving: 'Watching what happens…',
  verdictOk: 'Good call',
  verdictBad: 'Wrong call',
  continueLabel: 'Continue driving',
};

const RoadDecision = ({ event, onPlay, played, onAnswer, hintText, choiceSeed }: RoadDecisionProps) => (
  <DockedDecision
    event={event}
    title={scenarioLabel(event)}
    copy={COPY}
    onPlay={onPlay}
    played={played}
    onAnswer={onAnswer}
    // A roundabout plays its full drive-through *as* the resolution, so there
    // is no separate hold to watch and no verdict panel to sit over it.
    skipResolution={event.scene === 'roundabout'}
    hintText={hintText}
    choiceSeed={choiceSeed}
    testId="road-decision"
  />
);

export default RoadDecision;
