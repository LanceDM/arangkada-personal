// Unit tests for what may be lifted off its own level as practice
// (domain/scenario/remediationPool.ts). No React, no canvas.
import { describe, it, expect } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { isPortableRemediation, remediationCandidates } from './remediationPool';
import type { SlotVariant } from './pooling';
import { SLOTS as level0Slots } from '@/features/driving-sim/domain/scenario/content/levels/level0';
import { SLOTS as level1Slots } from '@/features/driving-sim/domain/scenario/content/levels/level1';
import { SLOTS as level2Slots } from '@/features/driving-sim/domain/scenario/content/levels/level2';
import { SLOTS as level3Slots } from '@/features/driving-sim/domain/scenario/content/levels/level3/pools';
import { SLOTS as level4Slots } from '@/features/driving-sim/domain/scenario/content/levels/level4/pools';
import { SLOTS as level5Slots } from '@/features/driving-sim/domain/scenario/content/levels/level5';
import { SLOTS as level6Slots } from '@/features/driving-sim/domain/scenario/content/levels/level6';
import { SLOTS as level7Slots } from '@/features/driving-sim/domain/scenario/content/levels/level7';
import { SLOTS as level8Slots } from '@/features/driving-sim/domain/scenario/content/levels/level8';
import { SLOTS as level9Slots } from '@/features/driving-sim/domain/scenario/content/levels/level9';
import { SLOTS as level10Slots } from '@/features/driving-sim/domain/scenario/content/levels/level10';
import { SLOTS as level11Slots } from '@/features/driving-sim/domain/scenario/content/levels/level11';
import { SLOTS as level12Slots } from '@/features/driving-sim/domain/scenario/content/levels/level12';

const makeVariant = (overrides: Partial<SlotVariant> = {}): SlotVariant => ({
  id: 'level0.slot.variant',
  type: 'scenario_trigger',
  description: 'A variant',
  correctAction: 'accelerate',
  points: 10,
  penaltyMessage: 'penalty',
  rewardMessage: 'reward',
  duration: 200,
  competency: 'lane_discipline',
  ...overrides,
});

const lane = (name: 'inner' | 'middle' | 'curb', strict = false) => ({
  lane: name,
  hint: 'hint',
  wrongLaneMessage: 'wrong lane',
  ...(strict ? { strict: true } : {}),
});

describe('isPortableRemediation', () => {
  it('admits a scenario graded from speed, lane and stopping alone', () => {
    expect(isPortableRemediation(makeVariant())).toBe(true);
    expect(isPortableRemediation(makeVariant({ requiredLane: lane('curb') }))).toBe(true);
    expect(isPortableRemediation(makeVariant({ requiredLane: lane('inner', true) }))).toBe(true);
  });

  it("refuses a scenario that stands on its own level's route", () => {
    expect(isPortableRemediation(makeVariant({ scene: 'route' }))).toBe(false);
  });

  it('refuses a scenario graded on the middle lane, which a two-lane side does not have', () => {
    expect(isPortableRemediation(makeVariant({ requiredLane: lane('middle') }))).toBe(false);
    expect(isPortableRemediation(makeVariant({ requiredLane: lane('middle', true) }))).toBe(false);
  });

  it('still admits a vehicle placed in the middle lane, because a placement is not a grade', () => {
    const lead = makeVariant({
      type: 'obstacle_ahead',
      correctAction: 'brake',
      competency: 'hazard_awareness',
      npc: {
        path: 'travelling_ahead',
        vehicleKind: 'van',
        label: 'the van',
        lane: 'middle',
        approachSpan: 1000,
        entryHeadway: 3.5,
        speed: { cruise: 0.62 },
      },
      following: { seconds: 2, tooCloseMessage: 'too close' },
    });
    expect(isPortableRemediation(lead)).toBe(true);
  });
});

