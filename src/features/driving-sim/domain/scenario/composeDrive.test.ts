import { describe, expect, it } from 'vitest';
import { COMPETENCY_STAGES, STAGE_COMPETENCIES, DRIVE_ITEMS_PER_COMPETENCY } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';
import { composeDrive, itemsByCompetency } from './composeDrive';
import { allStageExtras } from './content/levels/stageExtras';
import { isPortableRemediation } from './remediationPool';

const SEEDS = [1, 2, 3];

describe('a drive composed from competency pools', () => {
  it('gives every competency the stage teaches exactly 3 scenarios, on every stage', () => {
    for (const stage of COMPETENCY_STAGES) {
      for (const seed of SEEDS) {
        const drive = composeDrive({ levelId: stage, competencies: STAGE_COMPETENCIES[stage], rng: createRng(seed) });
        expect(drive.shortfall, `L${stage} seed ${seed}`).toEqual({});
        const counted = itemsByCompetency(drive);
        for (const competency of STAGE_COMPETENCIES[stage]) {
          expect(counted.get(competency)?.length, `L${stage} ${competency}`).toBe(DRIVE_ITEMS_PER_COMPETENCY);
        }
      }
    }
  });

  it('never counts the same scenario twice', () => {
    for (const stage of COMPETENCY_STAGES) {
      const drive = composeDrive({ levelId: stage, competencies: STAGE_COMPETENCIES[stage], rng: createRng(7) });
      const ids = drive.items.map(item => item.scenarioId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('puts every counted scenario on the road or in the stage scene', () => {
    for (const stage of COMPETENCY_STAGES) {
      const drive = composeDrive({ levelId: stage, competencies: STAGE_COMPETENCIES[stage], rng: createRng(11) });
      const onRoad = new Set([
        ...drive.level.events.map(event => event.id),
        ...(drive.level.garage?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
        ...(drive.level.aftermath?.hotspots ?? []).map(point => point.scenarioId ?? point.id),
      ]);
      for (const item of drive.items) expect(onRoad.has(item.scenarioId), `${item.scenarioId} on L${stage}`).toBe(true);
    }
  });

  it('draws unseen scenarios on a repeat drive before any seen one', () => {
    for (const stage of COMPETENCY_STAGES) {
      for (const competency of STAGE_COMPETENCIES[stage]) {
        const first = composeDrive({ levelId: stage, competencies: [competency], rng: createRng(3) });
        const seen = new Map(first.items.map((item, index) => [item.scenarioId, index]));
        const repeat = composeDrive({ levelId: stage, competencies: [competency], seen, rng: createRng(4) });
        const repeated = repeat.items.filter(item => seen.has(item.scenarioId)).length;
        // How many distinct scenarios one drive could still place: a lower
        // bound on the pool, since a slot or point holds one at a time.
        const placeable = composeDrive({ levelId: stage, competencies: [competency], rng: createRng(5), perCompetency: 99 }).items.length;
        if (placeable >= 2 * DRIVE_ITEMS_PER_COMPETENCY) expect(repeated, `L${stage} ${competency}`).toBe(0);
        else expect(repeated, `L${stage} ${competency}`).toBeLessThanOrEqual(DRIVE_ITEMS_PER_COMPETENCY);
      }
    }
  });

  it('builds a repeat drive of only the competencies that are not done', () => {
    const drive = composeDrive({ levelId: 6, competencies: ['parking'], rng: createRng(1) });
    expect(new Set(drive.items.map(item => item.competency))).toEqual(new Set(['parking']));
    expect(drive.items).toHaveLength(3);
  });

  it('only ever appends scenarios that can travel', () => {
    for (const stage of COMPETENCY_STAGES) {
      const drive = composeDrive({ levelId: stage, competencies: STAGE_COMPETENCIES[stage], rng: createRng(13) });
      const appended = new Set(drive.items.filter(item => item.placement === 'appended').map(item => item.scenarioId));
      for (const event of drive.level.events.filter(event => appended.has(event.id))) {
        expect(isPortableRemediation(event as never), event.id).toBe(true);
      }
    }
  });
});

describe('the scenarios written for the pools and the spread (DRAFT)', () => {
  it('are all portable, tagged and cited', () => {
    for (const { variant } of allStageExtras()) {
      expect(isPortableRemediation(variant), variant.id).toBe(true);
      expect(variant.competency, variant.id).toBeTruthy();
      expect(variant.lawCitation, variant.id).toMatch(/module/i);
    }
  });
});

