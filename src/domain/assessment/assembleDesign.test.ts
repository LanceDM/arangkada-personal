import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { irtDesign, placeholderDesign, type DesignItem, type PreTestAnswers } from './assembleDesign';
import { routeByScore, twoStageDesignProblems } from './twoStageDesign';

// 60 items over the 11 competencies: 5 or 6 each, as the bank's test items are.
const items: DesignItem[] = Array.from({ length: 60 }, (_, i) => ({ id: `T-${String(i).padStart(2, '0')}`, competency: COMPETENCIES[i % 11] }));

describe('the post-test design', () => {
  it('has a usable placeholder: four parallel blocks of 15, every competency spread, cuts at thirds', () => {
    const design = placeholderDesign(items, 'placeholder-test');
    expect(twoStageDesignProblems(design)).toEqual([]);
    expect(design.calibrationId).toBe('placeholder');
    expect(design.cuts).toEqual([5, 10]);
    for (const block of [design.routing, design.easy, design.medium, design.hard]) {
      const competencies = new Set(block.map(id => items.find(item => item.id === id)!.competency));
      expect(block).toHaveLength(15);
      expect(competencies.size).toBeGreaterThanOrEqual(10);
    }
  });

  it('refuses a bank without exactly 60 test items', () => {
    expect(() => placeholderDesign(items.slice(1), 'x')).toThrow(/exactly 60/);
  });

  it('orders the blocks by pre-test difficulty once there is data, and cuts the routing score in thirds', () => {
    // Item i is answered right by people whose skill exceeds i: higher ids are harder.
    const pretests: PreTestAnswers[] = Array.from({ length: 30 }, (_, person) => ({
      answered: new Set(items.map(item => item.id)),
      correct: new Set(items.filter((_, i) => i < person * 2).map(item => item.id)),
    }));
    const { design, difficulties } = irtDesign(items, pretests, 'irt-test', 'pretest-test');
    expect(twoStageDesignProblems(design)).toEqual([]);
    const b = new Map(difficulties.map(item => [item.id, item.b]));
    const mean = (ids: readonly string[]) => ids.reduce((s, id) => s + b.get(id)!, 0) / ids.length;
    expect(mean(design.easy)).toBeLessThan(mean(design.medium));
    expect(mean(design.medium)).toBeLessThan(mean(design.hard));
    // About a third of the pre-test takers would route to each block.
    const routing = new Set(design.routing);
    const routed = pretests.map(p => routeByScore([...p.correct].filter(id => routing.has(id)).length, design.cuts));
    for (const block of ['easy', 'medium', 'hard'] as const) expect(routed.filter(r => r === block).length).toBeGreaterThanOrEqual(7);
  });

  it('draws the routing block at random, one from each band of four by difficulty, the same draw for the same design id', () => {
    const pretests: PreTestAnswers[] = Array.from({ length: 30 }, (_, person) => ({
      answered: new Set(items.map(item => item.id)),
      correct: new Set(items.filter((_, i) => i < person * 2).map(item => item.id)),
    }));
    const a = irtDesign(items, pretests, 'irt-a', 'cal');
    const order = a.difficulties.map(item => item.id);
    const bands = a.design.routing.map(id => Math.floor(order.indexOf(id) / 4));
    expect(bands).toEqual(Array.from({ length: 15 }, (_, i) => i));
    expect(irtDesign(items, pretests, 'irt-a', 'cal').design.routing).toEqual(a.design.routing);
    // Not the old fixed pick (every fourth item from the second): a draw.
    const draws = ['irt-a', 'irt-b', 'irt-c', 'irt-d'].map(id => irtDesign(items, pretests, id, 'cal').design.routing.join());
    expect(new Set(draws).size).toBeGreaterThan(1);
  });
});
