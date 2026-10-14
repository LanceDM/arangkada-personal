/**
 * The combinations a scenario may not declare.
 *
 * These are compile-time assertions. Each `@ts-expect-error` says "this must
 * not type-check"; if the constraint is ever loosened, `tsc` fails on the
 * unused directive, so the rule cannot rot without the build noticing. The
 * runtime body is only there to give the suite something to count.
 *
 * `npm run build` runs `tsc -b` over this file. `npm run test` does not
 * typecheck, so a green test run alone does not prove these still hold.
 */
import { describe, expect, it } from 'vitest';
import type { AuthoredEvent, CheckpointInspection } from './scenarioDefinition';
import type { PullOverBay } from './scenarioScene';

/** The fields every scenario carries, so each case below differs only in what it is testing. */
const base = {
  id: 'test.event',
  triggerAtDistance: 100,
  type: 'scenario_trigger',
  description: '',
  correctAction: 'brake',
  points: 10,
  penaltyMessage: '',
  rewardMessage: '',
  duration: 3000,
} as const;

const BAY: PullOverBay = { side: 'left', mayStop: true, hint: '' };

const INSPECTION: CheckpointInspection = {
  officerLine: '',
  documentType: '',
  holder: '',
  fields: [],
  vehicle: '',
  tripPurpose: '',
};

const SIGN = { name: '', category: '', meaning: '', art: 'octagon' } as const;
const MARKING = { name: '', category: '', meaning: '', art: 'stop_line' } as const;

// ── What a scenario may declare ─────────────────────────────────────────────

const realtime: AuthoredEvent = { ...base };
const inspection: AuthoredEvent = { ...base, inspection: INSPECTION };
const frozen: AuthoredEvent = { ...base, cutscene: true };
const emergency: AuthoredEvent = { ...base, cutscene: true, emergency: 'blowout' };
const parking: AuthoredEvent = { ...base, parkingCutscene: true, bay: BAY };
const signed: AuthoredEvent = { ...base, sign: SIGN, scene: 'intersection' };
const marked: AuthoredEvent = { ...base, marking: MARKING };

// ── What it may not ─────────────────────────────────────────────────────────

// A checkpoint stop and a parking cutscene are two different freezes.
// @ts-expect-error - inspection and parkingCutscene are different interactions
const bothFreezes: AuthoredEvent = { ...base, inspection: INSPECTION, parkingCutscene: true, bay: BAY };

// An emergency with nothing to freeze the road and ask never opens its prompt.
// @ts-expect-error - `emergency` needs the `cutscene` that asks it
const looseEmergency: AuthoredEvent = { ...base, emergency: 'blowout' };

// A parking technique with nowhere to park.
// @ts-expect-error - `parkingCutscene` needs a bay
const nowhereToPark: AuthoredEvent = { ...base, parkingCutscene: true };

// A sign is drawn beside the situation it governs; without one it is drawn nowhere.
// @ts-expect-error - a sign needs the scene it stands beside
const signWithoutScene: AuthoredEvent = { ...base, sign: SIGN };

// Two plates at once only splits the driver's attention.
// @ts-expect-error - a sign and a marking are alternatives
const bothPlates: AuthoredEvent = { ...base, sign: SIGN, scene: 'intersection', marking: MARKING };

describe('what a scenario may declare', () => {
  it('permits each interaction mode and scene source on its own', () => {
    expect([realtime, inspection, frozen, emergency, parking, signed, marked]).toHaveLength(7);
  });

  it('rejects the combinations above at compile time, not here', () => {
    // Present so the invalid cases are referenced; `tsc -b` is what checks them.
    expect([bothFreezes, looseEmergency, nowhereToPark, signWithoutScene, bothPlates]).toHaveLength(5);
  });
});
