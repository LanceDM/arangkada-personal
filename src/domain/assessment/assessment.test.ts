import { describe, expect, it } from 'vitest';
import type { TestResponse, TestSitting } from './testResponse';
import {
  postTestSittingRecord,
  routingScoreOf,
  TEST_RESPONSE_CSV_COLUMNS,
  testResponsesCsv,
  testSittingProblems,
  type PresentedItem,
} from './testResponse';
import type { RoutingCuts, TwoStageDesign } from './twoStageDesign';
import { readTwoStageDesign, routeByScore, twoStageDesignProblems } from './twoStageDesign';

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

const design: TwoStageDesign = {
  schemaVersion: 1,
  designId: 'design-1',
  calibrationId: 'calibration-1',
  routing: ids('R', 15),
  easy: ids('E', 15),
  medium: ids('M', 15),
  hard: ids('H', 15),
  cuts: [6, 11],
};

const answer = (itemId: string, position: number, correct: boolean, extra: Partial<TestResponse> = {}): TestResponse => ({
  itemId, revision: 1, competency: 'signs', stage: 'pre', block: null, position,
  choiceOrder: [2, 0, 3, 1], chosen: correct ? 0 : 1, correct, timeMs: 8000, ...extra,
});

const post = (rightOnRouting: number, block: 'easy' | 'medium' | 'hard'): TestSitting => ({
  schemaVersion: 1, sittingId: 's2', playerCode: 'P01', kind: 'post', seed: 7,
  startedAt: 1000, finishedAt: 2000, designId: 'design-1',
  routing: { score: rightOnRouting, cuts: [6, 11], block },
  responses: [
    ...design.routing.map((id, i) => answer(id, i + 1, i < rightOnRouting, { stage: 'routing', block: 'routing' })),
    ...design[block].map((id, i) => answer(id, 16 + i, true, { stage: 'stage2', block })),
  ],
});

describe('routing by score', () => {
  it('routes below c1 to easy, below c2 to medium, and the rest to hard', () => {
    expect([0, 5, 6, 10, 11, 15].map(s => routeByScore(s, [6, 11])))
      .toEqual(['easy', 'easy', 'medium', 'medium', 'hard', 'hard']);
  });

  // Every score of a 15-item routing block, under every pair of cut points a
  // design can hold: each score has one block, and each boundary falls where
  // the cut point says.
  it('gives every routing score one block, never decreasing, with each cut point a boundary', () => {
    const order = ['easy', 'medium', 'hard'];
    for (let c1 = 1; c1 < 15; c1++) {
      for (let c2 = c1 + 1; c2 <= 15; c2++) {
        const cuts: RoutingCuts = [c1, c2];
        const blocks = Array.from({ length: 16 }, (_, score) => routeByScore(score, cuts));
        blocks.forEach((block, score) => {
          expect(block).toBe(score < c1 ? 'easy' : score < c2 ? 'medium' : 'hard');
          if (score > 0) expect(order.indexOf(block)).toBeGreaterThanOrEqual(order.indexOf(blocks[score - 1]));
        });
        expect([blocks[c1 - 1], blocks[c1], blocks[c2 - 1], blocks[c2]]).toEqual(['easy', 'medium', 'medium', 'hard']);
        expect(routeByScore(15, cuts)).toBe('hard');
        expect(routeByScore(0, cuts)).toBe('easy');
      }
    }
  });

  it('reads a stored design back, and refuses what is not one', () => {
    const stored = JSON.parse(JSON.stringify(design)) as Record<string, unknown>;
    expect(readTwoStageDesign(stored)).toEqual(design);
    expect(readTwoStageDesign(null)).toBeNull();
    expect(readTwoStageDesign({ ...stored, calibrationId: undefined })).toBeNull();
    expect(readTwoStageDesign({ ...stored, cuts: [6] })).toBeNull();
    expect(twoStageDesignProblems({ ...design, calibrationId: '' })).toEqual(['calibrationId is empty']);
  });

  it('accepts a design whose four blocks are disjoint and equal, with every block reachable', () => {
    expect(twoStageDesignProblems(design)).toEqual([]);
    expect(twoStageDesignProblems({ ...design, cuts: [0, 11] })).toHaveLength(1);
    expect(twoStageDesignProblems({ ...design, cuts: [6, 16] })).toHaveLength(1);
    expect(twoStageDesignProblems({ ...design, hard: [...design.hard.slice(1), 'E1'] })).toEqual(['item E1 is in more than one place']);
  });
});

