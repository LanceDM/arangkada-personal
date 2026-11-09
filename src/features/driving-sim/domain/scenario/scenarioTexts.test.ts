import { describe, expect, it } from 'vitest';
import { FILIPINO_CATALOGUE } from './content/fil/filipinoCatalogue';
import type { Lesson, LevelModule } from './lessonModule';
import type { LevelConfig, ScenarioEvent } from './scenarioDefinition';
import { scenarioRoster } from './scenarioRoster';
import {
  DRAFT_MARK,
  entryProblem,
  LESSON_TEXT_PATHS,
  levelKey,
  LEVEL_TEXT_PATHS,
  localizeLevel,
  localizeLevelName,
  localizeModule,
  plateKey,
  scenarioFingerprint,
  SCENARIO_TEXT_PATHS,
  textsOf,
  type TranslationEntry,
} from './scenarioTexts';

const event = {
  id: 'level9.test',
  description: 'A sign ahead.',
  question: 'What now?',
  choices: [
    { label: 'Stop', action: 'stop' },
    { label: 'Go', action: 'accelerate' },
  ],
  correctAction: 'stop',
  penaltyMessage: 'Wrong.',
  rewardMessage: 'Right.',
  sign: { name: 'STOP sign', category: 'Regulatory', meaning: 'Stop here.', art: 'stop' },
} as unknown as ScenarioEvent;

const level = { id: 9, events: [event] } as unknown as LevelConfig;
const texts = textsOf(event, SCENARIO_TEXT_PATHS);
const fil = Object.fromEntries(Object.keys(texts).map(path => [path, `XX ${texts[path]}`]));
const entry = (over: Partial<TranslationEntry> = {}): TranslationEntry => ({
  source: scenarioFingerprint(texts),
  status: 'reviewed',
  reviewedBy: 'tester',
  reviewedOn: '2026-11-08',
  guide: 'fil-style-1',
  fil,
  ...over,
});
const shown = (over: Partial<TranslationEntry> = {}, showDrafts = false) =>
  localizeLevel(level, 'fil', { [event.id]: entry(over) }, { showDrafts }).events[0];

describe('a scenario in the language chosen', () => {
  it('is the same object in English, so an English run is what it always was', () => {
    expect(localizeLevel(level, 'en', { [event.id]: entry() }, { showDrafts: true })).toBe(level);
  });

  it('shows a reviewed entry, field by field, leaving the graded answer and the choice actions alone', () => {
    const out = shown();
    expect(out.description).toBe('XX A sign ahead.');
    expect(out.choices!.map(choice => choice.label)).toEqual(['XX Stop', 'XX Go']);
    expect(out.choices!.map(choice => choice.action)).toEqual(['stop', 'accelerate']);
    expect(out.correctAction).toBe('stop');
    expect(out.id).toBe(event.id);
    expect(event.description).toBe('A sign ahead.');
  });

  it('keeps a whole scenario in English when any field has no Filipino, in every build', () => {
    const missing = { ...fil };
    delete missing['choices.1.label'];
    expect(shown({ fil: missing })).toBe(event);
    expect(shown({ fil: missing }, true)).toBe(event);
    expect(shown({ fil: { ...fil, description: '  ' } }, true)).toBe(event);
  });

  it('shows a draft only in a development build, marked', () => {
    expect(shown({ status: 'draft' })).toBe(event);
    expect(shown({ status: 'draft' }, true).description).toBe(`${DRAFT_MARK}XX A sign ahead.`);
  });

  it('counts an entry as stale when its English changed, however it was reviewed', () => {
    expect(entryProblem(texts, entry({ source: 'old' }))).toBe('stale');
    expect(shown({ source: 'old' })).toBe(event);
    expect(shown({ source: 'old' }, true).description).toBe(`${DRAFT_MARK}XX A sign ahead.`);
    expect(entryProblem({ ...texts, description: 'A different sign.' }, entry())).toBe('stale');
  });

  it('files a translated plate under its English name, so sign coverage does not split by language', () => {
    const plate = shown().sign!;
    expect(plate.name).toBe('XX STOP sign');
    expect(plateKey(plate)).toBe('STOP sign');
    expect(plateKey(event.sign!)).toBe('STOP sign');
  });
});

const translated = (texts: Record<string, string>): TranslationEntry => ({
  source: scenarioFingerprint(texts),
  status: 'reviewed',
  fil: Object.fromEntries(Object.keys(texts).map(path => [path, `XX ${texts[path]}`])),
});

