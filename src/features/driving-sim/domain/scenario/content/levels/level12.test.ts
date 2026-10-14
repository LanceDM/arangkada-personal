/**
 * Level 12, the final exam, as the same test for every learner.
 *
 * The level this replaced drew a Stop junction where its checkpoint was meant
 * to be, graded paperwork with the brake, rested two verdicts on rules no LTO
 * file states, picked its signs slot by the learner's own coverage record, and
 * passed a driver who missed three of its seven scenarios. So the assertions
 * below are about the exam as an instrument: what it is made of, that nothing
 * but the attempt's seed decides which variant a learner meets, that a pass
 * means the same thing whatever was rolled, and that its own half asks only
 * what the quoted LTO sources say.
 */
import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { createRng } from '@/shared/lib/rng';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { START_SCORE, scoreDecision } from '@/features/driving-sim/domain/scoring/scoreDecision';
import { buildLevelConfig } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import { scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { level12Module } from '@/features/driving-sim/domain/scenario/content/lessons/level12Module';
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import { createLevel12, level12, SLOTS, SLOT_DISTANCES } from './level12';

const OWN = [0, 2, 4, 7];
const BORROWED = [1, 3, 5, 6];

const own = OWN.flatMap(slot => SLOTS[slot]);
const placed = (variant: SlotVariant): ScenarioEvent => ({ ...variant, triggerAtDistance: 0 }) as ScenarioEvent;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** A wrong answer the rule engine grades wrong: the first such choice, else the first such act. */
const wrongAction = (event: ScenarioEvent): string =>
  event.choices?.find(choice => !evaluateWeightedRule(event, choice.action, 0).isCorrect)?.action ??
  ['accelerate', 'stop'].find(action => !evaluateWeightedRule(event, action, 0).isCorrect)!;

/** The score a drive of `events` ends on when `missed` are answered wrong, by the game's own rules. */
const finalScore = (events: ScenarioEvent[], missed: Set<number>): number =>
  events.reduce((running, event, index) => {
    const action = missed.has(index) ? wrongAction(event) : event.correctAction;
    const verdict = evaluateWeightedRule(event, action, running.streak);
    return scoreDecision(running, event, verdict, 'neutral');
  }, START_SCORE).score;

describe('the final exam, as it is made', () => {
  it('is eight slots, half of them this level’s own and half borrowed from Levels 1-11', () => {
    expect(SLOTS).toHaveLength(8);
    expect(SLOT_DISTANCES).toEqual([600, 1300, 2000, 2700, 3400, 4100, 4800, 5500]);
    for (const slot of OWN) {
      expect(SLOTS[slot].every(variant => variant.id.startsWith('level12.')), `slot ${slot + 1}`).toBe(true);
    }
    for (const slot of BORROWED) {
      const sources = SLOTS[slot].map(variant => Number(variant.id.match(/^level(\d+)\./)?.[1]));
      expect(sources.every(level => level >= 1 && level <= 11), `slot ${slot + 1}`).toBe(true);
    }
  });

  it('borrows whole pools, chosen by declared field and never by id', () => {
    const ids = (variants: SlotVariant[]) => variants.map(variant => variant.id);
    const portable = (competency: DrivingCompetency) => remediationCandidates(competency, 11).map(c => c.variant);

    expect(ids(SLOTS[1])).toEqual(ids(portable('road_signs')));
    expect(ids(SLOTS[3])).toEqual(ids(portable('right_of_way')));
    expect(ids(SLOTS[5])).toEqual(ids(portable('hazard_awareness')));
    expect(ids(SLOTS[6])).toEqual(ids(portable('lane_discipline').filter(v => v.requiredLane?.strict === true)));
    expect(BORROWED.map(slot => SLOTS[slot].length)).toEqual([38, 24, 12, 6]);
  });

  it("never rolls Level 3's prohibitions on a turn it does not offer, which nothing can fail", () => {
    const UNFAILABLE = new Set([
      'level3.route-restriction.no-entry-all-vehicles',
      'level3.route-restriction.no-left-turn',
      'level3.route-restriction.no-right-turn',
      'level3.route-restriction.no-u-turn',
      'level3.route-restriction.no-entry-cars',
    ]);
    expect(SLOTS.flat().filter(variant => UNFAILABLE.has(variant.id))).toEqual([]);
    for (let seed = 1; seed <= 500; seed++) {
      const rolled = createLevel12(createRng(seed)).events.filter(event => UNFAILABLE.has(event.id));
      expect(rolled, `seed ${seed}`).toEqual([]);
    }
  });

  it('is on one scale: every variant worth 25 and graded major, so every roll is worth 200', () => {
    const offScale = SLOTS.flat()
      .filter(variant => variant.points !== 25 || variant.severity !== 'major')
      .map(variant => variant.id);
    expect(offScale).toEqual([]);
    for (let seed = 1; seed <= 50; seed++) {
      const total = createLevel12(createRng(seed)).events.reduce((sum, event) => sum + event.points, 0);
      expect(total, `seed ${seed}`).toBe(200);
    }
  });

  it('passes at 70% of that, with stars at 83% and 95%, the marks Levels 2-11 set', () => {
    expect(level12.requiredScore).toBe(Math.ceil(0.7 * 200));
    expect(level12.stars2).toBe(Math.ceil(0.83 * 200));
    expect(level12.stars3).toBe(Math.ceil(0.95 * 200));
    expect(level12.roadLength).toBe(6200);
  });

  it('passes one miss always and three never, whatever is rolled', () => {
    // A second miss passes only while the running score is still at the floor
    // it cannot go below, so the orders that pass are the early ones.
    for (const seed of [1, 7, 42, 901]) {
      const events = createLevel12(createRng(seed)).events;
      const passing: Record<number, [number, number]> = {};
      for (let pattern = 0; pattern < 1 << events.length; pattern++) {
        const missed = new Set(events.map((_, i) => i).filter(i => (pattern >> i) & 1));
        const tally = (passing[missed.size] ??= [0, 0]);
        tally[1] += 1;
        if (finalScore(events, missed) >= level12.requiredScore) tally[0] += 1;
      }
      expect(passing, `seed ${seed}`).toEqual({
        0: [1, 1], 1: [8, 8], 2: [6, 28], 3: [0, 56], 4: [0, 70], 5: [0, 56], 6: [0, 28], 7: [0, 8], 8: [0, 1],
      });
    }
  });

  it('grades the competencies each slot is tagged with', () => {
    const tags = SLOTS.map(slot => [...new Set(slot.map(variant => variant.competency))]);
    expect(tags).toEqual([
      ['document_awareness'],
      ['road_signs'],
      ['general_rules'],
      ['right_of_way'],
      ['driver_legality'],
      ['hazard_awareness'],
      ['lane_discipline'],
      ['hazard_awareness'],
    ]);
  });
});

describe('the same test for every learner', () => {
  const coverages: SignCoverage[] = [
    {},
    // Every plate in the signs pool met and mastered, long ago.
    Object.fromEntries(SLOTS[1].map(v => [v.sign!.name, { seen: 3, correct: 3, wrong: 0, lastSeenAt: 1 }])),
    // Every plate failed but one, which was never shown: coverage would pick it.
    Object.fromEntries(SLOTS[1].slice(1).map(v => [v.sign!.name, { seen: 2, correct: 0, wrong: 2, lastSeenAt: 5 }])),
  ];

  it('rolls from the attempt’s seed and nothing else: no coverage, no weak area', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const route = buildLevelConfig(12, undefined, null, createRng(seed))!.events.map(event => event.id);
      for (const coverage of coverages) {
        for (const weak of [null, ...COMPETENCIES]) {
          const rolled = buildLevelConfig(12, coverage, weak, createRng(seed))!.events.map(event => event.id);
          expect(rolled, `seed ${seed}, weak ${weak}`).toEqual(route);
        }
      }
    }
  });

  it('still rolls: a retake is not the same eight questions', () => {
    const routes = new Set(
      Array.from({ length: 30 }, (_, i) => createLevel12(createRng(i + 1)).events.map(e => e.id).join('|'))
    );
    expect(routes.size).toBeGreaterThan(25);
  });
});