describe('a sitting record', () => {
  const pre: TestSitting = {
    schemaVersion: 1, sittingId: 's1', playerCode: 'P01', kind: 'pre', seed: 3,
    startedAt: 1000, finishedAt: 2000, designId: null, routing: null,
    responses: [answer('A', 2, true), answer('B', 1, false), answer('C', 3, false, { chosen: null })],
  };

  it('accepts a pre-test and a correctly routed post-test', () => {
    expect(testSittingProblems(pre)).toEqual([]);
    expect(testSittingProblems(post(8, 'medium'), design)).toEqual([]);
  });

  it('never takes a name or an email for the player', () => {
    expect(testSittingProblems({ ...pre, playerCode: 'juan@example.com' })).toHaveLength(1);
    expect(testSittingProblems({ ...pre, playerCode: 'Juan Cruz' })).toHaveLength(1);
  });

  it('refuses a routing score or block the answers and cut points do not give', () => {
    const sitting = post(8, 'medium');
    expect(testSittingProblems({ ...sitting, routing: { ...sitting.routing!, score: 9 } })).toContain('routing score 9 is not the 8 correct');
    expect(testSittingProblems(post(4, 'medium'))).toContain('the block is not the one the cut points give');
  });

  it('holds a post-test to its design', () => {
    expect(testSittingProblems(post(8, 'medium'), { ...design, cuts: [5, 11] })).toContain('cut points differ from the design');
  });

  it('refuses an unanswered item marked correct, and repeated positions', () => {
    expect(testSittingProblems({ ...pre, responses: [answer('A', 1, true, { chosen: null })] })).toHaveLength(1);
    expect(testSittingProblems({ ...pre, responses: [answer('A', 1, true), answer('B', 1, true)] }))
      .toContain('positions are not 1..n, each once');
  });

  it('writes one CSV row per answer, in the order shown', () => {
    const csv = testResponsesCsv([pre]).trimEnd().split('\n');
    expect(csv[0]).toBe(TEST_RESPONSE_CSV_COLUMNS.join(','));
    expect(csv.slice(1)).toEqual([
      'P01,pre,s1,3,,B,1,signs,pre,,1,2|0|3|1,1,1,0,8000,,,',
      'P01,pre,s1,3,,A,1,signs,pre,,2,2|0|3|1,0,1,1,8000,,,',
      'P01,pre,s1,3,,C,1,signs,pre,,3,2|0|3|1,,0,0,8000,,,',
    ]);
    expect(testResponsesCsv([post(8, 'medium')]).split('\n')[1]).toBe('P01,post,s2,7,design-1,R1,1,signs,routing,routing,1,2|0|3|1,0,1,1,8000,8,medium,6|11');
    expect(testResponsesCsv([{ ...pre, responses: [answer('A,"1"', 1, true)] }])).toContain('"A,""1"""');
  });
});

describe('a post-test record', () => {
  const presented = (prefix: string): PresentedItem[] =>
    ids(prefix, 15).map(id => ({ item: { id, revision: 1, competency: 'signs', correctIndex: 0 }, choiceOrder: [1, 0, 2, 3] }));

  const sitting = (rightOnRouting: number) => {
    const routingPresented = presented('R');
    const answers = Object.fromEntries(routingPresented.map((p, i) => [p.item.id, { chosen: i < rightOnRouting ? 0 : 1, timeMs: 5000 }]));
    const block = routeByScore(rightOnRouting, design.cuts);
    return postTestSittingRecord({
      sittingId: 'P01-post', playerCode: 'P01', seed: 9, startedAt: 1, finishedAt: 2, design,
      routingPresented,
      stage2Presented: presented(block[0].toUpperCase()),
      answers,
    });
  };

  it('records the routing score, cut points and block, and agrees with its design at every score', () => {
    for (let score = 0; score <= 15; score++) {
      const record = sitting(score);
      expect(record.routing).toEqual({ score, cuts: [6, 11], block: routeByScore(score, [6, 11]) });
      expect(testSittingProblems(record, design)).toEqual([]);
      expect(record.responses.map(r => r.position)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    }
  });

  it('counts an unanswered routing item as wrong, as the routing did', () => {
    const routingPresented = presented('R');
    const answers = { R1: { chosen: 0, timeMs: 1 }, R2: { chosen: null, timeMs: 1 } };
    expect(routingScoreOf(routingPresented, answers)).toBe(1);
    const record = postTestSittingRecord({
      sittingId: 's', playerCode: 'P01', seed: 1, startedAt: 1, finishedAt: 2, design,
      routingPresented, stage2Presented: presented('E'), answers,
    });
    expect(record.routing).toEqual({ score: 1, cuts: [6, 11], block: 'easy' });
    expect(testSittingProblems(record, design)).toEqual([]);
  });
});
