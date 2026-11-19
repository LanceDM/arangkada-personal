// @vitest-environment jsdom
/**
 * `/admin/quiz` over an in-memory bank that keeps the rules' revision check:
 * a level's items listed and edited, never deleted; the sitting and pass mark
 * held to what the level serves; and the question bank sheet imported.
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizItemDoc, QuizModuleDoc } from '@/features/driving-sim';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import type { QuizEditorRepository } from '@/features/admin/application/quizPorts';
import { QuizEditorSection } from './QuizEditorSection';
import { choose, flush, mount, pressTab, text, unmount, view } from './adminSections.fixture';

/** A whole item, as the bank stores it. (Another feature's fixtures are out of reach.) */
const fixtureQuizItem = (moduleId: string, n: number): QuizItemDoc => ({
  schemaVersion: 1,
  id: `L1-GR-${String(n).padStart(2, '0')}`,
  moduleId,
  question: `Sample question ${n}?`,
  options: [`Right ${n}`, `Wrong ${n}a`, `Wrong ${n}b`],
  correctIndex: 0,
  explanation: '',
  image: '',
  competency: 'general_rules',
  source: 'Fixture',
  use: 'quiz',
  isActive: true,
  order: n,
  revision: 1,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'fixture',
});

let items: QuizItemDoc[];
let modules: QuizModuleDoc[];

/** Refuses what the rules refuse: a stale revision. */
const repository: QuizEditorRepository = {
  loadAll: async () => ({ items: items.map(item => ({ ...item })), modules: [...modules] }),
  saveItem: vi.fn(async (item: QuizItemDoc) => {
    const before = items.find(each => each.id === item.id);
    if (item.revision !== (before ? before.revision + 1 : 1)) throw new Error('Missing or insufficient permissions.');
    items = [...items.filter(each => each.id !== item.id), item];
  }),
  saveModule: vi.fn(async (settings: QuizModuleDoc) => {
    modules = [...modules.filter(each => each.moduleId !== settings.moduleId), settings];
  }),
  saveItems: vi.fn(async (writes: readonly QuizItemDoc[]) => {
    for (const item of writes) items = [...items.filter(each => each.id !== item.id), item];
  }),
};

beforeEach(() => {
  items = Array.from({ length: 7 }, (_, i) => fixtureQuizItem('lto_level_1', i + 1));
  modules = [];
  vi.clearAllMocks();
  provideAdminDependencies({ quizEditor: repository } as unknown as AdminDependencies);
});
afterEach(unmount);

const open = async () => {
  await mount(<QuizEditorSection uid="admin-1" />);
  await flush();
};

const button = (label: string, within: ParentNode = view()) =>
  [...within.querySelectorAll('button')].find(each => each.textContent?.trim() === label)!;
const press = async (element: HTMLElement) => {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await flush();
};
const field = (label: string) => view().querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
/** Types into a controlled field the way React hears it. */
const type = (label: string, value: string) =>
  act(() => {
    const element = field(label);
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
/** The item form's panel, and the settings panel: each has its own Save. */
const panelTitled = (start: string) =>
  [...view().querySelectorAll('section')].find(each => each.querySelector('h3')?.textContent?.startsWith(start))!;
const formSave = () => button('Save', panelTitled('Edit') ?? panelTitled('Add an item'));
const settingsSave = () => button('Save', panelTitled('Sitting and pass mark'));
const rowOf = (id: string) => [...view().querySelectorAll('li')].find(each => each.textContent?.includes(id))!;

describe('the items', () => {
  it("lists a level's items, with the rules for the study above them", async () => {
    await open();
    expect(text()).toContain('Edits stop once the first participant starts');
    expect(text()).toContain('Never enter an item of the 55-item pre-test and post-test');
    expect(text()).toContain('7 items, 7 quiz items switched on.');
    expect(text()).toContain('L1-GR-07');
  });

  it('edits an item as its next revision, stamped with the admin', async () => {
    await open();
    await press(button('Edit', rowOf('L1-GR-02')));
    expect(text()).toContain('Edit L1-GR-02 (revision 1)');
    type('Question', 'Which licence lets a paid driver drive?');
    expect(text()).toContain('Which licence lets a paid driver drive?');
    await press(formSave());
    expect(repository.saveItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'L1-GR-02', revision: 2, question: 'Which licence lets a paid driver drive?', updatedBy: 'admin-1' })
    );
    expect(text()).not.toContain('Edit L1-GR-02');
  });

  it('says why a refused read happens, never that a save was refused', async () => {
    const loadAll = repository.loadAll;
    repository.loadAll = async () => {
      throw new Error('Missing or insufficient permissions.');
    };
    try {
      await open();
      expect(text()).toContain("this project's deployed rules do not have quiz_items yet");
      expect(text()).not.toContain('refused the save');
    } finally {
      repository.loadAll = loadAll;
    }
  });

  it('says so when a save is refused, and keeps the form', async () => {
    await open();
    await press(button('Edit', rowOf('L1-GR-03')));
    // Someone else saves revision 2 meanwhile.
    items = items.map(item => (item.id === 'L1-GR-03' ? { ...item, revision: 2 } : item));
    type('Question', 'Stale edit?');
    await press(formSave());
    expect(text()).toContain('Someone may have changed this since it was read');
    expect(text()).toContain('Edit L1-GR-03');
  });

  it('will not save a new item until it is whole, with an ID for its level', async () => {
    await open();
    await press(button('Add item'));
    expect(text()).toContain('The question is empty.');
    expect(text()).toContain('The Item ID is not like L1-DL-01.');
    expect(formSave().disabled).toBe(true);

    type('Item ID', 'L2-GR-01');
    expect(text()).toContain('The Item ID must start with L1-.');
    type('Item ID', 'L1-GR-01');
    expect(text()).toContain('L1-GR-01 already exists.');
    type('Item ID', 'L1-GR-20');
    type('Question', 'A new question?');
    for (const [letter, words] of [['A', 'One'], ['B', 'Two'], ['C', 'Three'], ['D', 'Two']]) type(`Choice ${letter}`, words);
    expect(text()).toContain('Two choices are the same.');
    type('Choice D', 'Four');
    type('Source', 'FDM Vol. 1 (2021), Ch. I, p. 1');
    expect(formSave().disabled).toBe(false);
    await press(formSave());
    expect(repository.saveItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'L1-GR-20', revision: 1, isActive: true }));
  });

  it('switches an item off, but never below the pass mark', async () => {
    modules = [{ schemaVersion: 1, moduleId: 'lto_level_1', hasQuiz: true, itemsPerSitting: 7, passingScore: 6, revision: 1, updatedAt: 0, updatedBy: 'x' }];
    await open();
    await press(button('Switch off', rowOf('L1-GR-01')));
    expect(repository.saveItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'L1-GR-01', isActive: false, revision: 2 }));
    expect(text()).toContain('Switching this off leaves 5 quiz items, under the pass mark of 6.');
    expect(button('Switch off', rowOf('L1-GR-02')).disabled).toBe(true);
    expect(button('Switch on', rowOf('L1-GR-01')).disabled).toBe(false);
  });
});

