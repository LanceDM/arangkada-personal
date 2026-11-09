import { describe, expect, it } from 'vitest';
import { transitionId } from '@/domain/routing/routingTypes';
import { participantExport, type StoredAttempt } from '@/features/driving-sim';
import { routingGraph } from './routingGraph';
import { flowPath, poolFlow, type FlowAccount } from './routingFlow';
import { playCourse, routingLogOf, type FixtureEntry } from './routingRecords.fixture';
import { designatedRoutingPolicyOf } from './designatedRoutingPolicy';
import results from './designatedRoutingTable.json';

const graph = routingGraph();
const designated = designatedRoutingPolicyOf(results);

/** A course: a failed tutorial and its retry, practice offered, a review offered, a free replay and the post-test. */
const COURSE: FixtureEntry[] = [
  { outcome: 'failed' },
  { outcome: 'passed' },
  { outcome: 'passed', probe: 'open' },
  { outcome: 'failed', probe: 'open' },
  { outcome: 'passed', probe: 'open' },
  { outcome: 'passed', probe: 'gap' },
  { outside: 'free-replay', outcome: 'passed' },
  { outcome: 'passed' },
  { outside: 'post-test', outcome: 'failed' },
];

const account = (code: string, group: 'conventional' | 'optimized', attempts: StoredAttempt[], cohort: FlowAccount['cohort'] = 'study'): FlowAccount => ({
  code,
  cohort,
  group,
  attempts,
  routingLog: routingLogOf(attempts),
});

const course = (group: 'conventional' | 'optimized', entries = COURSE, idPrefix = 'a') =>
  playCourse({ group, entries, table: designated.table, tableId: designated.tableId, budgetSize: designated.budgetSize, idPrefix });

describe("one account's path", () => {
  it('is the machine\'s log, move for move, each tied to the attempt that logged it', () => {
    const attempts = course('optimized');
    const path = flowPath(account('P02', 'optimized', attempts), graph);
    const log = routingLogOf(attempts);
    expect(path.steps.map(step => [step.seq, step.move])).toEqual(log.map(record => [record.seq, transitionId(record.transition)]));
    expect(path.unknown).toBe(0);
    expect(path.start).toBe('DRIVE(0)');
    for (const step of path.steps) {
      expect(step.row).toBe(graph.rowOf(step.from, step.move));
      expect(attempts.find(stored => stored.id === step.attempt?.id)?.routing?.log.some(record => record.seq === step.seq)).toBe(true);
    }
  });

  it('names what each move added, and which moves ended their attempt', () => {
    const attempts = course('optimized');
    const { steps } = flowPath(account('P02', 'optimized', attempts), graph);
    const practice = steps.filter(step => step.addOn?.kind === 'practice');
    expect(practice.length).toBeGreaterThan(0);
    for (const step of practice) {
      expect(step.entered).toBe(true);
      expect(step.addOn).toMatchObject({ kind: 'practice', item: { sourceLevelId: 1 } });
    }
    const review = steps.find(step => step.addOn?.kind === 'review')!;
    expect(review).toMatchObject({ row: 'review', fromStop: 'DRIVE(2)', toStop: 'REVIEW(2)', entered: true });
    const back = steps.find(step => step.move === 'return')!;
    expect(back).toMatchObject({ row: 'return', fromStop: 'REVIEW(2)', toStop: 'DRIVE(3)', entered: false });
    expect(back.attempt?.id).toBe(review.attempt?.id);
    expect(steps.find(step => step.row === 'retry' && step.fromStop === 'DRIVE(0)')?.outcome).toBe('failed');
  });

  it('lists the attempts outside the machine and those played as they stood, never as moves', () => {
    const notesOf = (group: 'conventional' | 'optimized') => {
      const path = flowPath(account('P01', group, course(group)), graph);
      expect(path.timeline.filter(item => item.type === 'step')).toHaveLength(path.steps.length);
      return path.timeline.flatMap(item => (item.type === 'note' ? [item.note] : []));
    };
    // Only the review's return leaves a frontier to be played as it stands.
    expect(notesOf('conventional').map(note => [note.kind, note.attempt.number])).toEqual([
      ['as-it-stands', 1],
      ['outside', 7],
      ['outside', 9],
    ]);
    const notes = notesOf('optimized');
    expect(notes.map(note => [note.kind, note.attempt.number])).toEqual([
      ['as-it-stands', 1],
      ['outside', 7],
      ['as-it-stands', 8],
      ['outside', 9],
    ]);
    expect(JSON.stringify(notes)).not.toMatch(/outcome|score|passed|failed/);
  });

  it('reads the export\'s own log the same as the attempts\' entries', () => {
    const attempts = course('optimized');
    const exported = participantExport({ uid: 'u2', participant: { code: 'P02', cohort: 'study' }, assignment: null, cursor: null, attempts, examSittings: [], dailyAnswers: [] });
    const fromExport = flowPath({ ...account('P02', 'optimized', attempts), routingLog: exported.routingLog }, graph);
    const copied = flowPath({ ...account('P02', 'optimized', attempts), routingLog: exported.routingLog.map(record => ({ ...record })) }, graph);
    expect(fromExport.steps).toEqual(flowPath(account('P02', 'optimized', attempts), graph).steps);
    expect(copied.steps).toEqual(fromExport.steps);
  });

  it('runs a whole course to the final exam and certification', () => {
    // The tutorial, eleven advances, the final exam failed once, then passed.
    const passes: FixtureEntry[] = Array.from({ length: 12 }, () => ({ outcome: 'passed' as const }));
    const attempts = course('conventional', [...passes, { outcome: 'failed' }, { outcome: 'passed' }]);
    const { steps } = flowPath(account('P03', 'conventional', attempts), graph);
    const rows = steps.map(step => step.row);
    expect(rows.filter(row => row === 'advance')).toHaveLength(11);
    expect(rows.slice(-3)).toEqual(['to final', 'retry the final', 'certify']);
    expect(steps.at(-1)).toMatchObject({ fromStop: 'FINAL', toStop: 'CERTIFIED', entered: false });
  });
});