describe('a prohibition on a turn the variant does not offer', () => {
  // A turn is committed only for the active event's own `maneuver`, so a
  // forbidden turn on a variant without one can never be taken, on any level:
  // the variant is passed by construction, as `neutral` is.
  const UNFAILABLE = [
    'level3.route-restriction.no-entry-all-vehicles',
    'level3.route-restriction.no-left-turn',
    'level3.route-restriction.no-right-turn',
    'level3.route-restriction.no-u-turn',
    'level3.route-restriction.no-entry-cars',
  ];

  it('is refused only where every forbidden act is a turn and no turn is offered', () => {
    expect(isPortableRemediation(makeVariant({ avoid: ['turn_left'] }))).toBe(false);
    expect(isPortableRemediation(makeVariant({ avoid: ['turn_right'] }))).toBe(false);
    expect(isPortableRemediation(makeVariant({ avoid: ['turn_left', 'turn_right'] }))).toBe(false);
    // Something else it forbids can still happen, so it can still be failed.
    expect(isPortableRemediation(makeVariant({ avoid: ['turn_left', 'brake'] }))).toBe(true);
    expect(isPortableRemediation(makeVariant({ avoid: ['stop'] }))).toBe(true);
  });

  it("refuses exactly Level 3's five, and nothing else in the game", () => {
    const everyVariant = [
      level0Slots, level1Slots, level2Slots, level3Slots, level4Slots, level5Slots, level6Slots,
      level7Slots, level8Slots, level9Slots, level10Slots, level11Slots, level12Slots,
    ].flatMap(slots => slots.flat());
    const refused = everyVariant
      .filter(variant => variant.avoid?.some(action => action === 'turn_left' || action === 'turn_right'))
      .filter(variant => !variant.maneuver)
      .map(variant => variant.id);
    expect(refused.sort()).toEqual([...UNFAILABLE].sort());
    for (const id of UNFAILABLE) {
      const variant = level3Slots.flat().find(candidate => candidate.id === id)!;
      expect(isPortableRemediation(variant), id).toBe(false);
    }
  });

  it('offers none of them as practice at any level', () => {
    for (let level = 1; level <= 11; level++) {
      const offered = COMPETENCIES.flatMap(competency => remediationCandidates(competency, level)).map(c => c.variant.id);
      expect(offered.filter(id => UNFAILABLE.includes(id)), `Level ${level}`).toEqual([]);
    }
    expect(remediationCandidates('road_signs', 11)).toHaveLength(38);
  });

  it("keeps all five in Level 3's own pool, where they stay open", () => {
    const own = new Set(level3Slots.flat().map(variant => variant.id));
    for (const id of UNFAILABLE) expect(own.has(id), id).toBe(true);
  });
});

describe('remediationCandidates', () => {
  const everyCandidate = () => COMPETENCIES.flatMap(competency => remediationCandidates(competency, 11));

  it('offers nothing that depends on the road it was written for', () => {
    const bound = everyCandidate()
      .filter(({ variant }) => variant.scene === 'route' || variant.requiredLane?.lane === 'middle')
      .map(({ variant }) => variant.id);
    expect(bound).toEqual([]);
  });

  it("offers Level 6's two places a car may not stand as parking practice from Level 6 on, and nowhere before", () => {
    // Step 3h. Graded from whether the car came to rest, with no bay,
    // no cutscene, no manoeuvre and nothing route-bound, so both can be played
    // on any road; `parkingPracticeDrive.test.ts` drives them there.
    const PARKING = ['level6.hydrant-at-the-curb', 'level6.tow-away-zone'];
    for (let level = 6; level <= 11; level++) {
      const offered = remediationCandidates('parking', level);
      expect(offered.map(({ variant }) => variant.id), `Level ${level}`).toEqual(PARKING);
      for (const { variant, levelId } of offered) {
        expect(levelId).toBe(6);
        expect(isPortableRemediation(variant)).toBe(true);
        expect(variant.avoid).toEqual(['stop']);
      }
    }
    for (let level = 1; level < 6; level++) expect(remediationCandidates('parking', level), `Level ${level}`).toEqual([]);
  });

  it('offers only the lead van from Level 7', () => {
    // Pinned rather than derived: each Level 7 variant was driven on the
    // levels it was being appended to, and this is the one that can still be
    // both passed and failed there. A new route-bound variant that slips the
    // filter shows up here first.
    const fromLevel7 = new Set(everyCandidate().filter(({ levelId }) => levelId === 7).map(({ variant }) => variant.id));
    expect([...fromLevel7]).toEqual(['level7.following-distance-lead-van']);
  });
});
