/**
 * The pre-test's order: every switched-on test item once,
 * in an order and with choice orders that the sitting's seed alone decides.
 */
import { describe, expect, it } from 'vitest';
import type { QuizItemDoc } from '@/features/driving-sim';
import { testSittingId } from '@/domain/assessment/sittingFromDraft';
import { PRE_TEST_LIMIT_SECONDS } from '@/domain/assessment/sittingClock';
import { testSittingProblems, preTestSittingRecord, type TestAnswer } from '@/domain/assessment/testResponse';
import { PRE_TEST_SECONDS, PRE_TEST_SIZE, preTestItems, presentPreTest } from './preTestForm';

/** Made-up test items for this file; the real 60 are the team's, in Firestore. */
const testItem = (n: number, overrides: Partial<QuizItemDoc> = {}): QuizItemDoc => ({
  schemaVersion: 1,
  id: `L1-GR-${String(n).padStart(2, '0')}`,
  moduleId: 'lto_level_1',
  question: `Placeholder question ${n}`,
  options: [`Right ${n}`, `Wrong ${n}a`, `Wrong ${n}b`, `Wrong ${n}c`],
  correctIndex: 0,
  explanation: '',
  image: '',
  competency: 'general_rules',
  source: 'Fixture',
  use: 'test',
  isActive: true,
  order: n,
  revision: 1,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'fixture',
  ...overrides,
});

const bank = Array.from({ length: PRE_TEST_SIZE }, (_, i) => testItem(i + 1));
const ids = (seed: number, items = bank) => presentPreTest(items, seed).map(p => p.item.id);

describe('the pre-test form', () => {
  it('asks only switched-on test items', () => {
    const items = [testItem(1), testItem(2, { use: 'quiz' }), testItem(3, { isActive: false })];
    expect(preTestItems(items).map(i => i.id)).toEqual(['L1-GR-01']);
  });

  it('is the same sitting for the same seed, and a different one for another', () => {
    expect(presentPreTest(bank, 9_001)).toEqual(presentPreTest(bank, 9_001));
    expect(ids(9_001)).not.toEqual(ids(9_002));
    expect(presentPreTest(bank, 9_001).map(p => p.choiceOrder)).not.toEqual(presentPreTest(bank, 9_002).map(p => p.choiceOrder));
  });

  it('depends on the seed and the items, not the order the database returned them in', () => {
    expect(presentPreTest([...bank].reverse(), 77)).toEqual(presentPreTest(bank, 77));
  });

  it('asks every item once, each with an order of all its choices', () => {
    const sitting = presentPreTest(bank, 123_456);
    expect(new Set(sitting.map(p => p.item.id)).size).toBe(PRE_TEST_SIZE);
    for (const { item, choiceOrder } of sitting) {
      expect([...choiceOrder].sort()).toEqual(item.options.map((_, i) => i));
    }
    // Shuffled at all: the bank's order and the authored choice order both move.
    expect(sitting.map(p => p.item.id)).not.toEqual(bank.map(i => i.id));
    expect(sitting.filter(p => p.choiceOrder[0] !== 0).length).toBeGreaterThan(PRE_TEST_SIZE / 2);
  });

  it('allows the quiz’s minute per item, as one countdown', () => {
    expect(PRE_TEST_SECONDS).toBe(60 * 60);
  });

  it('asks the limit the rules and the export hold', () => {
    expect(PRE_TEST_SECONDS).toBe(PRE_TEST_LIMIT_SECONDS);
  });

  it('records a whole sitting, the item never reached as unanswered with no time', () => {
    const presented = presentPreTest(bank, 5);
    const answers: Record<string, TestAnswer> = Object.fromEntries(
      presented.slice(0, 58).map((p, i) => [p.item.id, { chosen: p.choiceOrder[i % 4], timeMs: 3_000 + i }])
    );
    // The 59th was on screen when the clock ran out; the 60th was never shown.
    answers[presented[58].item.id] = { chosen: null, timeMs: 12_000 };
    const sitting = preTestSittingRecord({
      sittingId: testSittingId('P07', 'pre'),
      playerCode: 'P07',
      seed: 5,
      startedAt: 1_000,
      finishedAt: 3_601_000,
      presented,
      answers,
    });
    expect(testSittingProblems(sitting)).toEqual([]);
    expect(sitting.responses.map(r => r.position)).toEqual(presented.map((_, i) => i + 1));
    expect(sitting.responses.map(r => r.itemId)).toEqual(presented.map(p => p.item.id));
    expect(sitting.responses[0].choiceOrder).toEqual(presented[0].choiceOrder);
    // Right means the stored answer was picked, wherever it was shown.
    expect(sitting.responses.slice(0, 58).map(r => r.correct)).toEqual(sitting.responses.slice(0, 58).map(r => r.chosen === 0));
    expect(sitting.responses[58]).toMatchObject({ chosen: null, correct: false, timeMs: 12_000 });
    expect(sitting.responses[59]).toMatchObject({ chosen: null, correct: false, timeMs: 0 });
  });
});
