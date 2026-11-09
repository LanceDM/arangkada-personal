// @vitest-environment jsdom
/**
 * The Q-learning mapping on screen, driven by its own hook over an in-memory
 * records repository, in Strict Mode: the table the game reads, said plainly
 * to be trained in simulation; its 36 states as a board of tiles, each read
 * out in its order; one Optimized participant's choices stepped over it; and
 * the pool's visits, Optimized participants only.
 */
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ROUTING_ACTIONS, ROUTING_Q_STATES } from '@/domain/learner/adaptive/routingQPolicy';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import { useQMapping, type QMappingSelection } from '@/features/admin/application/useQMapping';
import { qChoices, qPoolVisits } from '@/features/admin/domain/qMapping';
import { routingGraph } from '@/features/admin/domain/routingGraph';
import { QMappingSection } from './QMappingSection';
import { POOL, choose, click, clickLabel, designated, mount, repository, text, unmount, view } from './routingSections.fixture';

beforeAll(() => {
  provideAdminDependencies({ pilotRecords: repository } as unknown as AdminDependencies);
});
afterEach(unmount);

const graph = routingGraph();

const Harness = ({ initial }: { initial: QMappingSelection }) => {
  const [selection, setSelection] = useState(initial);
  return <QMappingSection q={useQMapping(true, selection, setSelection)} />;
};

const tiles = () => [...view().querySelectorAll<HTMLElement>('[data-tile]')];
const orderShown = () => [...view().querySelectorAll('[data-order-action]')].map(each => each.getAttribute('data-order-action'));
const marked = (mark: 'taken' | 'masked') => [...view().querySelectorAll(`[data-order-action][data-${mark}]`)].map(each => each.getAttribute('data-order-action'));

describe('the table', () => {
  it('says plainly that it was trained in simulation and is never retrained in the game', async () => {
    await mount(<Harness initial={{ view: 'table', code: null }} />);
    expect(text()).toContain('Trained in simulation, and never retrained in the game.');
    expect(text()).toContain('553a49a0');
    expect(text()).toContain('nothing in the game writes or updates it');
  });

  it("shows the policy's 36 states as tiles, each coloured by what its row tries first", async () => {
    await mount(<Harness initial={{ view: 'table', code: null }} />);
    expect(tiles().map(tile => tile.getAttribute('data-tile'))).toEqual(ROUTING_Q_STATES);
    expect(view().querySelectorAll('[data-tile][data-untrained]')).toHaveLength(8);
    for (const tile of tiles()) {
      const order = designated.table[tile.getAttribute('data-tile') as keyof typeof designated.table];
      expect(tile.getAttribute('data-first')).toBe(order[0] ?? 'plain');
    }
    // Every dimension in words, with the numbers its function decides on.
    for (const words of ['Levels 0–4', 'Levels 5–8', 'Levels 9–11', 'below 40', '40 to under 70', '70 or more', 'under 168 of 336 decisions spent']) {
      expect(text()).toContain(words);
    }
  });

  it("reads a tile's whole order out when it is clicked", async () => {
    await mount(<Harness initial={{ view: 'table', code: null }} />);
    for (const state of ROUTING_Q_STATES) {
      click(`[data-tile="${state}"]`);
      expect(view().querySelector('[data-tile][data-selected]')?.getAttribute('data-tile')).toBe(state);
      const order = designated.table[state];
      if (order.length === 0) expect(view().querySelector('[data-order-plain]')?.textContent).toContain('plain move');
      else expect(orderShown()).toEqual(order);
    }
    expect(ROUTING_ACTIONS).toHaveLength(4);
  });
});

describe("one Optimized participant's choices", () => {
  it('lists only the Optimized accounts', async () => {
    await mount(<Harness initial={{ view: 'participant', code: null }} />);
    const options = [...view().querySelectorAll('select[aria-label="Optimized account"] option')].map(option => option.getAttribute('value'));
    // In code order, as the records store holds the pool.
    expect(options).toEqual(['', 'E01B', 'P02']);
  });

  it('steps each choice over the board in order: the state read, the masked actions, the action taken', async () => {
    await mount(<Harness initial={{ view: 'participant', code: null }} />);
    await choose('Optimized account', 'P02');
    const { choices } = qChoices(POOL[1].attempts, designated, graph);
    expect(text()).toContain(`CHOICE 1 / ${choices.length}`);

    for (const [index, choice] of choices.entries()) {
      expect(view().querySelector('[data-tile][data-current]')?.getAttribute('data-tile')).toBe(choice.qState);
      expect(orderShown()).toEqual(choice.row);
      expect(marked('taken')).toEqual([choice.action ?? 'none']);
      expect(marked('masked')).toEqual(choice.row!.filter(action => choice.masked.includes(action)));
      // How many choices so far read this state.
      const sofar = choices.slice(0, index + 1).filter(each => each.qState === choice.qState).length;
      expect(view().querySelector(`[data-tile="${choice.qState}"]`)?.getAttribute('data-count')).toBe(String(sofar));
      expect(view().querySelector('a[aria-label^="Open attempt"]')?.getAttribute('href')).toBe(`/admin/replay?code=P02&attempt=${choice.attempt.id}`);
      if (index < choices.length - 1) clickLabel('Next choice');
    }
    // A review chosen where the weakest could not be practised.
    expect(choices.some(choice => choice.action === 'review' && choice.masked.includes('weakest'))).toBe(true);
    expect(text()).toContain('The table was not asked at');
    expect(view().querySelector('[role="alert"]')).toBeNull();
  });
});

describe("the pool's visits", () => {
  it('count the states read over Optimized participants of the study, test accounts left out', async () => {
    await mount(<Harness initial={{ view: 'pool', code: null }} />);
    const visits = qPoolVisits(
      POOL.map(entry => ({ code: entry.code, cohort: entry.cohort, group: entry.group, attempts: entry.attempts })),
      designated,
      graph
    );
    expect(visits.accounts).toBe(1);
    for (const state of ROUTING_Q_STATES) {
      expect(Number(view().querySelector(`[data-tile="${state}"]`)?.getAttribute('data-count'))).toBe(visits.byState[state].visits);
    }
    const busiest = ROUTING_Q_STATES.reduce((best, state) => (visits.byState[state].visits > visits.byState[best].visits ? state : best));
    click(`[data-tile="${busiest}"]`);
    expect(Number(view().querySelector('[data-read]')?.getAttribute('data-read'))).toBe(visits.byState[busiest].visits);
    expect(text()).not.toMatch(/accuracy|post-test score/i);
  });
});
