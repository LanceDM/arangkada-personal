import { describe, expect, it } from 'vitest';
import { difficultyFromProportion } from '@/domain/assessment/rasch';
import { bankCalibration } from './bankCalibration';

const sitting = (uid: string, timestamp: number, answers: [string, boolean][]) => ({
  uid,
  timestamp,
  responses: answers.map(([itemId, correct]) => ({ itemId, level: 5, chosen: correct ? 0 : 1, correct })),
});

describe('the bank calibration from mock exams', () => {
  it('counts each player once per item, on their first answer', () => {
    const result = bankCalibration(
      [
        sitting('u1', 2, [['L5-RW-01', true]]), // a later sitting: not counted for u1
        sitting('u1', 1, [['L5-RW-01', false]]),
        sitting('u2', 3, [['L5-RW-01', true], ['L5-RW-02', true]]),
      ],
      2
    );
    const item = result.items.find(i => i.itemId === 'L5-RW-01')!;
    expect(item).toMatchObject({ players: 2, correct: 1, p: 0.5, level: 5, calibrated: true });
    expect(item.b).toBeCloseTo(difficultyFromProportion(1, 2));
    expect(result).toMatchObject({ sittings: 3, players: 2, calibrated: 1, minPlayers: 2 });
  });

  it('reports no difficulty below the minimum, and skips sittings without per-item answers', () => {
    const result = bankCalibration([sitting('u1', 1, [['L1-DL-01', true]]), { uid: 'u2', timestamp: 2, responses: undefined }]);
    expect(result.items).toEqual([{ itemId: 'L1-DL-01', level: 5, players: 1, correct: 1, p: 1, b: null, calibrated: false }]);
    expect(result.sittings).toBe(1);
    expect(result.minPlayers).toBe(80);
  });
});
