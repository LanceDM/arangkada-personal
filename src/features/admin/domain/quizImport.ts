/**
 * The question bank sheet, saved as CSV, read into Short Quiz items.
 *
 * The sheet is the team's (`arangkada-question-bank.xlsx`): one row per item,
 * its Item ID the document id. Columns are found by their header, so their
 * order does not matter; Use and Explanation are read when the sheet has them.
 * Reviewer Notes are never read: quiz items are public.
 *
 * An import never deletes and never switches an item on or off. A row whose
 * item exists is written as its next revision when anything in it changed; a
 * sheet without a Use column leaves every existing item's use as it was, so
 * the 55 test items stay marked.
 */
import {
  LEVELS,
  QUIZ_ITEM_ID_PATTERN,
  quizFilipinoProblems,
  quizItemProblems,
  sameFilipino,
  settleFilipino,
  type QuizItemDoc,
  type QuizItemDraft,
  type QuizItemFilipino,
  type QuizItemUse,
} from '@/features/driving-sim';
import type { DrivingCompetency } from '@/domain/learner/competency';

/**
 * The sheet's eight Wikimedia links, each replaced by the picture already in
 * the game that shows the same sign (matched by the sign's DPWH code and
 * checked by eye, 2026-10-28). Nothing is downloaded: an item's picture is
 * always one of the curriculum's own files.
 */
export const SHEET_IMAGE_SUBSTITUTES: Readonly<Record<string, string>> = {
  'https://upload.wikimedia.org/wikipedia/commons/3/3b/Philippines_road_sign_R1-1.svg':
    '/arangkada_extracted_images/level3/stop-sign-octagon.png',
  'https://upload.wikimedia.org/wikipedia/commons/c/ca/Philippines_road_sign_R1-2.svg':
    '/arangkada_extracted_images/level3/give-way-yield-sign-inverted-triangle.png',
  'https://upload.wikimedia.org/wikipedia/commons/1/18/Philippines_road_sign_R3-1.svg':
    '/arangkada_extracted_images/level3/no-entry-all-vehicles.png',
  'https://upload.wikimedia.org/wikipedia/commons/1/14/Philippines_road_sign_R3-15.svg':
    '/arangkada_extracted_images/level3/no-u-turn.png',
  // The file shows the left and the right hairpin; the sheet's is the right.
  'https://upload.wikimedia.org/wikipedia/commons/d/db/Philippines_road_sign_W1-6_R.svg':
    '/arangkada_extracted_images/level3/hairpin-bend.png',
  'https://upload.wikimedia.org/wikipedia/commons/6/6e/Philippines_road_sign_R6-8.svg':
    '/arangkada_extracted_images/level3/be-aware-of-pedestrian-crossing.png',
  'https://upload.wikimedia.org/wikipedia/commons/1/17/Philippines_road_sign_R6-9.svg':
    '/arangkada_extracted_images/level3/be-aware-of-children-crossing.png',
  'https://upload.wikimedia.org/wikipedia/commons/e/e6/Philippines_road_sign_R6-11.svg':
    '/arangkada_extracted_images/level3/be-aware-of-pwd-crossing.png',
};

/** RFC 4180: commas, quoted fields with "" for a quote, line breaks inside quotes. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(cells => cells.some(cell => cell.trim() !== ''));
};

const REQUIRED_COLUMNS = [
  'Item ID',
  'Question',
  'Image',
  'Choice A',
  'Choice B',
  'Choice C',
  'Choice D',
  'Answer',
  'Competency',
  'Module/Stage',
  'Source',
] as const;
/** Read when the sheet has them. */
type OptionalColumn =
  | 'Use'
  | 'Explanation'
  | 'Question (Filipino)'
  | 'Choice A (Filipino)'
  | 'Choice B (Filipino)'
  | 'Choice C (Filipino)'
  | 'Choice D (Filipino)'
  | 'Explanation (Filipino)'
  | 'Filipino Status'
  | 'Translated By'
  | 'Reviewed By'
  | 'Reviewed On'
  | 'Guide';
