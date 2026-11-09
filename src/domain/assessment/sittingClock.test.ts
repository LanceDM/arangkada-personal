/**
 * The sitting's clock and the record built from the server's draft. The items and answers are placeholders written for this test.
 */
import { describe, expect, it } from 'vitest';
import { millisOf, POST_TEST_PART_LIMIT_SECONDS, PRE_TEST_LIMIT_SECONDS, readDraftAnswers, sittingStoppedAt, timedAnswers } from './sittingClock';
import { abandonedSitting, presentWith, recordDraftProblems, type ShownItem, type TestShuffle } from './sittingFromDraft';
import { readTestSitting, testResponsesCsv, testSittingProblems } from './testResponse';
import type { TwoStageDesign } from './twoStageDesign';

const item = (id: string): ShownItem => ({ id, revision: 2, competency: 'road_signs', correctIndex: 0, options: ['a', 'b', 'c', 'd'] });
const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);

/** No shuffling at all: the tests read the order plainly. */
const asGiven: TestShuffle = { order: values => [...values], seedFor: () => 0 };

const design: TwoStageDesign = {
  schemaVersion: 1, designId: 'd', calibrationId: 'c',
  routing: ids('R', 15), easy: ids('E', 15), medium: ids('M', 15), hard: ids('H', 15), cuts: [6, 11],
};
const bank = [...design.routing, ...design.easy, ...design.medium, ...design.hard].map(item);

describe("a sitting's clock", () => {
  it('reads a server timestamp from either SDK, and no other thing', () => {
    expect(millisOf({ toMillis: () => 5 })).toBe(5);
    expect(millisOf(5)).toBe(5);
    expect(millisOf(null)).toBeNull();
    expect(millisOf('5')).toBeNull();
  });

  it('stops a pre-test at its deadline', () => {
    const facts = { kind: 'pre' as const, startedAt: 1_000 };
    const deadline = 1_000 + PRE_TEST_LIMIT_SECONDS * 1000;
    expect(sittingStoppedAt(facts, deadline - 1)).toBeNull();
    expect(sittingStoppedAt(facts, deadline)).toBe(deadline);
    expect(sittingStoppedAt(facts, deadline + 86_400_000)).toBe(deadline);
  });

  it('stops each part of a post-test by its own clock, and between the parts at once', () => {
    const part = POST_TEST_PART_LIMIT_SECONDS * 1000;
    const routing = { kind: 'post' as const, startedAt: 1_000, stage: 'routing' as const };
    expect(sittingStoppedAt(routing, 1_000 + part - 1)).toBeNull();
    expect(sittingStoppedAt(routing, 1_000 + part)).toBe(1_000 + part);
    // Part 1 closed and part 2 never started: no clock runs, and only the participant can start one.
    expect(sittingStoppedAt({ ...routing, stage: 'stage2', stage2At: 2_000, stage2StartedAt: null }, 3_000)).toBe(2_000);
    const second = { ...routing, stage: 'stage2' as const, stage2At: 2_000, stage2StartedAt: 500_000 };
    expect(sittingStoppedAt(second, 500_000 + part - 1)).toBeNull();
    expect(sittingStoppedAt(second, 500_000 + part)).toBe(500_000 + part);
  });

  it('times each answer from the one before it, by the server’s times', () => {
    const answers = { A: { chosen: 1, at: 1_500 }, B: { chosen: 0, at: 4_000 } };
    expect(timedAnswers(['A', 'B', 'C'], answers, 1_000)).toEqual({
      A: { chosen: 1, timeMs: 500 },
      B: { chosen: 0, timeMs: 2_500 },
    });
  });

  it('reads the stored answers, leaving out what is not one', () => {
    expect(
      readDraftAnswers({
        answers: {
          A: { chosen: 2, at: { toMillis: () => 9 } },
          B: { chosen: 'x', at: { toMillis: () => 9 } },
          C: { chosen: 1, at: null },
        },
      })
    ).toEqual({ A: { chosen: 2, at: 9 } });
    expect(readDraftAnswers(undefined)).toEqual({});
    expect(readDraftAnswers({ answers: 'x' })).toEqual({});
  });
});

describe('a sitting nobody came back to close', () => {
  const closeBase = { shuffle: asGiven, playerCode: 'P-0001', seed: 7, startedAt: 1_000, stage2StartedAt: null };

  it('closes a pre-test with what the server has, the rest unanswered, and reaches the CSV', () => {
    const items = ids('T', 60).map(item);
    const answers = { T01: { chosen: 0, at: 3_000 }, T02: { chosen: 1, at: 5_000 } };
    const sitting = abandonedSitting({ ...closeBase, kind: 'pre', stoppedAt: 3_601_000, items, answers, design: null });
    expect(testSittingProblems(sitting)).toEqual([]);
    expect(sitting).toMatchObject({ kind: 'pre', sittingId: 'P-0001-pre', closedBy: 'export', finishedAt: 3_601_000, seed: 7 });
    expect(sitting.responses).toHaveLength(60);
    expect(sitting.responses.slice(0, 2).map(r => [r.chosen, r.correct, r.timeMs])).toEqual([[0, true, 2_000], [1, false, 2_000]]);
    expect(sitting.responses.slice(2).every(r => r.chosen === null && !r.correct && r.timeMs === 0)).toBe(true);
    expect(recordDraftProblems(sitting, answers)).toEqual([]);

    const stored = readTestSitting(JSON.parse(JSON.stringify(sitting)) as Record<string, unknown>);
    expect(stored).toEqual(sitting);
    expect(testResponsesCsv([stored!]).trim().split('\n')).toHaveLength(61);
  });

  it('routes a post-test as the screen would have, from the same answers', () => {
    const answers = Object.fromEntries(design.routing.slice(0, 8).map((id, i) => [id, { chosen: 0, at: 2_000 + i }]));
    const sitting = abandonedSitting({ ...closeBase, kind: 'post', stoppedAt: 901_000, items: bank, answers, design });
    expect(testSittingProblems(sitting, design)).toEqual([]);
    expect(sitting.routing).toEqual({ score: 8, cuts: [6, 11], block: 'medium' });
    expect(sitting.responses.filter(r => r.stage === 'stage2').every(r => r.block === 'medium' && r.chosen === null)).toBe(true);
    expect(sitting.responses).toHaveLength(30);
  });

  it('refuses a post-test with no design', () => {
    expect(() => abandonedSitting({ ...closeBase, kind: 'post', stoppedAt: 2, items: bank, answers: {}, design: null })).toThrow(/design/);
  });

  it('finds a record that disagrees with its draft', () => {
    const answers = { T01: { chosen: 0, at: 3_000 } };
    const sitting = abandonedSitting({ ...closeBase, kind: 'pre', stoppedAt: 9, items: ids('T', 2).map(item), answers, design: null });
    expect(recordDraftProblems(sitting, { T01: { chosen: 1, at: 3_000 } })).toHaveLength(1);
    expect(recordDraftProblems(sitting, {})).toHaveLength(1);
  });

  it('shows items the same whatever order the database returned them in', () => {
    const shuffle: TestShuffle = { order: values => [...values].reverse(), seedFor: () => 0 };
    const a = presentWith(shuffle, [item('A'), item('B')], 1, 'draw');
    const b = presentWith(shuffle, [item('B'), item('A')], 1, 'draw');
    expect(a.map(p => p.item.id)).toEqual(['B', 'A']);
    expect(b).toEqual(a);
    expect(a[0].choiceOrder).toEqual([3, 2, 1, 0]);
  });
});