describe('the sitting and pass mark', () => {
  it('holds the pass mark within the sitting and the sitting within the items switched on', async () => {
    await open();
    expect(text()).toContain('Not saved yet: the game plays 10 items, 6 to pass');
    expect(text()).toContain('A sitting asks 10 items, but only 7 are switched on.');
    type('Items per sitting', '7');
    type('Pass mark', '8');
    expect(text()).toContain('The pass mark is more than the items a sitting asks.');
    type('Pass mark', '5');
    await press(settingsSave());
    expect(repository.saveModule).toHaveBeenCalledWith(
      expect.objectContaining({ moduleId: 'lto_level_1', hasQuiz: true, itemsPerSitting: 7, passingScore: 5, revision: 1 })
    );
  });

  it('sets a level to have no quiz', async () => {
    await open();
    await choose('Level', '0');
    act(() => field('This level has a quiz').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();
    expect(text()).toContain("No quiz: this level's drive opens without a checkpoint.");
    await press(settingsSave());
    expect(repository.saveModule).toHaveBeenCalledWith(expect.objectContaining({ moduleId: 'lto_level_0', hasQuiz: false }));
  });
});

describe('the import', () => {
  const csv = [
    'Item ID,Question,Image,Choice A,Choice B,Choice C,Choice D,Answer,Competency,Module/Stage,Source,Reviewer Notes',
    'L3-RS-04,What does this sign mean?,https://upload.wikimedia.org/wikipedia/commons/1/14/Philippines_road_sign_R3-15.svg,No left turn,No U-turn,No right turn,Winding road ahead,B,road_signs,L3,"FDM Vol. 1 (2021), Ch. II/VI, pp. 63, 186",',
    'L3-RS-05,What does this sign warn of?,,A steep descent ahead,A U-turn slot ahead,A roundabout ahead,A hairpin bend ahead,Z,road_signs,L3,"FDM Vol. 1 (2021), Ch. II, p. 67",',
  ].join('\n');

  it('shows what it would do, then writes only the rows that can be imported', async () => {
    await open();
    await pressTab('Import');
    const input = view().querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([csv], 'bank.csv', { type: 'text/csv' });
    Object.defineProperty(input, 'files', { value: [file] });
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    await flush();

    expect(text()).toContain('bank.csv: 2 rows. 1 new, 0 changed, 0 unchanged, 1 cannot be imported.');
    expect(text()).toContain('Row 3 (L3-RS-05): The answer "Z" is not A, B, C or D.');
    expect(repository.saveItems).not.toHaveBeenCalled();

    await press(button('Import 1 items'));
    expect(repository.saveItems).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'L3-RS-04', image: '/arangkada_extracted_images/level3/no-u-turn.png', revision: 1, updatedBy: 'admin-1' }),
    ]);
    expect(text()).toContain('Imported 1 items.');
  });
});