type Column = (typeof REQUIRED_COLUMNS)[number] | OptionalColumn;

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** `L3` → Level 3's module id, from the level catalogue. */
const moduleIdOfStage = (stage: string): string | null => {
  const match = /^L(\d{1,2})$/.exec(stage.trim().toUpperCase());
  return match ? (LEVELS.find(level => level.id === Number(match[1]))?.moduleId ?? null) : null;
};

/** One sheet row, read: the item it describes, or why it cannot be imported. */
export interface SheetRow {
  /** The sheet's row number, counting the header as 1, as the sheet shows it. */
  line: number;
  id: string;
  /** Absent where `use` is left to the stored item: a sheet without a Use column. */
  draft: Omit<QuizItemDraft, 'isActive' | 'use'> & { use?: QuizItemUse };
  /** Absent on a sheet with no Filipino columns, which leaves the stored block as it was. */
  filipino?: QuizItemFilipino;
  problems: string[];
}

export interface SheetRead {
  rows: SheetRow[];
  /** Problems with the sheet as a whole: a missing column, nothing to read. */
  problems: string[];
}

export const readQuestionSheet = (csv: string): SheetRead => {
  const [header, ...body] = parseCsv(csv);
  if (!header) return { rows: [], problems: ['The file is empty.'] };
  const index = new Map(header.map((name, i) => [name.trim().toLowerCase(), i]));
  const missing = REQUIRED_COLUMNS.filter(name => !index.has(name.toLowerCase()));
  if (missing.length) return { rows: [], problems: [`The sheet has no ${missing.join(', ')} column.`] };
  const hasUse = index.has('use');
  // A sheet with no Filipino column leaves every stored Filipino as it was.
  const hasFilipino = index.has('question (filipino)');
  const cell = (cells: string[], column: Column) => (cells[index.get(column.toLowerCase()) ?? -1] ?? '').trim();

  const orderInModule = new Map<string, number>();
  const seen = new Set<string>();
  const rows = body.map((cells, i): SheetRow => {
    const problems: string[] = [];
    const id = cell(cells, 'Item ID');
    const stage = cell(cells, 'Module/Stage');
    const moduleId = moduleIdOfStage(stage) ?? '';
    if (!QUIZ_ITEM_ID_PATTERN.test(id)) problems.push(`"${id}" is not an Item ID like L1-DL-01.`);
    else if (!id.startsWith(`${stage.toUpperCase()}-`)) problems.push(`${id} is not a ${stage} item.`);
    if (seen.has(id)) problems.push(`${id} is in the sheet twice.`);
    seen.add(id);
    if (!moduleId) problems.push(`"${stage}" is not a level from L0 to L12.`);

    // Choices A to D, the blank ones last: a gap would move the answer's letter.
    const choices = LETTERS.map(letter => cell(cells, `Choice ${letter}`));
    const lastFilled = choices.reduce((last, choice, j) => (choice ? j : last), -1);
    if (choices.slice(0, lastFilled + 1).some(choice => !choice)) problems.push('A choice is blank between two others.');
    const options = choices.slice(0, lastFilled + 1);
    const answer = cell(cells, 'Answer').toUpperCase();
    const correctIndex = LETTERS.indexOf(answer as (typeof LETTERS)[number]);
    if (correctIndex < 0) problems.push(`The answer "${answer}" is not A, B, C or D.`);

    const sheetImage = cell(cells, 'Image');
    const image = SHEET_IMAGE_SUBSTITUTES[sheetImage] ?? sheetImage;
    const useText = cell(cells, 'Use').toLowerCase();
    let use: QuizItemUse | undefined;
    if (hasUse) {
      if (useText === '' || useText === 'quiz') use = 'quiz';
      else if (useText === 'test') use = 'test';
      else problems.push(`The use "${useText}" is not Quiz or Test.`);
    }
    const order = (orderInModule.get(moduleId) ?? 0) + 1;
    orderInModule.set(moduleId, order);

    const statusText = cell(cells, 'Filipino Status').toLowerCase();
    let fil: QuizItemFilipino | null = null;
    if (hasFilipino) {
      if (statusText !== '' && statusText !== 'draft' && statusText !== 'reviewed') problems.push(`The Filipino status "${statusText}" is not Draft or Reviewed.`);
      const optional = (key: 'translatedBy' | 'reviewedBy' | 'reviewedOn' | 'guide', column: OptionalColumn) => {
        const value = cell(cells, column);
        return value ? { [key]: value } : {};
      };
      fil = {
        question: cell(cells, 'Question (Filipino)'),
        options: options.map((_, j) => cell(cells, `Choice ${LETTERS[j]} (Filipino)` as OptionalColumn)),
        explanation: cell(cells, 'Explanation (Filipino)'),
        status: statusText === 'reviewed' ? 'reviewed' : 'draft',
        sourceText: '',
        ...optional('translatedBy', 'Translated By'),
        ...optional('reviewedBy', 'Reviewed By'),
        ...optional('reviewedOn', 'Reviewed On'),
        ...optional('guide', 'Guide'),
      };
      problems.push(...quizFilipinoProblems({ options, fil }));
    }

    const draft = {
      moduleId,
      question: cell(cells, 'Question'),
      options,
      correctIndex,
      explanation: cell(cells, 'Explanation'),
      image,
      competency: cell(cells, 'Competency') as DrivingCompetency,
      source: cell(cells, 'Source'),
      order,
      ...(use ? { use } : {}),
    };
    problems.push(...quizItemProblems({ ...draft, use: use ?? 'quiz', isActive: true }));
    return { line: i + 2, id, draft, ...(fil ? { filipino: fil } : {}), problems: [...new Set(problems)] };
  });
  return { rows, problems: rows.length ? [] : ['The sheet has no rows under its header.'] };
};

