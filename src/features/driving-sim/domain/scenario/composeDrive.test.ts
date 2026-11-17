import { describe, expect, it } from 'vitest';
import { COMPETENCY_STAGES, STAGE_COMPETENCIES, DRIVE_ITEMS_PER_COMPETENCY } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';
import { composeDrive, itemsByCompetency } from './composeDrive';
import { allStageExtras } from './content/levels/stageExtras';
import { isPortableRemediation } from './remediationPool';

const SEEDS = [1, 2, 3];

describe('a drive composed from competency pools', () => {
  // Where a stage's road can host fewer than 3 fitting scenarios (fitsRoad).
  // Level 7 was short in three topics until the expressway pack's scenarios
  // (2026-11-17). New content shrinks this list; nothing else may join it.
  const ROAD_FIT_SHORTFALL: Partial<Record<number, Record<string, number>>> = {};

  it('gives every competency the stage teaches 3 scenarios, short only where its road can host no more', () => {
    for (const stage of COMPETENCY_STAGES) {
      for (const seed of SEEDS) {
        const drive = composeDrive({ levelId: stage, competencies: STAGE_COMPETENCIES[stage], rng: createRng(seed) });
        const allowed = ROAD_FIT_SHORTFALL[stage] ?? {};
        expect(drive.shortfall, `L${stage} seed ${seed}`).toEqual(allowed);
        const counted = itemsByCompetency(drive);
        for (const competency of STAGE_COMPETENCIES[stage]) {
          expect(counted.get(competency)?.length ?? 0, `L${stage} ${competency}`).toBe(DRIVE_ITEMS_PER_COMPETENCY - (allowed[competency] ?? 0));
        }
      }
    }
  });

  it('borrows nothing from a city street onto the expressway', () => {
    for (const seed of SEEDS) {
      const drive = composeDrive({ levelId: 7, competencies: STAGE_COMPETENCIES[7], rng: createRng(seed) });
      expect(drive.items.filter(item => item.sourceLevelId !== 7)).toEqual([]);
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

  it("only ever appends scenarios that can travel, but for a stage's own extras on its own road", () => {
    for (const stage of COMPETENCY_STAGES) {
      const drive = composeDrive({ levelId: stage, competencies: STAGE_COMPETENCIES[stage], rng: createRng(13) });
      const appended = new Set(drive.items.filter(item => item.placement === 'appended' && item.sourceLevelId !== 7).map(item => item.scenarioId));
      for (const event of drive.level.events.filter(event => appended.has(event.id))) {
        expect(isPortableRemediation(event as never), event.id).toBe(true);
      }
    }
  });

  it("places Level 7's extras on the expressway, between the Lane 1 yield slot and the exit", () => {
    const exitOf = (level: { events: { id: string; triggerAtDistance: number }[] }) =>
      level.events.find(event => event.id === 'level7.check-brakes-reduce-speed')!.triggerAtDistance;
    for (const seed of [1, 2, 3, 4, 5]) {
      const drive = composeDrive({ levelId: 7, competencies: STAGE_COMPETENCIES[7], rng: createRng(seed) });
      const extras = drive.items.filter(item => item.placement === 'appended').map(item => item.scenarioId);
      expect(extras.length, `seed ${seed}`).toBeGreaterThan(0);
      const exit = exitOf(drive.level);
      const gore = drive.level.route!.fixtures!.find(f => f.fixture.kind === 'exit-gore')!.at;
      expect(gore).toBe(exit);
      const expressway = drive.level.route!.segments.find(segment => segment.roadside === 'expressway' && segment.to === exit)!;
      for (const id of extras) {
        const at = drive.level.events.find(event => event.id === id)!.triggerAtDistance;
        expect(at, id).toBeGreaterThan(7870);
        expect(at, id).toBeLessThan(exit - 1000);
        expect(at, id).toBeGreaterThan(expressway.from);
      }
    }
  });
});

describe('the scenarios written for the pools and the spread (DRAFT)', () => {
  it('are all tagged and cited, and portable but for Level 7, whose extras stay on its own road', () => {
    for (const { levelId, variant } of allStageExtras()) {
      if (levelId !== 7) expect(isPortableRemediation(variant), variant.id).toBe(true);
      expect(variant.competency, variant.id).toBeTruthy();
      expect(variant.lawCitation, variant.id).toMatch(/module|FDM Vol. 1/i);
    }
  });
});

