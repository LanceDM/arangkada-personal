// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { levelConfigRows, scenarioConfigRows } from '@/features/driving-sim';
import { ScenariosSection } from './ScenariosSection';
import { choose, click, mount, text, unmount } from './adminSections.fixture';

afterEach(unmount);

describe('the scenarios page', () => {
  it('lists the levels and the scenarios, with their numbers', async () => {
    await mount(<ScenariosSection levels={levelConfigRows()} scenarios={scenarioConfigRows()} />);
    expect(text()).toContain('L0 Tutorial');
    expect(text()).toContain('level0.slow-zone');
    expect(text()).toContain('20 km/h or less by the time you reach it');
  });

  it('filters by level and opens a scenario', async () => {
    await mount(<ScenariosSection levels={levelConfigRows()} scenarios={scenarioConfigRows()} />);
    await choose('Level', '9');
    expect(text()).not.toContain('level0.slow-zone');
    expect(text()).toContain('level9.tire-blowout');
    click('tbody tr.cursor-pointer:last-of-type');
    expect(text()).toMatch(/The player reads:/);
  });
});
