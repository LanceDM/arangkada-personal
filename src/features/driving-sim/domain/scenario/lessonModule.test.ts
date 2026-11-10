/**
 * The reading time the briefing and the reader show is the time to read what
 * the reader shows, and a lesson's badge is its own mark, never a second number.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_MODULE_DATA } from './content/lessons/lessonCatalog';
import { lessonTitleParts, moduleReadMinutes, type LevelModule } from './lessonModule';

const moduleOf = (blocks: LevelModule['lessons'][number]['blocks']): LevelModule => ({
  id: 'test',
  title: 'Test',
  desc: 'A short description that the estimate must not read.',
  lessons: [{ id: 'one', title: 'One', text: 'A summary the estimate must not read either.', blocks }],
});

const wordsOf = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

describe('the reading time', () => {
  it('counts every block the reader shows, at 180 words a minute', () => {
    const module = moduleOf([
      { type: 'heading', text: wordsOf(10) },
      { type: 'paragraph', text: wordsOf(200) },
      { type: 'list', ordered: false, items: [wordsOf(50), wordsOf(50)] },
      { type: 'table', headers: [wordsOf(5)], rows: [[wordsOf(45)]] },
      { type: 'image', alt: wordsOf(500), src: 'x.png' },
    ]);
    // 10 + 200 + 100 + 50 = 360 words: two minutes; the image's caption is not read text.
    expect(moduleReadMinutes(module)).toBe(2);
    expect(moduleReadMinutes(moduleOf([{ type: 'paragraph', text: wordsOf(361) }]))).toBe(3);
  });

  it("is the module's real length, well over the two minutes the briefing used to show", () => {
    const level3 = LEVEL_MODULE_DATA.find(module => module.sourceLevel === 3)!;
    expect(moduleReadMinutes(level3)).toBeGreaterThan(10);
  });
});

describe("a lesson title's own mark", () => {
  it('is split off a numbered or lettered title, and absent otherwise', () => {
    expect(lessonTitleParts('1. License Is Authority')).toEqual({ mark: '1', text: 'License Is Authority' });
    expect(lessonTitleParts('A. Regulatory Signs')).toEqual({ mark: 'A', text: 'Regulatory Signs' });
    expect(lessonTitleParts('10. Defensive Driving Method')).toEqual({ mark: '10', text: 'Defensive Driving Method' });
    expect(lessonTitleParts('Mission Briefing: Signs And Signals')).toEqual({
      mark: null,
      text: 'Mission Briefing: Signs And Signals',
    });
  });
});

describe("Level 0's module", () => {
  const level0 = LEVEL_MODULE_DATA.find(module => module.sourceLevel === 0)!;
  const lesson = (title: string) => level0.lessons.find(entry => entry.title === title)!;
  const tableRows = (title: string) =>
    lesson(title).blocks.flatMap(block => (block.type === 'table' ? block.rows : []));

  it('names only buttons the game has', () => {
    const buttons = tableRows('5. Basic Game Buttons').map(([button]) => button);
    expect(buttons).toEqual(['Open', 'Start', 'Drive', 'Continue driving', 'Back to Briefing', 'Previous', 'Retry Checkpoint', 'Continue', 'Back to Map']);
    expect(JSON.stringify(lesson('5. Basic Game Buttons'))).not.toMatch(/"(Next|Submit|Pause|Resume)"/);
  });

  it('teaches the touch buttons beside the keys, and the 5 km/h tap', () => {
    const controls = lesson('6. Basic Simulation Controls');
    const rows = tableRows('6. Basic Simulation Controls');
    expect(rows.map(([control]) => control)).toEqual(['Faster', 'Brake / Slow Down', 'Steer Left', 'Steer Right', 'Horn']);
    expect(rows.every(row => row.length === 4 && row[1].length > 0)).toBe(true);
    // The horn has no touch button; the lesson says so rather than naming one.
    expect(rows.find(([control]) => control === 'Horn')).toEqual(['Horn', 'No button (keyboard only)', 'H', 'Sounds the horn']);
    expect(JSON.stringify(controls)).not.toMatch(/Brake and Horn/);
    expect(JSON.stringify(controls)).toContain('5 km/h');
    expect(JSON.stringify(controls)).not.toContain('PC');
  });
});
