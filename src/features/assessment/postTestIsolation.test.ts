import { describe, expect, it } from 'vitest';

/**
 * The post-test rewards nothing and is never BKT evidence. It is held to that by construction: the tests' feature
 * reaches neither the course, BKT, nor a Q-table, so nothing it does can write
 * or settle a Q update or a BKT update.
 */
const sources = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FORBIDDEN = [/competencyRouting/, /competencyCourse/, /courseSession/, /bktLog/, /evidenceBKT/, /qLog/, /q_tables/, /bktUpdates/, /courseLog/];

describe('the pre-test and post-test', () => {
  it('reach no course, BKT or Q-table code or path', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5);
    const offending = Object.entries(sources).flatMap(([path, text]) => FORBIDDEN.filter(re => re.test(text)).map(re => `${path}: ${re}`));
    expect(offending).toEqual([]);
  });
});