describe('a lesson in the language chosen', () => {
  const lesson = {
    id: 'level-9-one',
    title: '1. Signs',
    text: 'A summary.',
    blocks: [
      { type: 'heading', text: 'A heading' },
      { type: 'list', ordered: false, items: ['One', 'Two'] },
      { type: 'table', headers: ['Sign'], rows: [['Stop'], ['Yield']] },
      { type: 'image', alt: 'A stop sign', src: 'level9/stop.png' },
    ],
  } as Lesson;
  const other = { id: 'level-9-two', title: '2. Lines', text: 'Another.', blocks: [] } as Lesson;
  const module: LevelModule = { id: 'lto_level_9', title: 'Module', desc: 'About it.', sourceLevel: 9, lessons: [lesson, other] };
  const options = { showDrafts: false };

  it('is the same object in English', () => {
    expect(localizeModule(module, 'en', {}, options)).toBe(module);
  });

  it('reaches every text in a lesson and keeps its pictures', () => {
    const entry = translated(textsOf(lesson, LESSON_TEXT_PATHS));
    const [shown] = localizeModule(module, 'fil', { [lesson.id]: entry }, options).lessons;
    expect(shown.title).toBe('XX 1. Signs');
    expect(shown.blocks).toEqual([
      { type: 'heading', text: 'XX A heading' },
      { type: 'list', ordered: false, items: ['XX One', 'XX Two'] },
      { type: 'table', headers: ['XX Sign'], rows: [['XX Stop'], ['XX Yield']] },
      { type: 'image', alt: 'XX A stop sign', src: 'level9/stop.png' },
    ]);
  });

  it('keeps each lesson whole: one translated beside one that is not', () => {
    const entry = translated(textsOf(lesson, LESSON_TEXT_PATHS));
    const { lessons } = localizeModule(module, 'fil', { [lesson.id]: entry }, options);
    expect(lessons[0].text).toBe('XX A summary.');
    expect(lessons[1]).toBe(other);
    const partial = { ...entry, fil: { ...entry.fil, 'blocks.2.rows.1.0': '' } };
    expect(localizeModule(module, 'fil', { [lesson.id]: partial }, options).lessons[0]).toBe(lesson);
  });

  it('names a level in the language chosen, with its events and rules untouched', () => {
    const heading = { id: 9, name: 'Signs', description: 'About signs.' };
    const entry = translated(textsOf(heading, LEVEL_TEXT_PATHS));
    expect(localizeLevelName(heading, 'fil', { [levelKey(9)]: entry }, options)).toBe('XX Signs');
    expect(localizeLevelName(heading, 'fil', {}, options)).toBe('Signs');
    expect(localizeLevelName(heading, 'en', { [levelKey(9)]: entry }, options)).toBe('Signs');
    const whole = { ...level, ...heading, requiredScore: 70 };
    const out = localizeLevel(whole, 'fil', { [levelKey(9)]: entry }, options);
    expect(out.name).toBe('XX Signs');
    expect(out.requiredScore).toBe(70);
  });
});

describe('every scenario in the game', () => {
  // Every string an event or hotspot holds is either text, listed for
  // translation, or one of these, which no player reads as a sentence. A new
  // text field fails here until someone decides which it is.
  const NOT_TEXT = new Set([
    'id', 'type', 'correctAction', 'action', 'competency', 'severity', 'art', 'image', 'glyph', 'aspect', 'scene',
    'scenePrefab', 'lane', 'side', 'emergency', 'kind', 'parkingCutscene', 'passingLane', 'toward', 'intoLane',
    'marker', 'area', 'detail', 'src', 'size',
  ]);

  const stringsOf = (value: unknown, at: string, out: Array<[string, string]>): void => {
    if (typeof value === 'string') out.push([at, value]);
    else if (Array.isArray(value)) value.forEach((child, i) => stringsOf(child, `${at}.${i}`, out));
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) stringsOf(child, at ? `${at}.${key}` : key, out);
    }
  };

  it('has every sentence it holds listed for translation', () => {
    const unlisted = new Set<string>();
    for (const { owner, paths } of scenarioRoster()) {
      const listed = textsOf(owner, paths);
      const strings: Array<[string, string]> = [];
      stringsOf(owner, '', strings);
      for (const [path, text] of strings) {
        const leaf = path.split('.').pop()!;
        if (path in listed || NOT_TEXT.has(leaf) || !/\s/.test(text.trim())) continue;
        unlisted.add(`${path.replace(/\.\d+/g, '.*')}: ${text.slice(0, 50)}`);
      }
    }
    expect([...unlisted].sort().slice(0, 40)).toEqual([]);
  });

  it('holds one text under one key, so a translation fits wherever the scenario is played', () => {
    const seen = new Map<string, string>();
    const differing = new Set<string>();
    for (const { key, owner, paths } of scenarioRoster()) {
      const print = scenarioFingerprint(textsOf(owner, paths));
      if (seen.has(key) && seen.get(key) !== print) differing.add(key);
      seen.set(key, print);
    }
    expect([...differing].sort()).toEqual([]);
  });

  it('has a catalogue that names only scenarios that exist', () => {
    const keys = new Set(scenarioRoster().map(row => row.key));
    expect(Object.keys(FILIPINO_CATALOGUE).filter(key => !keys.has(key))).toEqual([]);
  });
});
