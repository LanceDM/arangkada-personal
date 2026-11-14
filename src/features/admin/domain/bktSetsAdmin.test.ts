import { describe, expect, it } from 'vitest';
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { NO_CALIBRATION } from '@/domain/learner/mastery/bktValueSets';
import { startEditRecord, startForNewPlayers } from './bktSetsAdmin';

describe('an edited start, as the admin saves it', () => {
  it('is logged against the set new players get now', () => {
    const models = new Map([['cal-1', { ...DEFAULT_BKT_MODEL, pInit: 0.25 }]]);
    const state = { activeSetId: 'cal-1', number: 1, appliedAt: 1, appliedBy: 'a' };
    expect(startForNewPlayers(NO_CALIBRATION, models)).toBe(0.3);
    expect(startForNewPlayers(state, models)).toBe(0.25);
    const record = startEditRecord({ state, models, start: 0.4, note: 'agreed', settingsVersion: 'v' });
    expect(record).toMatchObject({ kind: 'start', basedOn: 'cal-1', previousStart: 0.25, start: 0.4, pilots: [], note: 'agreed' });
    expect(record.model.pInit).toBe(0.4);
  });
});
