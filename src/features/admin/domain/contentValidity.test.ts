import { describe, expect, it } from 'vitest';
import {
  cohenKappa,
  contentValidityIndex,
  iCviCut,
  nextReview,
  readExpertReview,
  readExpertSheet,
  readTaggingReview,
  readTaggingSheet,
  type TaggingReviewDoc,
} from './contentValidity';

describe('the tagging sheet and Cohen’s κ', () => {
  it('reads two raters’ competency tags', () => {
    const read = readTaggingSheet('item_id,R1,R2\nA-1,road_signs,road_signs\nA-2,general_rules,road_signs\n');
    expect(read.problems).toEqual([]);
    expect(read.raters).toEqual(['R1', 'R2']);
    expect(read.rows).toEqual([
      { itemId: 'A-1', tags: ['road_signs', 'road_signs'] },
      { itemId: 'A-2', tags: ['general_rules', 'road_signs'] },
    ]);
  });

  it('refuses names for raters, unknown competencies, a third rater and a repeated item', () => {
    expect(readTaggingSheet('item_id,Ana,Ben\nA-1,road_signs,road_signs').problems.join(' ')).toMatch(/never names/);
    expect(readTaggingSheet('item_id,R1,R2\nA-1,signs,road_signs').problems.join(' ')).toMatch(/not a competency/);
    expect(readTaggingSheet('item_id,R1,R2,R3\nA-1,road_signs,road_signs,road_signs').problems.join(' ')).toMatch(/exactly two/);
    expect(readTaggingSheet('item_id,R1,R2\nA-1,road_signs,road_signs\nA-1,road_signs,road_signs').problems.join(' ')).toMatch(/twice/);
  });

  it('computes κ from the raters’ own marginals', () => {
    // 10 items, two tags: 4 a/a, 4 b/b, 1 a/b, 1 b/a. p_o .8, p_e .5, κ .6.
    const rows = [
      ...Array.from({ length: 4 }, (_, i) => ({ itemId: `a${i}`, tags: ['road_signs', 'road_signs'] })),
      ...Array.from({ length: 4 }, (_, i) => ({ itemId: `b${i}`, tags: ['general_rules', 'general_rules'] })),
      { itemId: 'x', tags: ['road_signs', 'general_rules'] },
      { itemId: 'y', tags: ['general_rules', 'road_signs'] },
    ];
    const k = cohenKappa(rows)!;
    expect(k.agreement).toBeCloseTo(0.8, 12);
    expect(k.expected).toBeCloseTo(0.5, 12);
    expect(k.kappa).toBeCloseTo(0.6, 12);
    expect(k.disagreements).toEqual(['x', 'y']);
    expect(cohenKappa([{ itemId: 'a', tags: ['road_signs', 'road_signs'] }])!.kappa).toBeNull();
    expect(cohenKappa([])).toBeNull();
  });
});

describe('the experts’ sheet and the CVI', () => {
  it('reads ratings 1–4 from three to ten experts', () => {
    const read = readExpertSheet('item_id,E1,E2,E3\nA-1,4,3,2\n');
    expect(read.problems).toEqual([]);
    expect(read.rows).toEqual([{ itemId: 'A-1', ratings: [4, 3, 2] }]);
    expect(readExpertSheet('item_id,E1,E2\nA-1,4,3').problems.join(' ')).toMatch(/3 to 10/);
    expect(readExpertSheet('item_id,E1,E2,E3\nA-1,4,5,3').problems.join(' ')).toMatch(/1 to 4/);
    expect(readExpertSheet('item_id,Dr X,E2,E3\nA-1,4,3,3').problems.join(' ')).toMatch(/never names/);
  });

  it('gives I-CVI, S-CVI/Ave and S-CVI/UA, with Lynn’s cut by panel size', () => {
    const cvi = contentValidityIndex([
      { itemId: 'A', ratings: [4, 4, 3] },
      { itemId: 'B', ratings: [4, 2, 3] },
    ])!;
    expect(cvi.cut).toBe(1);
    expect(cvi.items.map(i => [i.itemId, i.iCvi, i.acceptable])).toEqual([['A', 1, true], ['B', 2 / 3, false]]);
    expect(cvi.sCviAve).toBeCloseTo(5 / 6, 12);
    expect(cvi.sCviUa).toBe(0.5);
    expect(iCviCut(5)).toBe(1);
    expect(iCviCut(6)).toBe(0.78);
    const six = contentValidityIndex([{ itemId: 'C', ratings: [4, 4, 4, 4, 3, 1] }])!;
    expect(six.items[0].acceptable).toBe(true);
  });
});

describe('a stored review', () => {
  it('is the next revision, whole, and reads back', () => {
    const read = readTaggingSheet('item_id,R1,R2\nA-1,road_signs,road_signs');
    const first = nextReview<TaggingReviewDoc>('tagging', read, null, 'admin-1', 5);
    expect(first).toMatchObject({ schemaVersion: 1, kind: 'tagging', revision: 1, updatedBy: 'admin-1', raters: ['R1', 'R2'] });
    expect(nextReview<TaggingReviewDoc>('tagging', read, first, 'admin-1', 6).revision).toBe(2);
    expect(readTaggingReview(JSON.parse(JSON.stringify(first)))).toEqual(first);
    expect(readExpertReview(first)).toBeNull();
  });
});
