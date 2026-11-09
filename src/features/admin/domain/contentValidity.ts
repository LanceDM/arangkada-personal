/**
 * The test items' content-validity evidence: the team's
 * two-member competency tagging, read as Cohen's κ, and the experts'
 * relevance ratings, read as the content validity index. Both are the team's
 * own ratings, imported from their sheet as CSV into `item_reviews/{kind}`.
 *
 * Raters are labels only (`R1`, `R2`; `E1`…`E10`), never names: the header is
 * refused otherwise. Nothing here is a Rasch estimate.
 *
 * - κ = (p_o − p_e) / (1 − p_e), p_e from each rater's own marginals
 *   (Cohen, 1960; McHugh, 2012).
 * - I-CVI: the share of experts rating an item 3 or 4 on the 4-point
 *   relevance scale. S-CVI/Ave is its mean over the items, S-CVI/UA the share
 *   of items every expert rated 3 or 4 (Polit & Beck, 2006).
 * - An item's I-CVI is acceptable at 1.00 with three to five experts and at
 *   0.78 or more with six or more (Lynn, 1986; Polit, Beck & Owen, 2007).
 *   Three experts is the fewest Lynn allows, ten the most she found useful.
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import { parseCsv } from './quizImport';

export type ItemReviewKind = 'tagging' | 'experts';

export interface TaggingRow {
  readonly itemId: string;
  /** One competency per rater, in the order of `raters`. */
  readonly tags: readonly string[];
}

export interface ExpertRow {
  readonly itemId: string;
  /** One rating 1–4 per expert, in the order of `raters`. */
  readonly ratings: readonly number[];
}

interface ReviewFrame<K extends ItemReviewKind> {
  readonly schemaVersion: 1;
  readonly kind: K;
  readonly raters: readonly string[];
  readonly revision: number;
  readonly updatedAt: number;
  /** The admin's account id. */
  readonly updatedBy: string;
}

export interface TaggingReviewDoc extends ReviewFrame<'tagging'> {
  readonly rows: readonly TaggingRow[];
}

export interface ExpertReviewDoc extends ReviewFrame<'experts'> {
  readonly rows: readonly ExpertRow[];
}

export const MIN_EXPERTS = 3;
export const MAX_EXPERTS = 10;
/** The rules hold a review to this many rows: the test is 60 items. */
export const MAX_REVIEW_ROWS = 100;

const RATER_LABEL: Record<ItemReviewKind, RegExp> = { tagging: /^R\d{1,2}$/, experts: /^E\d{1,2}$/ };

export interface ReviewRead<R> {
  readonly raters: string[];
  readonly rows: R[];
  readonly problems: string[];
}

const readSheet = <R>(
  kind: ItemReviewKind,
  csv: string,
  readCell: (text: string, where: string, problems: string[]) => R | null,
): { raters: string[]; rows: { itemId: string; cells: R[] }[]; problems: string[] } => {
  const [header = [], ...body] = parseCsv(csv).filter(r => r.some(cell => cell.trim() !== ''));
  const problems: string[] = [];
  const [first, ...raters] = header.map(cell => cell.trim());
  if (first?.toLowerCase() !== 'item_id') problems.push('The first column must be item_id.');
  const bad = raters.filter(r => !RATER_LABEL[kind].test(r));
  if (bad.length > 0) {
    problems.push(`Rater columns must be labels like ${kind === 'tagging' ? 'R1, R2' : 'E1, E2'}, never names: ${bad.join(', ')}.`);
  }
  if (new Set(raters).size !== raters.length) problems.push('A rater column appears twice.');
  const seen = new Set<string>();
  const rows = body.flatMap((cells, n) => {
    const itemId = (cells[0] ?? '').trim();
    if (!itemId) {
      problems.push(`Row ${n + 2} has no item_id.`);
      return [];
    }
    if (seen.has(itemId)) problems.push(`${itemId} appears twice.`);
    seen.add(itemId);
    const read = raters.map((rater, r) => readCell((cells[r + 1] ?? '').trim(), `${itemId}, ${rater}`, problems));
    return read.every((x): x is R => x !== null) ? [{ itemId, cells: read }] : [];
  });
  if (rows.length > MAX_REVIEW_ROWS) problems.push(`More than ${MAX_REVIEW_ROWS} rows.`);
  return { raters, rows, problems };
};

/** The tagging sheet: `item_id,R1,R2`, each cell a competency id. */
export const readTaggingSheet = (csv: string): ReviewRead<TaggingRow> => {
  const known = new Set<string>(COMPETENCIES);
  const sheet = readSheet('tagging', csv, (text, where, problems) => {
    if (known.has(text)) return text;
    problems.push(`${where}: "${text}" is not a competency.`);
    return null;
  });
  if (sheet.raters.length !== 2) sheet.problems.push('The tagging sheet has exactly two raters, R1 and R2.');
  return { raters: sheet.raters, rows: sheet.rows.map(r => ({ itemId: r.itemId, tags: r.cells })), problems: sheet.problems };
};

