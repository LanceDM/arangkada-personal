// Unit tests for historyLogs (application/learnerHistory.ts) - specifically
// the ordering guarantee every sequential learner-model replay (BKT, the
// Q-learning practice selector's recent-performance bucket) depends on. No
// Firebase, no Zustand: these
// exercise `historyLogs` directly against hand-built `LearnerHistory` values,
// since the bug lives entirely in how attempts get flattened, not in where
// they came from.
import { describe, it, expect } from 'vitest';
import { historyLogs, type LearnerHistory } from './learnerHistory';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import type { ActionLog } from '@/domain/learner/attempt';

const log = (timestamp: number, result: ActionLog['result']): ActionLog => ({
  timestamp,
  action: 'brake',
  result,
  points: result === 'correct' ? 10 : -10,
  competency: 'road_signs',
});

describe('historyLogs', () => {
  it('sorts by each log\'s own timestamp, regardless of attempt order', () => {
    const history: LearnerHistory = {
      source: 'firestore',
      attempts: [
        // Firestore hands attempts back newest-first.
        { levelId: 2, timestamp: 200, logs: [log(200, 'correct')] },
        { levelId: 1, timestamp: 100, logs: [log(100, 'violation')] },
      ],
    };

    const logs = historyLogs(history);
    expect(logs.map(l => l.timestamp)).toEqual([100, 200]);
  });

  it('is a no-op when attempts already arrive oldest-first', () => {
    const history: LearnerHistory = {
      source: 'local',
      attempts: [
        { levelId: 1, logs: [log(100, 'correct'), log(150, 'correct')] },
        { levelId: 2, logs: [log(300, 'violation')] },
      ],
    };

    expect(historyLogs(history).map(l => l.timestamp)).toEqual([100, 150, 300]);
  });

  it('reproduces the bug this fixes: a naive attempt-order flatMap replays a signed-in player backwards', () => {
    // The exact case measured before the fix: three violations then three
    // corrections, saved as separate attempts and handed back newest-first -
    // which is what getMyLevelAttempts actually does.
    const oldAttempt: ActionLog[] = [log(1, 'violation'), log(2, 'violation'), log(3, 'violation')];
    const newAttempt: ActionLog[] = [log(4, 'correct'), log(5, 'correct'), log(6, 'correct')];

    const newestFirstFlatMap = [newAttempt, oldAttempt].flat();
    const fixed = historyLogs({
      source: 'firestore',
      attempts: [
        { levelId: 2, timestamp: 4, logs: newAttempt },
        { levelId: 1, timestamp: 1, logs: oldAttempt },
      ],
    });

    // The naive flatMap (what StoryMode used to do) reads recent success as
    // the earliest evidence and old struggle as the most recent - BKT settles
    // low. The fixed order reads it the way it actually happened - BKT
    // recovers high. Same six log entries; only the order differs.
    const naiveScore = buildBKTLearnerProfile(newestFirstFlatMap).road_signs.score;
    const fixedScore = buildBKTLearnerProfile(fixed).road_signs.score;

    expect(naiveScore).toBeLessThan(50);
    expect(fixedScore).toBeGreaterThan(90);
  });
});
