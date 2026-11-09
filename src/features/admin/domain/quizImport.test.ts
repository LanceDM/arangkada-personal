/**
 * The question bank sheet, saved as CSV, read into Short Quiz items.
 */
import { describe, expect, it } from 'vitest';
import { quizFilipinoState, STYLE_GUIDE_VERSION, type QuizItemDoc } from '@/features/driving-sim';
import { parseCsv, planImport, readQuestionSheet, SHEET_IMAGE_SUBSTITUTES } from './quizImport';

const HEADER =
  'Item ID,Question,Image,Choice A,Choice B,Choice C,Choice D,Answer,Competency,Module/Stage,Source,Reviewer Notes';

const sheet = (...rows: string[]) => [HEADER, ...rows].join('\r\n');

const ROW_1 =
  'L1-DL-04,Which DL code covers a passenger car (vehicle category M1)?,,A,B,B2,C,B,driver_legality,L1,"FDM Vol. 1 (2021), Ch. I, p. 5",';
const ROW_2 =
  'L3-RS-04,What does this sign mean?,https://upload.wikimedia.org/wikipedia/commons/1/14/Philippines_road_sign_R3-15.svg,No left turn,No U-turn,No right turn,Winding road ahead,B,road_signs,L3,"FDM Vol. 1 (2021), Ch. II/VI, pp. 63, 186","A note, for reviewers"';

