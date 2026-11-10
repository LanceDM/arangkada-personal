// @vitest-environment jsdom
/**
 * What the briefing, the mission panel and the lesson reader tell a player
 * about a level must be what the level does: its scored parts, the speeds it
 * grades against, a pass mark against its maximum, and a checkpoint from the
 * quiz bank that gates the drive, or blocks the level when it cannot be read.
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { LEVEL_MODULES } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { moduleReadMinutes } from '@/features/driving-sim/domain/scenario/lessonModule';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { BriefingProgress, QuizBank } from '@/features/driving-sim/application/ports';
import { fixtureQuizItem } from '@/features/driving-sim/domain/scenario/quizBank.fixture';
import type { QuizModuleDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import { provideDrivingSimDependencies } from '@/features/driving-sim/application/dependencies';
import MissionBriefing from './MissionBriefing';
import MissionPanel from './MissionPanel';
import LessonReader from './LessonReader';

let progress: Partial<BriefingProgress> = {};
let isAdmin = false;
/** What the bank holds for every module, or the error its read fails with. */
let bank: QuizBank | Error = { items: [], settings: null };
const bankLoads = vi.fn();

const itemsFor = (moduleId: string, count: number) =>
  Array.from({ length: count }, (_, i) => fixtureQuizItem(moduleId, i + 1));
const noQuiz = (moduleId: string): QuizModuleDoc => ({
  schemaVersion: 1,
  moduleId,
  hasQuiz: false,
  itemsPerSitting: 10,
  passingScore: 6,
  revision: 1,
  updatedAt: 0,
  updatedBy: 'test',
});

vi.mock('@/features/auth', () => ({ useAuthSession: () => ({ isAdmin }) }));

