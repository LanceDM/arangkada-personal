/**
 * What the road is asking of the driver right now.
 *
 * Beside the board, never over it, so nothing ever covers the car or the road
 * it is driving into. Which prompt appears is decided entirely from the
 * snapshot: the tutorial teaches a key, a checkpoint asks for a full stop, and
 * an ordinary scenario shows its name, one instruction and the one reading it
 * is being graded on.
 *
 * The situation itself is deliberately absent. It is read once, while the drive
 * is paused and the road is still visible; repeating it here is what buried the
 * instruction under a paragraph.
 *
 * How much of the answer an ordinary scenario's prompt carries is the support
 * level's (`scenarioSupport`), exactly as it is in the paused
 * briefing before it: the move, the keys that make it and live advice on it at
 * `full`; where to look at `cue`; the scenario's name and its plate at `none`.
 * The briefing withholding the move would mean nothing if this panel showed it
 * the moment the drive resumed.
 */
import type { SupportLevel } from '@/domain/learner/competency';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { BayCue, CoastCue, GapCue, HoldCue, LaneCue, ThrottleCue } from '@/features/driving-sim/domain/world/GameWorld';
import { actionHints, tutorialCopy } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import RoadPrompt, { Keycap, type PromptMetric } from './RoadPrompt';
import { scenarioInstruction, scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import { scenarioSupport } from '@/features/driving-sim/domain/scenario/scenarioSupport';

interface RoadEventPromptProps {
  level: LevelConfig;
  /** How much of the answer this level's scenarios are presented with. */
  support: SupportLevel;
  activeEvent: ScenarioEvent | null;
  eventPhase: 'approach' | 'react' | null;
  eventApproach: number;
  laneCue: LaneCue | null;
  /** The live gap to the vehicle ahead, where one is being measured. */
  gapCue: GapCue | null;
  /** Live lateral steadiness, where that is what is being measured. */
  holdCue: HoldCue | null;
  /** Live "are you off the road yet", where a scenario is grading that. */
  bayCue: BayCue | null;
  /** Live "is the brake safe yet", where a scenario is grading that. */
  coastCue: CoastCue | null;
  /** Live state of a jammed throttle, where one is being driven. */
  throttleCue: ThrottleCue | null;
}

/**
 * The one reading this scenario grades.
 *
 * Ordered by what the event actually declares rather than by what happens to be
 * available, so a scenario measuring a gap never also shows a lane it does not
 * care about. A scenario that grades neither shows nothing, and the slot it
 * would have filled stays empty rather than collapsing.
 */
const liveMetric = (
  event: ScenarioEvent,
  {
    laneCue,
    gapCue,
    holdCue,
    bayCue,
    coastCue,
    throttleCue,
  }: Pick<
    RoadEventPromptProps,
    'laneCue' | 'gapCue' | 'holdCue' | 'bayCue' | 'coastCue' | 'throttleCue'
  >
): PromptMetric | null => {
  // First, and ahead of everything: a jammed throttle is the one failure with
  // nothing on the road to see. A driver who is not told the engine has stuck
  // reads the acceleration as the game misbehaving.
  if (throttleCue) {
    if (throttleCue.phase === 'freed') {
      return { label: 'Engine', value: 'Under control', ok: true, note: 'Drive on gently' };
    }
    if (throttleCue.phase === 'braking') {
      return throttleCue.dropping
        ? { label: 'Engine', value: 'Speed dropping', ok: true, note: 'Keep the brake down' }
        : { label: 'Engine', value: 'Brake held', ok: true, note: 'Keep it down' };
    }
    return { label: 'Engine', value: 'Throttle stuck', ok: false, note: 'Hold the brake down' };
  }
  // First, because it is the only requirement a single press can lose. A driver
  // who is told about it after the window closes is being told what they should
  // have known while there was still road.
  if (event.coast && coastCue) {
    if (coastCue.lost) {
      return { label: 'Brake', value: 'Stood on it', ok: false, note: event.coast.hint };
    }
    return coastCue.safeToBrake
      ? { label: 'Brake', value: 'Safe to hold', ok: true, note: 'Brake gently and pull in' }
      : { label: 'Brake', value: 'Tap, do not hold', ok: false, note: event.coast.hint };
  }
  // A bay is the whole grade where it is declared — the car came to rest off
  // the carriageway, or it did not — so it outranks the lane and the speed the
  // same way the gap and the wander do.
  if (event.bay && bayCue) {
    if (bayCue.stopped) {
      return { label: 'Bay', value: 'Stopped, off the lane', ok: true, note: 'Well done' };
    }
    return bayCue.inBay
      ? { label: 'Bay', value: 'Off the lane', ok: true, note: 'Now brake to a stop' }
      : {
          label: 'Bay',
          value: 'Still in the lane',
          ok: false,
          note: `Steer ${bayCue.side} off the road`,
        };
  }
  if (event.lineHold && holdCue) {
    return {
      label: 'Line',
      value: holdCue.steady ? 'Steady' : 'Wandering',
      ok: holdCue.steady,
      note: holdCue.steady ? 'Hold it' : 'Come back straight',
    };
  }
  if (event.following && gapCue) {
    return {
      label: 'Gap',
      value: `${gapCue.seconds.toFixed(1)}s`,
      ok: gapCue.safe,
      note: gapCue.safe ? 'Safe' : 'Ease off',
    };
  }
  if ((event.requiredLane || event.maneuver) && laneCue) {
    return {
      label: 'Lane',
      value: laneCue.inLane ? 'In position' : 'Move over',
      ok: laneCue.inLane,
      note: laneCue.hint,
    };
  }
  return null;
};

/**
 * The reading shown where the support level withholds the response.
 *
 * Only a jammed throttle, and without its advice. It is the one reading that is
 * the situation rather than the answer: nothing on the road shows the engine
 * has stuck, and in a real car it would be felt through the pedal. Every other
 * reading says whether the graded response is being made, and how to make it.
 */
const situationOnly = (metric: PromptMetric | null, throttleCue: ThrottleCue | null): PromptMetric | null =>
  throttleCue && metric ? { label: metric.label, value: metric.value, ok: metric.ok } : null;

/** The options an event offers, as the small keycap-like chips. */
const choiceChips = (event: ScenarioEvent) =>
  (event.choices ?? []).map((choice, index) => (
    <span
      key={index}
      className="rounded-md border border-border bg-background px-2 py-1 font-display text-xs text-muted-foreground"
    >
      {actionHints[choice.action] || choice.label}
    </span>
  ));

/**
 * The keys that answer this scenario, drawn as keys.
 *
 * An instruction that names an action the player cannot find is worse than no
 * instruction: the stuck throttle told drivers to "shift to neutral", which is
 * not a control this car has, while the pedal that does work went unnamed. So
 * the graded action is shown as the keycaps that perform it, from
 * `CONTROL_KEYS` — content never spells a key out in prose, and the panel and
 * the keyboard cannot drift apart.
 *
 * A scenario that offers explicit answers shows those instead: there the keys
 * are not the question.
 */
const CONTROL_KEYS: Partial<Record<ScenarioEvent['correctAction'], string[]>> = {
  brake: ['↓', 'S'],
  stop: ['↓', 'S'],
  accelerate: ['↑', 'W'],
  turn_left: ['←', 'A'],
  turn_right: ['→', 'D'],
  honk: ['H'],
};

const controlKeys = (event: ScenarioEvent) => {
  if (event.choices?.length) return choiceChips(event);
  const keys = CONTROL_KEYS[event.correctAction];
  if (!keys) return null;
  return keys.map(key => <Keycap key={key}>{key}</Keycap>);
};

const RoadEventPrompt = ({
  level,
  support,
  activeEvent,
  eventPhase,
  eventApproach,
  laneCue,
  gapCue,
  holdCue,
  bayCue,
  coastCue,
  throttleCue,
}: RoadEventPromptProps) => {
  if (!activeEvent) return null;

  if (level.id === 0) {
    const instruction = tutorialCopy[activeEvent.correctAction];
    return (
      <RoadPrompt
        tone="instructor"
        label={instruction?.label ?? scenarioLabel(activeEvent)}
        instruction={instruction?.helper ?? scenarioInstruction(activeEvent)}
      >
        {instruction
          ? instruction.keys.map(key => (
              <Keycap key={key} active>
                {key}
              </Keycap>
            ))
          : choiceChips(activeEvent)}
      </RoadPrompt>
    );
  }

  // A traffic stop is named and nothing more, in the tones every scenario has
  // at h = none: where to stop, the extreme right, is what it grades, and
  // Level 12, the only level with one, is always played at none.
  if (activeEvent.inspection?.pullOver) {
    const reacting = eventPhase !== 'approach';
    return (
      <RoadPrompt
        tone={reacting ? 'react' : 'approach'}
        label="Traffic stop"
        instruction={null}
        urgent={reacting}
        approach={eventApproach}
      />
    );
  }

  // A checkpoint grades the stop at its line, so the stop is the move: shown,
  // with its keys and the "Full stop" tone, at h = full only, as every other
  // scenario's move is. It is written here rather than read from
  // `scenarioInstruction`, because an inspection's `correctAction` is the
  // answer to the question asked after the stop, not the stop.
  if (activeEvent.inspection) {
    const shown = scenarioSupport(activeEvent, support);
    if (!shown.showsResponse) {
      const reacting = eventPhase !== 'approach';
      return (
        <RoadPrompt
          tone={reacting ? 'react' : 'approach'}
          label="LTO checkpoint"
          instruction={null}
          cue={shown.cue}
          urgent={reacting}
          approach={eventApproach}
        />
      );
    }
    const reacting = eventPhase === 'react';
    return (
      <RoadPrompt
        tone="checkpoint"
        label="LTO checkpoint"
        instruction={reacting ? 'Brake to a full stop at the line.' : 'Start slowing for the checkpoint.'}
        urgent={reacting}
        approach={eventApproach}
      >
        <Keycap active={reacting}>↓</Keycap>
        <Keycap active={reacting}>S</Keycap>
        <Keycap active={reacting}>Space</Keycap>
      </RoadPrompt>
    );
  }

  const reacting = eventPhase !== 'approach';
  const shown = scenarioSupport(activeEvent, support);
  const metric = liveMetric(activeEvent, { laneCue, gapCue, holdCue, bayCue, coastCue, throttleCue });
  return (
    <RoadPrompt
      tone={reacting ? 'react' : 'approach'}
      label={scenarioLabel(activeEvent)}
      instruction={shown.instruction}
      cue={shown.cue}
      metric={shown.showsResponse ? metric : situationOnly(metric, throttleCue)}
      approach={eventApproach}
      sign={activeEvent.sign}
      marking={activeEvent.marking}
      urgent={reacting}
    >
      {/* The keys that make the graded move are the answer; a question's own
          options are not, and are the question at every level. */}
      {shown.showsResponse ? controlKeys(activeEvent) : activeEvent.choices?.length ? choiceChips(activeEvent) : null}
    </RoadPrompt>
  );
};

export default RoadEventPrompt;
