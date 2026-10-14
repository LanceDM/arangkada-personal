/**
 * The routing record kept beside every signed-in attempt: what the
 * entry was, what the machine listed and took, the cursor either side, and the
 * log entries it added - JSON-safe, so Firestore stores it as written.
 */
import { describe, expect, it } from 'vitest';
import { driveState } from '@/domain/routing/routingTypes';
import { GAME_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import {
  enterCourseEntry,
  nextCourseEntry,
  settleCourseEntry,
  type RoutingCursor,
} from '@/features/driving-sim/domain/adaptive/courseRouting';
import { buildRoutingTelemetry, recordCourseEntry, recordFreeReplay } from './routingTelemetry';

const cursor: RoutingCursor = { state: driveState(3), outcome: 'passed', seq: 7, decisionsSpent: 60, pending: null };
const pending = nextCourseEntry({ cursor, group: 'conventional', history: [], attemptSeed: 0x5eed, coverage: {}, optimized: null });
const entry = enterCourseEntry(pending);
const settled = settleCourseEntry({ ...cursor, pending }, entry, 'failed', 9);

const doc = buildRoutingTelemetry({
  mode: 'new',
  assignedGroup: 'conventional',
  groupInEffect: 'conventional',
  override: false,
  options: GAME_OPTIONS,
  driving: { support: entry.support, approachScale: 1, weakAreaRoll: false, liveReroll: false, practicePolicy: null },
  entry: recordCourseEntry({ entry, before: { ...cursor, pending }, after: settled.cursor, outcome: 'failed', gradedDecisions: 9 }),
  log: settled.log,
  at: 1_000,
});

describe('the routing record', () => {
  it('holds the move, what was legal, and the cursor either side', () => {
    expect(doc.entry).toMatchObject({
      kind: 'course',
      levelId: 4,
      gradedDecisions: 9,
      outcome: 'failed',
      cursorBefore: { state: 'DRIVE(3)', outcome: 'passed', seq: 7, decisionsSpent: 60 },
      cursorAfter: { state: 'DRIVE(4)', outcome: 'failed', seq: 8, decisionsSpent: 69 },
      starts: 1,
      move: 'advance',
      destination: 4,
      item: null,
      review: null,
      decidedIn: 'conventional',
    });
    expect(doc.entry!.legal).toContain('advance');
    expect(doc.entry!.route).toEqual(entry.rolled.events.map(event => event.id));
  });

  it('numbers its log on from the cursor, and stamps when it was written', () => {
    expect(doc.log).toEqual([{ ...settled.log[0], seq: 7, at: 1_000 }]);
    expect(doc).toMatchObject({ truncated: false, totalCount: 1, schemaVersion: 1 });
  });

  it('is JSON-safe: what Firestore stores is what was built', () => {
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    const free = recordFreeReplay({ levelId: 2, route: ['a', 'b'], outcome: 'passed', gradedDecisions: 20 });
    expect(JSON.parse(JSON.stringify(free))).toEqual(free);
    expect(free).toMatchObject({ kind: 'free-replay', move: null, cursorBefore: null, observation: null });
  });
});