provideDrivingSimDependencies({
  learnerHistory: { load: async () => ({ source: 'local', attempts: [] }) },
  storyAttempts: {
    save: async () => 'test-attempt',
    saveFsmTelemetry: async () => {},
    saveDecisionTelemetry: async () => {},
    saveRoutingTelemetry: async () => {},
  },
  signCoverage: { load: () => ({}), record: () => {} },
  briefingProgress: { load: () => progress, save: () => {}, markLessonsRead: () => {} },
  quizBank: {
    load: async moduleId => {
      bankLoads(moduleId);
      if (bank instanceof Error) throw bank;
      return { items: bank.items.filter(item => item.moduleId === moduleId), settings: bank.settings };
    },
  },
  quizSittings: { save: async () => {} },
  routingMode: 'new',
  routing: { loadAssignment: async () => null, loadCursor: async () => null, saveCursor: async () => {} },
  routingOverride: { load: () => 'assigned', save: () => {} },
  optimizedRouting: async () => {
    throw new Error('no briefing reads the routing table');
  },
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const level = (id: number): LevelConfig => LEVELS.find(entry => entry.id === id)!;
const noop = () => {};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  progress = {};
  isAdmin = false;
  bank = { items: [], settings: null };
  bankLoads.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): string => {
  act(() => root.render(element));
  return container.textContent ?? '';
};

const briefing = (levelConfig: LevelConfig, extra: Partial<Parameters<typeof MissionBriefing>[0]> = {}) =>
  render(<MissionBriefing level={levelConfig} onBack={noop} onStartGame={noop} {...extra} />);

const text = () => container.textContent ?? '';

/** Lets the bank's read settle. */
const settle = () => act(async () => {});

const quizButton = () =>
  [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Short Quiz'))!;

const driveButton = () =>
  [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Driving Simulation'))!;

describe('the briefing', () => {
  it("counts Level 2's garage, and shows its pass score against the maximum", () => {
    const text = briefing(level(2));
    expect(text).toContain('8 garage checks · 3 road events');
    expect(text).toContain('3Road events+8 garage checks');
    expect(text).toContain('170 / 240');
  });

  it("names Level 9's crash scene and Level 10's garage beside their road events", () => {
    expect(briefing(level(9))).toContain('6 road events · 4 crash-scene steps');
    expect(briefing(level(10))).toContain('4 garage checks · 7 road events');
  });

  it('names an appended practice item as not scored', () => {
    const level8 = level(8);
    const practice = { ...level(3).events[0], id: 'level3.practice', remediation: true } as ScenarioEvent;
    expect(briefing({ ...level8, events: [...level8.events, practice] })).toContain('+1 practice (not scored)');
  });

  it("shows the road's limit and every other limit the route grades against", () => {
    const text = briefing(level(7));
    expect(text).toContain('Road limit');
    expect(text).toContain('Other limits on this route: minimum 60 km/h, 60 km/h, 40 km/h.');
  });

  it("gives the tutorial its limit, which is the car's top speed, and no FSM", () => {
    const text = briefing(level(0));
    expect(text).toContain('30Course limit, km/h');
    expect(text).not.toContain('FSM');
  });

  it('holds the drive while the quiz loads', () => {
    bank = { items: itemsFor(level(2).moduleId, 12), settings: null };
    progress = { lessonsRead: true, quizPassed: true };
    briefing(level(2));
    expect(text()).toContain('Loading the checkpoint');
    expect(driveButton().disabled).toBe(true);
  });

  it('holds the drive behind the checkpoint until it is passed, asking 10 of the bank', async () => {
    bank = { items: itemsFor(level(2).moduleId, 12), settings: null };
    briefing(level(2));
    await settle();
    expect(text()).toContain('10 checkpoint items');
    expect(text()).toContain('pass the 10-item checkpoint');
    expect(driveButton().disabled).toBe(true);

    act(() => root.unmount());
    root = createRoot(container);
    progress = { lessonsRead: true, quizPassed: true };
    briefing(level(2));
    await settle();
    expect(driveButton().disabled).toBe(false);
  });

  it('opens the quiz and the drive to an admin before anything is read or passed', async () => {
    isAdmin = true;
    bank = { items: itemsFor(level(2).moduleId, 12), settings: null };
    briefing(level(2));
    await settle();
    expect(quizButton().disabled).toBe(false);
    expect(driveButton().disabled).toBe(false);
  });

  it('opens the drive where the level has no quiz, and promises none', async () => {
    bank = { items: [], settings: noQuiz(level(0).moduleId) };
    briefing(level(0));
    await settle();
    expect(text()).not.toContain('Short Quiz');
    expect(text()).not.toMatch(/checkpoint/i);
    expect(driveButton().disabled).toBe(false);
  });

  it('blocks the level when the bank has no item for it, even after a pass', async () => {
    progress = { lessonsRead: true, quizPassed: true };
    briefing(level(3));
    await settle();
    expect(text()).toContain("Couldn't load the quiz, try again");
    expect(driveButton().disabled).toBe(true);
  });

  it('blocks the level when the read fails, and Retry reads again', async () => {
    bank = new Error('offline');
    progress = { lessonsRead: true };
    briefing(level(5));
    await settle();
    expect(text()).toContain("Couldn't load the quiz, try again");
    expect(driveButton().disabled).toBe(true);

    bank = { items: itemsFor(level(5).moduleId, 7), settings: null };
    act(() => quizButton().click());
    await settle();
    expect(bankLoads).toHaveBeenCalledTimes(2);
    expect(text()).toContain('7 checkpoint items');
    expect(quizButton().disabled).toBe(false);
    expect(driveButton().disabled).toBe(true);
  });

  it("shows the reading time of the module's whole text", () => {
    const module = LEVEL_MODULES[level(3).moduleId];
    expect(briefing(level(3))).toContain(`${moduleReadMinutes(module)}Min`);
  });

  it('marks the pass score of a review or a free replay as practice', () => {
    const note = { heading: { en: 'Free replay' }, lines: [], practiceOnly: true as const };
    expect(briefing(level(4), { courseNote: note })).toContain('For practice: it does not hold you back.');
    expect(briefing(level(4), { courseNote: { heading: { en: 'Next' }, lines: [] } })).not.toContain('For practice');
  });

  it('promises a weak area more scenarios only where the roll leans toward it', () => {
    const weakArea = { competency: 'road_signs' as const, score: 30 };
    expect(briefing(level(3), { weakArea })).toContain("This level's roll leans toward");
    const level7 = briefing(level(7), { weakArea });
    expect(level7).not.toContain('leans toward');
    expect(level7).toContain('a practice scenario may be added');
  });
});

describe('the mission panel', () => {
  const panel = (levelConfig: LevelConfig) =>
    render(<MissionPanel level={levelConfig} score={0} progress={0} eventsCleared={0} decisions={[]} />);

  it('asks for the pass mark out of the maximum, and claims no speed it does not grade', () => {
    const level2 = panel(level(2));
    expect(level2).toContain('Score 170 of 240 to pass.');
    expect(level2).toContain('Road limit 30 km/h; signs may post others.');
    expect(level2).not.toContain('Stay at or under');
  });

  it("gives the tutorial its limit as the car's top speed", () => {
    expect(panel(level(0))).toContain("Course limit 30 km/h, the car's top speed.");
  });

  it('says how many of its events are practice', () => {
    const level8 = level(8);
    const practice = { ...level(3).events[0], id: 'level3.practice', remediation: true } as ScenarioEvent;
    const withPractice = panel({ ...level8, events: [...level8.events, practice] });
    expect(withPractice).toContain('0/7');
    expect(withPractice).toContain('Events · 1 practice');
  });
});

describe('the lesson reader', () => {
  const reader = (levelId: number, quizSize?: number) =>
    render(<LessonReader module={LEVEL_MODULES[level(levelId).moduleId]} quizSize={quizSize} onClose={noop} onFinish={noop} />);

  it("reads the level without a thirteenth level, and with the briefing's reading time", () => {
    const module = LEVEL_MODULES[level(3).moduleId];
    const text = reader(3);
    expect(text).toContain('Level 3');
    expect(text).not.toContain('/ 13');
    expect(text).toContain(`${moduleReadMinutes(module)}Min`);
  });

  it('badges a lesson with its own mark, never a second number', () => {
    const text = reader(8);
    expect(text).toContain('1What Is Defensive Driving');
    expect(text).not.toContain('1. What Is Defensive Driving');
    expect(text).not.toContain('21. What Is');
  });

  it('promises the checkpoint only where the level has one', () => {
    expect(reader(1, 10)).toContain('Proceed to Checkpoint');
    const quizless = reader(3, 0);
    expect(quizless).toContain('Finish Reading');
    expect(quizless).not.toMatch(/checkpoint/i);
  });

  it('promises no quiz it has not been told of', () => {
    const text = reader(1);
    expect(text).toContain('Finish Reading');
    expect(text).toContain("The level's checkpoint and drive open from its briefing.");
  });
});
