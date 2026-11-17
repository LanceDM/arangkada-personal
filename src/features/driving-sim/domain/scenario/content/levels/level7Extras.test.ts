/**
 * Level 7's extra scenarios (2026-11-17): each
 * is drawn on the expressway from what it declares, and each cites only the
 * packs' own words.
 */
import { describe, expect, it } from 'vitest';
import { composeDrive, composeSingleScenario } from '@/features/driving-sim/domain/scenario/composeDrive';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';
import { STAGE_EXTRAS } from './stageExtras';

const NEW = [
  'level7.extra.driver-must-slow-down',
  'level7.extra.preferred-max-80',
  'level7.extra.tired-rest-area',
  'level7.extra.ambulance-behind',
  'level7.extra.faster-car-lane1',
];

describe("Level 7's extras from the expressway pack", () => {
  it('stand alone on the expressway, drawn from what they declare', () => {
    for (const id of NEW) {
      const single = composeSingleScenario(7, id)!;
      expect(single, id).not.toBeNull();
      const event = single.level.events.find(e => e.id === id)!;
      const segment = single.level.route!.segments.find(sg => sg.from <= event.triggerAtDistance - (event.warningDistance ?? 400) && event.triggerAtDistance + event.duration <= sg.to);
      expect(segment?.roadside, id).toBe('expressway');
      const nodes = composeWorldFrame({
        level: single.level,
        distance: event.triggerAtDistance - 200,
        handled: new Set(),
        curves: curvesForLevel(single.level),
      }).nodes;
      const kinds = new Set(nodes.map(node => node.kind));
      if (event.sign) {
        const sign = nodes.find(node => node.kind === 'sign' && node.plate.glyph === event.sign!.glyph);
        expect(sign, `${id}: its sign`).toBeDefined();
      }
      if (event.npc) expect(kinds.has('scripted-vehicle') || kinds.has('rear-view') || kinds.has('siren-alert'), `${id}: its vehicle`).toBe(true);
    }
  });

  it('give every topic Level 7 teaches 3 scenarios on every course draw', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const drive = composeDrive({ levelId: 7, competencies: STAGE_COMPETENCIES[7], rng: createRng(seed) });
      expect(drive.shortfall, `seed ${seed}`).toEqual({});
    }
  });

  it('cite the packs word for word, with no module paraphrase', () => {
    for (const variant of STAGE_EXTRAS[7].filter(v => NEW.includes(v.id))) {
      expect(variant.lawCitation, variant.id).toMatch(/^(FDM Vol\. 1)/);
      expect(variant.lawCitation, variant.id).not.toMatch(/module/i);
    }
  });
});
