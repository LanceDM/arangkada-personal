/**
 * Every string a player can read, held to one standard.
 *
 * Two things this catches that nothing else does. The first is spelling: the
 * game is written in American English and had accumulated "kerb", "behaviour",
 * "metres", "manoeuvre" and "centre" across nine levels, including one in a
 * crash report. The second is the score: feedback used to end with "+25 points"
 * or "-19 points" written into the sentence, so the number was stated twice —
 * once in prose and once by the HUD — and anything that wanted it had to parse
 * a message to find it. It is passed as data now, and no sentence may carry it.
 *
 * Walks the whole roster, pooled variants and lesson modules included, so a new
 * level cannot quietly reintroduce either.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS, getPooledSlots } from './levelCatalog';
import { LEVEL_MODULES } from './content/lessons/lessonCatalog';
import type { ScenarioEvent } from './scenarioDefinition';

// Plurals spelled out rather than left to a trailing `s?`: a word boundary
// after the singular does not match inside the plural, which is how
// "kerbs" sat in a lesson summary while "kerb" was being tested for.
const BRITISH =
  /\b(kerbs?|kerbed|behaviours?|manoeuvres?|manoeuvred|metres?|colours?|coloured|recognise[ds]?|recognising|signalling|signalled|centres?|centred|neighbours?|neighbouring|practise[ds]?|apologise[ds]?|travelling|travelled|cancelled|offences?|favourite|realise[ds]?|licences?|licenced|penalise[sd]?|penalising|judgements?|tyres?|greys?|greyed|lay-bys?|lorr(?:y|ies)|whilst|organise[ds]?|analyse[ds]?|defence)\b/i;
const POINTS = /[-+−]\s*\d+\s*points/i;

/** One string the player can read, and where it came from. */
type Copy = { where: string; text: string };

const playerCopy = (): Copy[] => {
  const all: Copy[] = [];
  const push = (where: string, text?: string) => {
    if (text) all.push({ where, text });
  };

  const takeEvent = (levelId: number, event: ScenarioEvent) => {
    const at = `L${levelId} ${event.id}`;
    push(`${at} description`, event.description);
    push(`${at} recommendedMove`, event.recommendedMove);
    push(`${at} label`, event.label);
    push(`${at} rewardMessage`, event.rewardMessage);
    push(`${at} penaltyMessage`, event.penaltyMessage);
    push(`${at} lawCitation`, event.lawCitation);
    push(`${at} question`, event.question);
    event.choices?.forEach((choice, i) => push(`${at} choice${i}`, choice.label));
    push(`${at} laneHint`, event.requiredLane?.hint);
    push(`${at} laneWrong`, event.requiredLane?.wrongLaneMessage);
    push(`${at} maneuverHint`, event.maneuver?.hint);
    push(`${at} maneuverWrong`, event.maneuver?.wrongLaneMessage);
    push(`${at} following`, event.following?.tooCloseMessage);
    push(`${at} lineHold`, event.lineHold?.driftedMessage);
    push(`${at} bayHint`, event.bay?.hint);
    push(`${at} sign`, event.sign?.name);
    push(`${at} signMeaning`, event.sign?.meaning);
    push(`${at} marking`, event.marking?.name);
    push(`${at} markingMeaning`, event.marking?.meaning);
    push(`${at} npcLabel`, event.npc?.label);
  };

  for (const level of LEVELS) {
    push(`L${level.id} name`, level.name);
    push(`L${level.id} description`, level.description);
    level.events.forEach(event => takeEvent(level.id, event));
    // Pooled variants too: a level rolls fresh content, and a string nobody
    // happened to roll is still a string somebody will read.
    getPooledSlots(level.id)?.slots.forEach(slot =>
      slot.forEach(variant => takeEvent(level.id, { ...variant, triggerAtDistance: 0 } as ScenarioEvent))
    );
    for (const spot of [...(level.garage?.hotspots ?? []), ...(level.aftermath?.hotspots ?? [])]) {
      const at = `L${level.id} ${spot.id}`;
      push(`${at} label`, spot.label);
      push(`${at} observation`, spot.observation);
      push(`${at} question`, spot.question);
      push(`${at} reward`, spot.rewardMessage);
      push(`${at} penalty`, spot.penaltyMessage);
      push(`${at} law`, spot.lawCitation);
      spot.choices.forEach((choice, i) => push(`${at} choice${i}`, choice.label));
    }
  }

  for (const module of Object.values(LEVEL_MODULES)) {
    push(`${module.id} desc`, module.desc);
    module.lessons.forEach(lesson => {
      push(`${module.id} ${lesson.id} title`, lesson.title);
      push(`${module.id} ${lesson.id} text`, lesson.text);
      // The body of the lesson, not just its summary. This is most of what a
      // player actually reads, and leaving it out is how a level's whole
      // "Scenario" paragraph went on describing seven road events that had
      // been deleted, in British spelling, while these checks passed.
      lesson.blocks.forEach((block, i) => {
        const at = `${module.id} ${lesson.id} block${i}`;
        if (block.type === 'heading' || block.type === 'paragraph') push(at, block.text);
        if (block.type === 'list') block.items.forEach((item, j) => push(`${at}i${j}`, item));
        if (block.type === 'table') {
          block.headers.forEach((header, j) => push(`${at}h${j}`, header));
          block.rows.forEach((row, j) => row.forEach((cell, k) => push(`${at}r${j}c${k}`, cell)));
        }
        if (block.type === 'image') push(`${at} alt`, block.alt);
      });
    });
    module.quiz.forEach((item, i) => {
      push(`${module.id} q${i}`, item.question);
      push(`${module.id} q${i} why`, item.explanation);
      item.options.forEach((option, j) => push(`${module.id} q${i}o${j}`, option));
    });
  }

  return all;
};

describe('what the player reads', () => {
  const copy = playerCopy();

  it('covers the whole roster, so the checks below mean something', () => {
    expect(copy.length).toBeGreaterThan(2000);
  });

  it('is written in American English', () => {
    const british = copy
      .filter(({ text }) => BRITISH.test(text))
      .map(({ where, text }) => `${where}: ${text.slice(0, 80)}`);
    expect(british).toEqual([]);
  });

  it('never writes the score into a sentence', () => {
    // The HUD and the result card both say what the score did. A message that
    // says it too is a third copy that nothing keeps in step.
    const priced = copy
      .filter(({ text }) => POINTS.test(text))
      .map(({ where, text }) => `${where}: ${text.slice(0, 80)}`);
    expect(priced).toEqual([]);
  });
});
