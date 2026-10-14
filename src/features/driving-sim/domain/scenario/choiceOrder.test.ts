/**
 * The answer order, and the exploit it exists to close.
 *
 * Content authors the correct answer first, because that is how a person writes
 * a question. Rendered that way it is also how a person beats one: measured
 * across every multiple-choice point in the game, the correct answer sat first
 * in 55% of them against a 33% baseline, and was the longest option in 50%. A
 * player could score well above chance on "pick the top one, or the long one"
 * without reading a word.
 *
 * These are the properties that close the first half of that, plus the ones
 * that stop the fix from breaking the questions: nothing authored is mutated,
 * the order holds still while a question is open, and every displayed position
 * still submits the answer written on it.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS, getRerollableSlots } from './levelCatalog';
import { displayedChoices, orderChoices, seedForQuestion } from './choiceOrder';
import type { QuestionChoice } from './scenarioDefinition';

const CHOICES: QuestionChoice[] = [
  { label: 'right', action: 'brake' },
  { label: 'wrong one', action: 'accelerate' },
  { label: 'wrong two', action: 'turn_right' },
];

/** Every multiple-choice point in the game, pooled variants and stages included. */
const everyQuestion = (): Array<{ id: string; correctAction: string; choices: QuestionChoice[] }> => {
  const all: Array<{ id: string; correctAction: string; choices: QuestionChoice[] }> = [];
  for (const level of LEVELS) {
    for (const event of level.events) {
      if (event.choices) all.push({ id: event.id, correctAction: event.correctAction, choices: event.choices });
    }
    getRerollableSlots(level.id)?.slots.forEach(slot =>
      slot.forEach(variant => {
        if (variant.choices) {
          all.push({ id: variant.id, correctAction: variant.correctAction, choices: variant.choices });
        }
      })
    );
    for (const spot of [...(level.garage?.hotspots ?? []), ...(level.aftermath?.hotspots ?? [])]) {
      all.push({ id: `L${level.id}.${spot.id}`, correctAction: spot.correctAction, choices: spot.choices });
    }
  }
  return all;
};

describe('the bias this exists to remove', () => {
  it('is real in the authored content, which is why the display order is not the authored one', () => {
    // Not a complaint about the content — writing the answer first is the only
    // sane way to author a question. It is the reason the *display* order has
    // to be somebody else's job.
    const questions = everyQuestion();
    expect(questions.length).toBeGreaterThan(50);
    const first = questions.filter(q => q.choices[0]?.action === q.correctAction).length;
    expect(first / questions.length).toBeGreaterThan(0.4);
  });
});

describe('ordering one question', () => {
  it('never touches the authored array', () => {
    const authored: QuestionChoice[] = [...CHOICES];
    const snapshot = JSON.stringify(authored);
    for (let seed = 1; seed < 40; seed++) orderChoices(authored, seed);
    expect(JSON.stringify(authored)).toBe(snapshot);
  });

  it('keeps every answer exactly once, with its own action', () => {
    for (let seed = 1; seed < 200; seed++) {
      const shown = orderChoices(CHOICES, seed);
      expect(shown).toHaveLength(CHOICES.length);
      // Sorted by label, the two lists have to be identical — a shuffle that
      // dropped, duplicated or re-paired an answer would show up here.
      const key = (list: QuestionChoice[]) =>
        [...list].sort((a, b) => a.label.localeCompare(b.label)).map(c => `${c.label}|${c.action}`);
      expect(key(shown)).toEqual(key(CHOICES));
    }
  });

  it('gives the same question the same order every time within one attempt', () => {
    // This is what stops the answers moving under the cursor: the drive
    // re-renders the panel on every painted frame.
    const once = displayedChoices(CHOICES, 12345, 'level9.brakes-gone');
    for (let i = 0; i < 20; i++) {
      expect(displayedChoices(CHOICES, 12345, 'level9.brakes-gone')).toEqual(once);
    }
  });

  it('gives two questions in one attempt different orders', () => {
    // Keyed on the id rather than a counter, so one attempt is not one rotation
    // applied to everything.
    const seeds = new Set(
      ['a.one', 'a.two', 'a.three', 'a.four'].map(id => seedForQuestion(999, id))
    );
    expect(seeds.size).toBe(4);
  });

  it('leaves the authored order alone at seed 0, which is the escape hatch', () => {
    // The component gallery pins this so a stage opened for visual QA looks the
    // same every time, and most UI tests assert against authored copy.
    expect(displayedChoices(CHOICES, 0, 'anything').map(d => d.authoredIndex)).toEqual([0, 1, 2]);
  });
});

describe('across attempts', () => {
  it('moves the correct answer through every position', () => {
    // The whole point. One question, many attempts: the right answer must not
    // keep landing in the same place.
    const positions = new Set<number>();
    for (let attempt = 1; attempt <= 60; attempt++) {
      const shown = displayedChoices(CHOICES, attempt * 7919, 'level9.brakes-gone');
      positions.add(shown.findIndex(d => d.choice.action === 'brake'));
    }
    expect([...positions].sort()).toEqual([0, 1, 2]);
  });

  it('balances the correct answer across positions rather than favoring the first', () => {
    // Swept over every real question in the game, 30 attempts each, so this is
    // a statement about the content the player actually meets.
    const counts = [0, 0, 0];
    let total = 0;
    for (const question of everyQuestion()) {
      if (question.choices.length !== 3) continue;
      for (let attempt = 1; attempt <= 30; attempt++) {
        const shown = displayedChoices(question.choices, attempt * 104729, question.id);
        const at = shown.findIndex(d => d.choice.action === question.correctAction);
        if (at < 0) continue;
        counts[at] += 1;
        total += 1;
      }
    }
    expect(total).toBeGreaterThan(1000);
    // Each position within a few points of a third. The authored content sits
    // at 55/22/22; anything like that here would mean the shuffle is not
    // actually reaching the questions.
    for (const [at, count] of counts.entries()) {
      const share = count / total;
      expect(share, `position ${at + 1} share ${share.toFixed(3)}`).toBeGreaterThan(0.28);
      expect(share, `position ${at + 1} share ${share.toFixed(3)}`).toBeLessThan(0.39);
    }
  });

  it('shows a different order for the same question on a different attempt', () => {
    const a = displayedChoices(CHOICES, 111, 'level5.roundabout-entry.circulating-car');
    const attempts = new Set<string>();
    for (let attempt = 1; attempt <= 40; attempt++) {
      attempts.add(
        displayedChoices(CHOICES, attempt * 31337, 'level5.roundabout-entry.circulating-car')
          .map(d => d.authoredIndex)
          .join('')
      );
    }
    expect(attempts.size).toBeGreaterThan(1);
    expect(a).toHaveLength(3);
  });
});
