/**
 * How a scenario is played: the format of its interaction, from what it
 * declares. One of seven, so the catalogue, the pre-drive overview and the
 * logs all name it the same way.
 *
 * | Format | What the participant does |
 * |---|---|
 * | `briefed_drive` | Reads the scenario briefing (with the hint its support level allows), then answers with the car in real time |
 * | `drive_then_question` | Drives up and stops (a checkpoint), then answers a question about what is presented |
 * | `frozen_question` | The road freezes at a junction; picks who goes first, then watches it play out |
 * | `emergency_question` | The car fails (blowout, brake loss, skid, jammed pedal); picks the response, then watches it |
 * | `park_then_question` | Stops alongside the bay, picks the parking technique, then the car performs it |
 * | `garage_question` | Before the drive, opens a point in the garage and answers its question |
 * | `aftermath_question` | After the drive, on foot at the scene, opens a point and answers its question |
 *
 * The four in-drive questions (checkpoint, frozen, emergency, park) run on a
 * time limit; garage and aftermath questions do not (TENTATIVE).
 */
import type { ScenarioEvent } from './scenarioDefinition';

export type ScenarioFormat =
  | 'briefed_drive'
  | 'drive_then_question'
  | 'frozen_question'
  | 'emergency_question'
  | 'park_then_question'
  | 'garage_question'
  | 'aftermath_question';

export const SCENARIO_FORMAT_LABEL: Record<ScenarioFormat, string> = {
  briefed_drive: 'Briefing, then drive',
  drive_then_question: 'Drive and stop, then question',
  frozen_question: 'Road freezes, question, then plays out',
  emergency_question: 'Emergency, question, then plays out',
  park_then_question: 'Stop by the bay, question, then parks',
  garage_question: 'Pre-drive garage question',
  aftermath_question: 'Post-drive scene question',
};

/** Where a stage point stands, for a scenario that is not on the road. */
export type StagePlacement = 'garage' | 'aftermath';

export const scenarioFormat = (event: Pick<ScenarioEvent, 'inspection' | 'cutscene' | 'emergency' | 'parkingCutscene'>, stage?: StagePlacement): ScenarioFormat => {
  if (stage === 'garage') return 'garage_question';
  if (stage === 'aftermath') return 'aftermath_question';
  if (event.inspection) return 'drive_then_question';
  if (event.parkingCutscene) return 'park_then_question';
  if (event.cutscene) return event.emergency ? 'emergency_question' : 'frozen_question';
  return 'briefed_drive';
};

/** The formats whose question runs against the clock during the drive. */
export const TIMED_FORMATS: ReadonlySet<ScenarioFormat> = new Set(['drive_then_question', 'frozen_question', 'emergency_question', 'park_then_question']);
