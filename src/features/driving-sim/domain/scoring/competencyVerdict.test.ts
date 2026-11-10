import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { competencyVerdicts } from './competencyVerdict';

const answer = (scenarioId: string, correct: boolean): ActionLog => ({
  timestamp: 0,
  action: 'x',
  result: correct ? 'correct' : 'violation',
  points: 0,
  scenarioId,
});

describe('the per-competency verdict on a drive', () => {
  const counted = [
    { competency: 'parking' as const, scenarioId: 'a' },
    { competency: 'parking' as const, scenarioId: 'b' },
    { competency: 'parking' as const, scenarioId: 'c' },
    { competency: 'lane_discipline' as const, scenarioId: 'd' },
    { competency: 'lane_discipline' as const, scenarioId: 'e' },
    { competency: 'lane_discipline' as const, scenarioId: 'f' },
  ];

  it('passes a competency at 2 of 3 and fails it at 1 of 3', () => {
    const verdicts = competencyVerdicts(counted, [
      answer('a', true), answer('b', false), answer('c', true),
      answer('d', true), answer('e', false), answer('f', false),
    ]);
    expect(verdicts.find(v => v.competency === 'parking')).toMatchObject({ correct: 2, passed: true });
    expect(verdicts.find(v => v.competency === 'lane_discipline')).toMatchObject({ correct: 1, passed: false });
  });

  it('counts a scenario the drive never reached as not correct', () => {
    const [parking] = competencyVerdicts(counted.slice(0, 3), [answer('a', true)]);
    expect(parking).toMatchObject({ correct: 1, ungraded: 2, passed: false });
  });

  it('reads only the first answer to a scenario', () => {
    const [parking] = competencyVerdicts(counted.slice(0, 3), [
      answer('a', false), answer('a', true), answer('b', true), answer('c', true),
    ]);
    expect(parking.correct).toBe(2);
  });
});