describe('the CSV', () => {
  it('reads quoted fields with commas, quotes and line breaks', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi""","two\nlines"\r\nd,e,f,g\n')).toEqual([
      ['a', 'b, c', 'say "hi"', 'two\nlines'],
      ['d', 'e', 'f', 'g'],
    ]);
  });
});

describe('a sheet row', () => {
  it('becomes an item of its level, its answer letter the correct choice', () => {
    const { rows, problems } = readQuestionSheet(sheet(ROW_1));
    expect(problems).toEqual([]);
    expect(rows[0]).toMatchObject({
      line: 2,
      id: 'L1-DL-04',
      problems: [],
      draft: {
        moduleId: 'lto_level_1',
        options: ['A', 'B', 'B2', 'C'],
        correctIndex: 1,
        competency: 'driver_legality',
        source: 'FDM Vol. 1 (2021), Ch. I, p. 5',
        explanation: '',
        image: '',
        order: 1,
      },
    });
    expect(rows[0].draft).not.toHaveProperty('use');
  });

  it("takes the game's own picture for a Wikimedia sign, and never reads the reviewer notes", () => {
    const { rows } = readQuestionSheet(sheet(ROW_2));
    expect(rows[0].draft.image).toBe('/arangkada_extracted_images/level3/no-u-turn.png');
    expect(JSON.stringify(rows[0])).not.toContain('reviewers');
    expect(Object.keys(SHEET_IMAGE_SUBSTITUTES)).toHaveLength(8);
  });

  it('refuses a picture it has no file for, a wrong level, a bad answer, a duplicate', () => {
    const { rows } = readQuestionSheet(
      sheet(
        ROW_1.replace(',,A,', ',https://example.com/sign.png,A,'),
        ROW_1.replace(',L1,', ',L2,'),
        ROW_1.replace(',B,driver_legality', ',E,driver_legality'),
        ROW_1
      )
    );
    expect(rows[0].problems).toContain('A picture must be a file under /arangkada_extracted_images/.');
    expect(rows[1].problems).toContain('L1-DL-04 is not a L2 item.');
    expect(rows[2].problems).toContain('The answer "E" is not A, B, C or D.');
    expect(rows[3].problems).toContain('L1-DL-04 is in the sheet twice.');
  });

  it('reads a Use column when the sheet has one', () => {
    const csv = [`${HEADER},Use`, `${ROW_1},Test`].join('\n');
    expect(readQuestionSheet(csv).rows[0].draft.use).toBe('test');
  });

  it('names a missing column', () => {
    expect(readQuestionSheet('Item ID,Question\nL1-DL-01,Q').problems).toEqual([
      'The sheet has no Image, Choice A, Choice B, Choice C, Choice D, Answer, Competency, Module/Stage, Source column.',
    ]);
  });
});

describe('an import', () => {
  const by = { uid: 'admin-1', now: 5_000 };

  it('writes a new item switched on at revision 1', () => {
    const [entry] = planImport(readQuestionSheet(sheet(ROW_1)), [], by);
    expect(entry.status).toBe('new');
    expect(entry.write).toMatchObject({ id: 'L1-DL-04', revision: 1, isActive: true, use: 'quiz', createdAt: 5_000, updatedBy: 'admin-1' });
  });

  it("leaves an unchanged item alone, and writes a changed one as its next revision, keeping its switch and use", () => {
    const [created] = planImport(readQuestionSheet(sheet(ROW_1)), [], by);
    const stored: QuizItemDoc = { ...created.write!, revision: 3, isActive: false, use: 'test', createdAt: 100 };

    const [same] = planImport(readQuestionSheet(sheet(ROW_1)), [stored], by);
    expect(same.status).toBe('unchanged');
    expect(same.write).toBeUndefined();

    const [changed] = planImport(readQuestionSheet(sheet(ROW_1.replace('passenger car', 'private car'))), [stored], by);
    expect(changed.status).toBe('changed');
    expect(changed.write).toMatchObject({ revision: 4, isActive: false, use: 'test', createdAt: 100 });
  });

  it('never moves an item to another level', () => {
    const [created] = planImport(readQuestionSheet(sheet(ROW_1)), [], by);
    const stored: QuizItemDoc = { ...created.write!, moduleId: 'lto_level_2' };
    const [entry] = planImport(readQuestionSheet(sheet(ROW_1)), [stored], by);
    expect(entry.status).toBe('invalid');
    expect(entry.row.problems).toContain('L1-DL-04 is already an item of another level.');
  });
});

describe('the Filipino columns', () => {
  const FIL = 'Question (Filipino),Choice A (Filipino),Choice B (Filipino),Choice C (Filipino),Choice D (Filipino),Explanation (Filipino),Filipino Status,Translated By,Reviewed By,Reviewed On,Guide';
  const withFil = (cells: string) => sheet(ROW_1).replace(HEADER, `${HEADER},${FIL}`).replace(ROW_1, `${ROW_1},${cells}`);
  const REVIEWED = `XX q,XX a,XX b,XX c,XX d,,Reviewed,AB,CD,2026-11-09,${STYLE_GUIDE_VERSION}`;
  const by = { uid: 'admin', now: 5 };
  const one = (csv: string, existing: QuizItemDoc[] = []) => planImport(readQuestionSheet(csv), existing, by)[0];

  it('writes a reviewed block tied to the English in the row', () => {
    const planned = one(withFil(REVIEWED));
    expect(planned.status).toBe('new');
    expect(planned.write!.fil).toMatchObject({ question: 'XX q', options: ['XX a', 'XX b', 'XX c', 'XX d'], status: 'reviewed' });
    expect(quizFilipinoState(planned.write!)).toBe('reviewed');
  });

  it('marks a bad review invalid', () => {
    expect(one(withFil(REVIEWED.replace('CD', 'AB'))).status).toBe('invalid');
    expect(one(withFil(REVIEWED.replace('Reviewed', 'Done'))).status).toBe('invalid');
    expect(one(withFil(REVIEWED.replace('XX q', ''))).status).toBe('invalid');
  });

  it('leaves stored Filipino alone on a sheet with no Filipino columns', () => {
    const stored = one(withFil(REVIEWED)).write!;
    const again = one(sheet(ROW_1), [stored]);
    expect(again.status).toBe('unchanged');
  });

  it('sees no change in a row that says what is stored, and a change where it differs', () => {
    const stored = one(withFil(REVIEWED)).write!;
    expect(one(withFil(REVIEWED), [stored]).status).toBe('unchanged');
    expect(one(withFil(REVIEWED.replace('XX q', 'XX r')), [stored]).status).toBe('changed');
  });
});
