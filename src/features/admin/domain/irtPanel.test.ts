import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import type { TestResponse, TestSitting } from '@/domain/assessment/testResponse';
import { bankReadiness, itemDrift, readTestProgress, testCounts, type ParticipantTests } from './irtPanel';

const sixty = COMPETENCIES.flatMap((competency, c) =>
  Array.from({ length: c < 5 ? 6 : 5 }, (_, k) => ({ id: `T-${c}-${k}`, competency, isActive: true })));

describe('the item bank’s readiness', () => {
  it('is ready on exactly 60 switched-on items over every competency', () => {
    const ready = bankReadiness(sixty);
    expect(ready).toMatchObject({ switchedOn: 60, competenciesCovered: 11, competencies: 11, ready: true, placeholder: false });
    expect(ready.perCompetency[0]).toEqual({ competency: COMPETENCIES[0], items: 6 });
  });

  it('is not ready with an item off or a competency missing, and notices placeholders', () => {
    expect(bankReadiness(sixty.map((item, i) => (i === 0 ? { ...item, isActive: false } : item))).ready).toBe(false);
    const missing = sixty.map(item => (item.competency === COMPETENCIES[10] ? { ...item, competency: COMPETENCIES[0] } : item));
    expect(bankReadiness(missing)).toMatchObject({ switchedOn: 60, competenciesCovered: 10, ready: false });
    expect(bankReadiness([{ id: 'PH-TEST-01', competency: COMPETENCIES[0], isActive: true }]).placeholder).toBe(true);
  });
});

const response = (itemId: string, correct: boolean, stage: TestResponse['stage'] = 'pre'): TestResponse => ({
  itemId, revision: 1, competency: 'road_signs', stage, block: null, position: 1, choiceOrder: [0, 1], chosen: correct ? 0 : 1, correct, timeMs: 1,
});
const sitting = (kind: 'pre' | 'post', responses: TestResponse[]): TestSitting => ({
  schemaVersion: 1, sittingId: kind, playerCode: 'P-0001', kind, seed: 1, startedAt: 0, finishedAt: 1, designId: null, routing: null, responses,
});
const participant = (overrides: Partial<ParticipantTests>): ParticipantTests => ({
  code: 'P-0001', cohort: 'study', pre: null, post: null, preSitting: null, postSitting: null, ...overrides,
});

describe('the live counts', () => {
  it('counts tests open and finished, and post-tests by their routed block', () => {
    const counts = testCounts([
      participant({ pre: { status: 'finished', block: null }, post: { status: 'finished', block: 'hard' } }),
      participant({ pre: { status: 'finished', block: null }, post: { status: 'open', block: 'easy' } }),
      participant({ pre: { status: 'open', block: null } }),
      participant({}),
    ]);
    expect(counts).toEqual({ enrolled: 4, preOpen: 1, preFinished: 2, postOpen: 1, postFinished: 1, routed: { easy: 1, medium: 0, hard: 1 } });
  });

  it('reads a status as stored, cut to its state and block', () => {
    expect(readTestProgress({ status: 'open', stage: 'routing', block: null, seed: 4 })).toEqual({ status: 'open', block: null });
    expect(readTestProgress({ status: 'finished', block: 'medium' })).toEqual({ status: 'finished', block: 'medium' });
    expect(readTestProgress({ status: 'x' })).toBeNull();
    expect(readTestProgress(null)).toBeNull();
  });

  it('gives each item’s percent correct at each sitting, unanswered as wrong', () => {
    const drift = itemDrift([
      participant({ preSitting: sitting('pre', [response('I-2', true), response('I-10', false)]), postSitting: sitting('post', [response('I-2', true, 'routing')]) }),
      participant({ code: 'P-0002', preSitting: sitting('pre', [response('I-2', false), response('I-10', false)]) }),
    ]);
    expect(drift.map(d => [d.itemId, d.preN, d.prePct, d.postN, d.postPct])).toEqual([
      ['I-2', 2, 50, 1, 100],
      ['I-10', 2, 0, 0, null],
    ]);
  });
});