describe("the pool's moves", () => {
  const accounts = [
    account('P01', 'conventional', course('conventional', COURSE, 'c')),
    account('P02', 'optimized', course('optimized', COURSE, 'o')),
    account('E01A', 'optimized', course('optimized', COURSE, 'e'), 'test'),
  ];
  const pool = poolFlow(accounts, graph);

  it('counts every move per group, and leaves the dry run and test accounts out', () => {
    expect(pool.groups.map(entry => entry.group)).toEqual(['conventional', 'optimized']);
    expect(pool.othersLeftOut).toBe(1);
    const [conventional, optimized] = pool.groups.map(entry => entry.counts);
    expect(conventional.accounts).toBe(1);
    expect(conventional.moves).toBe(flowPath(accounts[0], graph).steps.length);
    expect(conventional.practice + conventional.reviews).toBe(0);
    expect(optimized.practice).toBeGreaterThan(0);
    expect(optimized.reviews).toBe(1);
    expect(optimized.reviewsBy).toEqual([{ level: 2, competency: 'lane_discipline', count: 1 }]);
    expect(pool.all.moves).toBe(conventional.moves + optimized.moves);
  });

  it('keeps every row and competency, and every count adds up', () => {
    for (const { counts } of pool.groups) {
      expect(counts.byRow.map(entry => entry.row)).toEqual(graph.rows.map(row => row.row));
      expect(counts.byRow.reduce((sum, entry) => sum + entry.count, 0)).toBe(counts.moves);
      expect(counts.plain + counts.practice + counts.reviews).toBe(counts.moves);
      expect(counts.practiceBy.reduce((sum, entry) => sum + entry.count, 0)).toBe(counts.practice);
      expect(Object.values(counts.edges).reduce((sum, count) => sum + count, 0)).toBe(counts.moves);
      for (const key of Object.keys(counts.edges)) expect(graph.edges.some(edge => edge.key === key)).toBe(true);
    }
  });

  it('shows an unassigned column only when an account has no group', () => {
    const withUnassigned = poolFlow([...accounts, { ...account('P04', 'conventional', []), group: null }], graph);
    expect(withUnassigned.groups.map(entry => entry.group)).toEqual(['conventional', 'optimized', 'unassigned']);
  });

  it('carries no score', () => {
    expect(JSON.stringify(pool)).not.toMatch(/score|accuracy|postTest/i);
  });
});