export type ImportStatus = 'new' | 'changed' | 'unchanged' | 'invalid';

export interface ImportRow {
  row: SheetRow;
  status: ImportStatus;
  /** What is written: absent for an unchanged or invalid row. */
  write?: QuizItemDoc;
}

const CONTENT_KEYS = [
  'moduleId',
  'question',
  'options',
  'correctIndex',
  'explanation',
  'image',
  'competency',
  'source',
  'use',
  'order',
] as const satisfies ReadonlyArray<keyof QuizItemDoc>;

const sameContent = (a: QuizItemDoc, b: QuizItemDoc) =>
  CONTENT_KEYS.every(key => JSON.stringify(a[key]) === JSON.stringify(b[key])) && sameFilipino(a.fil, b.fil);

/**
 * What an import would do, row by row, against the bank as it stands. A new
 * item is written switched on at revision 1; a changed one keeps its switch,
 * its creation time and, unless the sheet says otherwise, its use.
 */
export const planImport = (
  sheet: SheetRead,
  existing: readonly QuizItemDoc[],
  by: { uid: string; now: number }
): ImportRow[] => {
  const stored = new Map(existing.map(item => [item.id, item]));
  return sheet.rows.map(row => {
    const before = stored.get(row.id);
    if (before && row.draft.moduleId && before.moduleId !== row.draft.moduleId) {
      return { row: { ...row, problems: [...row.problems, `${row.id} is already an item of another level.`] }, status: 'invalid' };
    }
    if (row.problems.length) return { row, status: 'invalid' };
    const fil = row.filipino ? settleFilipino({ ...row.draft, fil: row.filipino }, before?.fil) : before?.fil;
    const item: QuizItemDoc = {
      schemaVersion: 1,
      id: row.id,
      ...row.draft,
      ...(fil ? { fil } : {}),
      use: row.draft.use ?? before?.use ?? 'quiz',
      isActive: before?.isActive ?? true,
      revision: before ? before.revision + 1 : 1,
      createdAt: before?.createdAt ?? by.now,
      updatedAt: by.now,
      updatedBy: by.uid,
    };
    if (!before) return { row, status: 'new', write: item };
    return sameContent(before, item) ? { row, status: 'unchanged' } : { row, status: 'changed', write: item };
  });
};
