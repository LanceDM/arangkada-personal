/**
 * The short strings the driving screen shows for one scenario.
 *
 * Two questions the screen asks of every event — what is this called, and what
 * should I do — answered from what the level authored wherever it said, and
 * from the event's own declared data where it did not. Nothing here reads
 * `description`: the situation is a paragraph meant to be read while the drive
 * is paused, and it is exactly what used to be rendered as the prompt's title.
 *
 * The fallbacks exist because only Level 8 authors the short forms so far. They
 * are deliberately derived from data a level already has to get right — the
 * plate it is showing, the id it is addressed by, the action it grades — rather
 * than from prose, so no level gets a worse label by having been left alone.
 */
import type { ScenarioEvent } from './scenarioDefinition';

/** `level3.priority-yield.merging-traffic` → `Merging Traffic`. */
const fromId = (id: string): string => {
  const slug = id.split('.').pop() ?? id;
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * The scenario's name, in two to five words.
 *
 * A plate's own name wins where there is one, because on a sign or marking
 * event the plate *is* the subject and the level already worded it the way the
 * syllabus does.
 */
export const scenarioLabel = (event: ScenarioEvent): string =>
  event.label?.trim() || event.sign?.name || event.marking?.name || fromId(event.id);

/** What to do, for a level that has not authored an instruction of its own. */
const DEFAULT_INSTRUCTION: Record<ScenarioEvent['correctAction'], string> = {
  stop: 'Come to a full stop before the line.',
  brake: 'Slow down before you reach it.',
  accelerate: 'Keep going at a steady speed.',
  turn_left: 'Move into the left lane and turn.',
  turn_right: 'Move into the right lane and turn.',
  honk: 'Sound the horn once to warn them.',
};

/**
 * The one thing to do about this scenario, in ten words or fewer.
 *
 * The order is by how much each source knows. A lane requirement's own hint
 * beats the generic line because a level that named the lane has said something
 * the action alone cannot; a bay's hint beats it for the same reason and was
 * missing, which left a scenario whose whole answer is "pull into the turnout
 * on the right" telling the driver to come to a full stop before a line there
 * is none of.
 */
export const scenarioInstruction = (event: ScenarioEvent): string => {
  const authored = event.recommendedMove?.trim();
  if (authored) return authored;
  const lane = (event.maneuver ?? event.requiredLane)?.hint?.trim();
  if (lane) return lane;
  const bay = event.bay?.hint?.trim();
  if (bay) return bay;
  return DEFAULT_INSTRUCTION[event.correctAction];
};