/** The experts' sheet: `item_id,E1,E2,…`, each cell a relevance rating 1–4. */
export const readExpertSheet = (csv: string): ReviewRead<ExpertRow> => {
  const sheet = readSheet('experts', csv, (text, where, problems) => {
    if (/^[1-4]$/.test(text)) return Number(text);
    problems.push(`${where}: "${text}" is not a rating from 1 to 4.`);
    return null;
  });
  if (sheet.raters.length < MIN_EXPERTS || sheet.raters.length > MAX_EXPERTS) {
    sheet.problems.push(`The experts' sheet has ${MIN_EXPERTS} to ${MAX_EXPERTS} experts, not ${sheet.raters.length}.`);
  }
  return { raters: sheet.raters, rows: sheet.rows.map(r => ({ itemId: r.itemId, ratings: r.cells })), problems: sheet.problems };
};

export interface KappaResult {
  readonly n: number;
  /** p_o, the share of items both raters tagged alike. */
  readonly agreement: number;
  /** p_e, the agreement expected from the raters' own marginals. */
  readonly expected: number;
  /** Null when p_e is 1: both raters used one tag throughout. */
  readonly kappa: number | null;
  readonly disagreements: readonly string[];
}

export const cohenKappa = (rows: readonly TaggingRow[]): KappaResult | null => {
  if (rows.length === 0) return null;
  const n = rows.length;
  const agree = rows.filter(r => r.tags[0] === r.tags[1]);
  const count = (rater: number, tag: string) => rows.filter(r => r.tags[rater] === tag).length;
  const tags = new Set(rows.flatMap(r => r.tags));
  const expected = [...tags].reduce((sum, tag) => sum + (count(0, tag) / n) * (count(1, tag) / n), 0);
  const agreement = agree.length / n;
  return {
    n,
    agreement,
    expected,
    kappa: expected === 1 ? null : (agreement - expected) / (1 - expected),
    disagreements: rows.filter(r => r.tags[0] !== r.tags[1]).map(r => r.itemId),
  };
};

export interface ItemCvi {
  readonly itemId: string;
  readonly iCvi: number;
  readonly acceptable: boolean;
}

export interface CviResult {
  readonly experts: number;
  /** The I-CVI an item needs at this many experts. */
  readonly cut: number;
  readonly items: readonly ItemCvi[];
  readonly sCviAve: number;
  readonly sCviUa: number;
}

export const iCviCut = (experts: number): number => (experts >= 6 ? 0.78 : 1);

export const contentValidityIndex = (rows: readonly ExpertRow[]): CviResult | null => {
  if (rows.length === 0) return null;
  const experts = rows[0].ratings.length;
  const cut = iCviCut(experts);
  const items = rows.map(r => {
    const iCvi = r.ratings.filter(x => x >= 3).length / r.ratings.length;
    return { itemId: r.itemId, iCvi, acceptable: iCvi >= cut - 1e-9 };
  });
  return {
    experts,
    cut,
    items,
    sCviAve: items.reduce((s, i) => s + i.iCvi, 0) / items.length,
    sCviUa: items.filter(i => i.iCvi === 1).length / items.length,
  };
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

const frameOf = (data: unknown, kind: ItemReviewKind) =>
  isObject(data) && data.schemaVersion === 1 && data.kind === kind && isStrings(data.raters) && Array.isArray(data.rows)
    && typeof data.revision === 'number' && typeof data.updatedAt === 'number' && typeof data.updatedBy === 'string';

export const readTaggingReview = (data: unknown): TaggingReviewDoc | null =>
  frameOf(data, 'tagging') && (data as { rows: unknown[] }).rows.every(r => isObject(r) && typeof r.itemId === 'string' && isStrings(r.tags))
    ? (data as TaggingReviewDoc)
    : null;

export const readExpertReview = (data: unknown): ExpertReviewDoc | null =>
  frameOf(data, 'experts') && (data as { rows: unknown[] }).rows.every(r =>
    isObject(r) && typeof r.itemId === 'string' && Array.isArray(r.ratings) && r.ratings.every(x => typeof x === 'number'))
    ? (data as ExpertReviewDoc)
    : null;

/** The next revision of a review: a whole document, one more than the stored one. */
export const nextReview = <D extends TaggingReviewDoc | ExpertReviewDoc>(
  kind: D['kind'],
  read: { raters: readonly string[]; rows: D['rows'] },
  stored: D | null,
  uid: string,
  at: number,
): D =>
  ({ schemaVersion: 1, kind, raters: [...read.raters], rows: read.rows, revision: (stored?.revision ?? 0) + 1, updatedAt: at, updatedBy: uid }) as unknown as D;
