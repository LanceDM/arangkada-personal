/**
 * The pilot's post-test is one test: the final exam on one seed,
 * the same for every participant whatever they played, saw or got wrong.
 */
import { describe, expect, it } from 'vitest';
import { freeReplayLevel } from './courseRouting';
import { POST_TEST_LEVEL_ID, POST_TEST_SEED, postTestNote } from './pilotPostTest';

describe('the pilot post-test', () => {
  const played = (coverage: Parameters<typeof freeReplayLevel>[2]) =>
    freeReplayLevel(POST_TEST_LEVEL_ID, POST_TEST_SEED, coverage);

  it('is the final exam, with no hints', () => {
    const test = played({});
    expect(test.levelId).toBe(12);
    expect(test.support).toBe('none');
    expect(test.rolled.events).toHaveLength(8);
  });

  it('is the same eight scenarios, in the same order, whatever signs a browser has seen', () => {
    const fresh = played({});
    const seen = played({ 'No Entry': { seen: 9, correct: 2, wrong: 7, lastSeenAt: 1 }, Stop: { seen: 4, correct: 4, wrong: 0, lastSeenAt: 2 } });
    expect(seen.rolled.events.map(event => event.id)).toEqual(fresh.rolled.events.map(event => event.id));
    expect(seen.level).toEqual(fresh.level);
  });

  it('is worth 200, and its pass mark is 140', () => {
    const test = played({});
    expect(test.rolled.events.reduce((sum, event) => sum + event.points, 0)).toBe(200);
    expect(test.level.requiredScore).toBe(140);
  });

  it('tells the participant it is the same for everyone and changes nothing, never naming a group', () => {
    const text = JSON.stringify(postTestNote()).toLowerCase();
    expect(text).toContain('same final exam');
    expect(text).not.toMatch(/conventional|optimized|group/);
  });
});
