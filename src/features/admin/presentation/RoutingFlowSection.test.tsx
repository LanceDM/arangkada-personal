// @vitest-environment jsdom
/**
 * Routing flow on screen, driven by its own hook over an in-memory records
 * repository, in Strict Mode: the machine drawn from its table, one
 * participant's path stepped move by move with each move opening its attempt
 * in Replay, and the pool's moves per group. Nothing is read beyond the
 * records store's first read, and no score is shown.
 */
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import { flowAccountsOf, useRoutingFlow, type RoutingFlowSelection } from '@/features/admin/application/useRoutingFlow';
import { flowPath, poolFlow } from '@/features/admin/domain/routingFlow';
import { routingGraph } from '@/features/admin/domain/routingGraph';
import { RoutingFlowSection } from './RoutingFlowSection';
import { edgeShape, placeStops } from './routingBoardMap';
import { POOL, choose, click, clickLabel, mount, pressTab, reads, repository, text, unmount, view } from './routingSections.fixture';
import { routingLogOf } from '@/features/admin/domain/routingRecords.fixture';

beforeAll(() => {
  provideAdminDependencies({ pilotRecords: repository } as unknown as AdminDependencies);
});
afterEach(unmount);

const graph = routingGraph();
const stops = placeStops(graph);
const shapesOf = (kind: string) => graph.edges.filter(edge => edgeShape(edge, stops).kind === kind);

const Harness = ({ initial }: { initial: RoutingFlowSelection }) => {
  const [selection, setSelection] = useState(initial);
  return <RoutingFlowSection flow={useRoutingFlow(true, selection, setSelection)} />;
};

const accountOf = (code: string) => {
  const entry = POOL.find(each => each.code === code)!;
  return { code, cohort: entry.cohort, group: entry.group, attempts: entry.attempts, routingLog: routingLogOf(entry.attempts) };
};

describe('the machine', () => {
  it('is drawn from its own table: every stop, every road, the seven rows', async () => {
    await mount(<Harness initial={{ view: 'machine', code: null }} />);
    expect(view().querySelectorAll('[data-stop]')).toHaveLength(graph.stops.length);
    expect([...view().querySelectorAll('[data-road]')].map(road => road.getAttribute('data-road'))).toEqual(shapesOf('road').map(edge => edge.key));
    expect(view().querySelectorAll('[data-detour]')).toHaveLength(shapesOf('detour').length);
    expect([...view().querySelectorAll('[data-row]')].map(row => row.getAttribute('data-row'))).toEqual(graph.rows.map(row => row.row));
    for (const row of graph.rows) expect(text()).toContain(row.guard);
    // The detours can be hidden; the course road stays.
    click('input[type="checkbox"]');
    expect(view().querySelectorAll('[data-detour]')).toHaveLength(0);
    expect(view().querySelectorAll('[data-road]')).toHaveLength(shapesOf('road').length);
  });
});

describe("one participant's path", () => {
  it('steps the moves in order, on the board, each opening its attempt in Replay', async () => {
    await mount(<Harness initial={{ view: 'participant', code: null }} />);
    expect(text()).toContain('Choose a participant');
    await choose('Account', 'P02');
    const path = flowPath(accountOf('P02'), graph);
    expect(text()).toContain(`MOVE 1 / ${path.steps.length}`);
    expect(view().querySelector('[data-current]')?.getAttribute('data-stop')).toBe(path.steps[0].toStop);
    expect(view().querySelector('a[aria-label^="Open attempt"]')?.getAttribute('href')).toBe(
      `/admin/replay?code=P02&attempt=${path.steps[0].attempt!.id}`
    );

    // Step to the review: its detour rolls, and the lane's stop pulses.
    const review = path.steps.find(step => step.addOn?.kind === 'review')!;
    for (let i = 0; i < review.index; i++) clickLabel('Next move');
    expect(text()).toContain(`MOVE ${review.index + 1} / ${path.steps.length}`);
    expect(view().querySelector(`[data-detour="${review.edge}"]`)?.hasAttribute('data-active')).toBe(true);
    expect(view().querySelector('[data-current]')?.getAttribute('data-stop')).toBe('REVIEW(2)');
    expect(text()).toContain('Review of Level 2 for');

    // The attempts outside the machine are listed, not stepped to, and carry no verdict.
    const notes = [...view().querySelectorAll('[data-note]')];
    expect(notes.map(note => note.getAttribute('data-note'))).toEqual(['as-it-stands', 'outside', 'as-it-stands', 'outside']);
    expect(notes.some(note => note.textContent?.includes('Post-test: outside the machine'))).toBe(true);
    expect(text()).not.toMatch(/score|accuracy/i);
  });

  it('lights only what was travelled up to the move shown', async () => {
    await mount(<Harness initial={{ view: 'participant', code: 'P01' }} />);
    const path = flowPath(accountOf('P01'), graph);
    const firstAdvance = path.steps.find(step => step.row === 'advance')!;
    expect(view().querySelector(`[data-road="${firstAdvance.edge}"]`)?.hasAttribute('data-lit')).toBe(false);
    clickLabel('Last move');
    expect(view().querySelector(`[data-road="${firstAdvance.edge}"]`)?.hasAttribute('data-lit')).toBe(true);
    clickLabel('First move');
    expect(view().querySelector(`[data-road="${firstAdvance.edge}"]`)?.hasAttribute('data-lit')).toBe(false);
  });
});

describe("the pool's moves", () => {
  it('counts every move per group, participants only', async () => {
    reads.length = 0;
    await mount(<Harness initial={{ view: 'pool', code: null }} />);
    const pool = poolFlow(POOL.map(entry => accountOf(entry.code)), graph);
    const cell = (row: string, group: string) =>
      Number(view().querySelector(`[data-count-row="${row}"] [data-group="${group}"]`)?.textContent);
    for (const row of graph.rows) {
      for (const { group, counts } of pool.groups) expect(cell(row.row, group)).toBe(counts.byRow.find(entry => entry.row === row.row)!.count);
      expect(cell(row.row, 'all')).toBe(pool.all.byRow.find(entry => entry.row === row.row)!.count);
    }
    expect(cell('practice', 'conventional')).toBe(0);
    expect(cell('practice', 'optimized')).toBeGreaterThan(0);
    expect(cell('reviews', 'optimized')).toBe(1);
    expect(cell('participants', 'all')).toBe(2);
    expect(text()).toContain('1 dry-run or test account is left out');

    // The board follows the group chosen.
    click('[role="radio"][aria-checked="false"]');
    expect(view().querySelector('svg[aria-label$="Conventional"]')).not.toBeNull();
    expect(text().replace('never a score', '')).not.toMatch(/score|accuracy/i);
  });

  it('reads nothing beyond the records store, whichever tab is open', async () => {
    await mount(<Harness initial={{ view: 'pool', code: null }} />);
    const before = reads.length;
    await pressTab('The machine');
    await pressTab('One participant');
    await choose('Account', 'P02');
    await pressTab('Pool');
    expect(reads.length).toBe(before);
    expect(flowAccountsOf(null)).toEqual([]);
  });
});