describe('the enforcement half, and the emergency', () => {
  it('asks every enforcement question at a stop, and the emergency in a frozen prompt', () => {
    for (const slot of [0, 2, 4]) {
      expect(SLOTS[slot].filter(variant => !variant.inspection).map(v => v.id), `slot ${slot + 1}`).toEqual([]);
    }
    expect(SLOTS[7].map(variant => [variant.cutscene, variant.emergency])).toEqual([
      [true, 'skid'],
      [true, 'brake_loss'],
    ]);
  });

  it('has exactly one right answer to every question, and no answer a stop could satisfy by accident', () => {
    for (const variant of own) {
      const event = placed(variant);
      const right = (event.choices ?? []).filter(choice => evaluateWeightedRule(event, choice.action, 0).isCorrect);
      expect(right, event.id).toHaveLength(1);
      // `brake` is satisfied by `stop` (`actionSatisfies`), so it is never the
      // answer to a question with a `stop` among its choices.
      expect(event.correctAction, event.id).not.toBe('brake');
    }
  });

  it('names each scenario in a word or three, and sets it up without the move', () => {
    const MOVE = /\b(?:stop(?:ped|s)?\b|pull(?:ed)? over|stay (?:seated|in)|contest|pay|confiscat|impound|steer|off the (?:pedals|accelerator)|parking brake)/i;
    for (const variant of own) {
      const event = placed(variant);
      expect(event.label, `${event.id} has no label`).toBeTruthy();
      expect(words(scenarioLabel(event)), `${event.id} label`).toBeLessThanOrEqual(3);
      expect(scenarioLabel(event), `${event.id} label`).not.toMatch(MOVE);
      expect(event.description, `${event.id} description`).not.toMatch(MOVE);
      for (const choice of event.choices ?? []) {
        expect(event.description.toLowerCase(), event.id).not.toContain(choice.label.toLowerCase());
        expect((event.question ?? '').toLowerCase(), event.id).not.toContain(choice.label.toLowerCase());
      }
    }
  });

  it('claims nothing the LTO sources leave open', () => {
    // What a scenario states as true: its citation, its verdict on a right
    // answer, and the right answer itself. A penalty may name the misconception
    // it corrects, so it is held only to the rules no scenario may state at all.
    const OPEN: Array<[RegExp, string, 'anywhere' | 'as true']> = [
      [/overrid|precedence/i, 'no file says an officer overrides a signal', 'anywhere'],
      [/rolling stop/i, 'RA 4136’s through-highway proviso conflicts', 'anywhere'],
      [/\b(?:light|less grave|grave) violation/i, 'no file lists which violation is which category', 'anywhere'],
      [/\b911\b|\b117\b/, 'no hotline is sourced for this level', 'anywhere'],
      [/until the case is settled/i, 'the TOP is 72 hours only', 'as true'],
    ];
    const claimed = own.flatMap(variant => {
      const right = variant.choices?.find(choice => choice.action === variant.correctAction)?.label ?? '';
      const asTrue = [variant.lawCitation, variant.rewardMessage, right].join(' ');
      return OPEN.filter(([pattern, , where]) =>
        pattern.test(asTrue) || (where === 'anywhere' && pattern.test(variant.penaltyMessage))
      ).map(([, why]) => `${variant.id}: ${why}`);
    });
    expect(claimed).toEqual([]);
  });

  it('asks nothing that turns on stepping out when told to', () => {
    const asked = own.filter(variant =>
      variant.choices?.some(
        choice => choice.action === variant.correctAction && /step (?:out|down)|get out/i.test(choice.label)
      )
    );
    expect(asked.map(variant => variant.id)).toEqual([]);
  });
});

describe('the lesson, where it contradicted the sources', () => {
  const rows = level12Module.lessons.flatMap(lesson =>
    lesson.blocks.flatMap(block => (block.type === 'table' ? block.rows.map(row => row.join(' | ')) : []))
  );

  it('reads SP as the Student-Driver’s Permit, as FDM Vol. 1 defines it', () => {
    expect(rows.filter(row => /special permit|professional driver holding/i.test(row))).toEqual([]);
    expect(rows.some(row => /Student-Driver's Permit \(SP\) with 5 demerit points/.test(row))).toBe(true);
  });

  it('gives a falsified license application RA 10930’s penalty, not the older JAO’s', () => {
    expect(rows.filter(row => /fake documents/i.test(row))).toEqual([]);
    expect(rows.some(row => /RA 10930.*Php 20,000/.test(row))).toBe(true);
  });
});
