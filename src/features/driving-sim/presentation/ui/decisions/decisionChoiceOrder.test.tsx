// @vitest-environment jsdom
/**
 * Every component in the game that renders a question, driven by the keyboard
 * and the mouse after its answers have been reordered.
 *
 * `choiceOrder.test.ts` proves the ordering itself. This proves the wiring: that
 * each component actually uses it, that the number keys follow what is on
 * screen rather than what the level authored, and that clicking the third
 * button submits the third *displayed* answer. Getting that wrong is worse than
 * not shuffling at all — the player would be told they chose something they did
 * not.
 *
 * Swept over all five components rather than the one that was changed last,
 * because the shuffle is only as good as its least-wired consumer.
 */
import { describe, expect, it, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import CheckpointInspection from './CheckpointInspection';
import EmergencyDecision from './EmergencyDecision';
import ParkingDecision from './ParkingDecision';
import RoadDecision from './RoadDecision';
import GarageStage from '../GarageStage';
import { recordingCanvasContext } from '@/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { displayedChoices } from '@/features/driving-sim/domain/scenario/choiceOrder';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    recordingCanvasContext().ctx as unknown as RenderingContext
  );
});

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const render = (node: React.ReactNode) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(node));
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
};

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });

/** The buttons that are answers, in the order they appear on screen. */
const answerButtons = (host: HTMLElement, labels: string[]) =>
  [...host.querySelectorAll('button')].filter(button =>
    labels.some(label => button.textContent?.includes(label))
  );

const noop = () => {};
const level = (id: number) => LEVELS.find(entry => entry.id === id)!;
const eventOf = (levelId: number, eventId: string) =>
  level(levelId).events.find(event => event.id === eventId)!;

/**
 * One case per component: how to mount it, which question it is asking, and —
 * where the panel does not commit on the press — how to finish the flow.
 *
 * A seed that genuinely moves the answers is picked per case: a shuffle is
 * allowed to land on the authored order, and a case that happened to would
 * assert nothing.
 */
interface Case {
  name: string;
  event: Pick<ScenarioEvent, 'id' | 'choices' | 'correctAction'>;
  mount: (onAnswer: (action: string) => void, seed: number) => HTMLElement;
  /** Carries a two-phase panel from the pick through to the committed answer. */
  settle?: () => void;
}

const emergency = eventOf(9, 'level9.brakes-gone');
const roadCall = level(5).events.find(e => e.cutscene && !e.emergency && e.choices)!;
const checkpoint = LEVELS.flatMap(l => l.events).find(e => e.inspection && e.choices)!;
const crashScene = level(9).aftermath!;
const crashPoint = crashScene.hotspots[0];

/** Level 6's parallel-parking bay, the one scenario `ParkingDecision` asks. */
const parking = LEVELS.flatMap(l => l.events).find(e => e.parkingCutscene)!;

const CASES: Case[] = [
  {
    name: 'EmergencyDecision',
    event: emergency,
    mount: (onAnswer, seed) =>
      render(<EmergencyDecision event={emergency} onAnswer={onAnswer} choiceSeed={seed} />),
    // Picks, watches the emergency play out, then commits on Enter. The clock
    // it plays out on runs on animation frames, which jsdom fires on a timer.
    settle: () => {
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      press('Enter');
    },
  },
  {
    name: 'RoadDecision',
    event: roadCall,
    // `onPlay` is what a pick reaches first on a junction that is watched on the
    // canvas; a roundabout commits straight through `onAnswer`. Both are routed
    // to the same recorder, so either shape proves the same wiring.
    mount: (onAnswer, seed) =>
      render(
        <RoadDecision
          event={roadCall}
          onPlay={onAnswer}
          played
          onAnswer={onAnswer}
          choiceSeed={seed}
        />
      ),
  },
  {
    name: 'ParkingDecision',
    event: parking,
    mount: (onAnswer, seed) =>
      render(
        <ParkingDecision
          event={parking}
          onPlay={onAnswer}
          played
          onAnswer={onAnswer}
          choiceSeed={seed}
        />
      ),
  },
  {
    name: 'CheckpointInspection',
    event: checkpoint,
    mount: (onAnswer, seed) =>
      render(<CheckpointInspection event={checkpoint} onAnswer={onAnswer} choiceSeed={seed} />),
  },
  {
    name: 'GarageStage hotspot',
    event: { id: crashPoint.id, choices: crashPoint.choices, correctAction: crashPoint.correctAction },
    mount: (onAnswer, seed) => {
      const host = render(
        <GarageStage
          garage={crashScene}
          levelName="Crash scene"
          score={0}
          choiceSeed={seed}
          onAnswer={(_spot, action) => onAnswer(action)}
          onComplete={noop}
          onExit={noop}
        />
      );
      const entry = [...host.querySelectorAll('button')].find(button =>
        button.textContent?.includes(crashPoint.label)
      )!;
      act(() => entry.click());
      return host;
    },
  },
];

/** A seed that actually moves this question's answers away from authored order. */
const shufflingSeed = (questionId: string, choices: Case['event']['choices']) => {
  for (let seed = 1; seed < 500; seed++) {
    const shown = displayedChoices(choices, seed, questionId);
    if (shown.some((entry, at) => entry.authoredIndex !== at)) return seed;
  }
  throw new Error(`no seed reorders ${questionId}`);
};

describe('every decision component uses the shuffled order', () => {
  it('has a case for each one, so this sweep means something', () => {
    expect(CASES.map(entry => entry.name)).toEqual([
      'EmergencyDecision',
      'RoadDecision',
      'ParkingDecision',
      'CheckpointInspection',
      'GarageStage hotspot',
    ]);
  });

  for (const testCase of CASES) {
    it(`${testCase.name}: renders answers in the displayed order, not the authored one`, () => {
      const seed = shufflingSeed(testCase.event.id, testCase.event.choices);
      const expected = displayedChoices(testCase.event.choices, seed, testCase.event.id);
      const host = testCase.mount(noop, seed);
      const labels = (testCase.event.choices ?? []).map(choice => choice.label);
      const shown = answerButtons(host, labels);

      expect(shown).toHaveLength(labels.length);
      shown.forEach((button, at) => {
        expect(
          button.textContent,
          `${testCase.name} position ${at + 1}`
        ).toContain(expected[at].choice.label);
      });
      // And genuinely reordered, or this assertion is vacuous.
      expect(expected.map(entry => entry.authoredIndex)).not.toEqual(
        expected.map((_, at) => at)
      );
    });

    it(`${testCase.name}: number keys submit the answer that is on screen`, () => {
      const seed = shufflingSeed(testCase.event.id, testCase.event.choices);
      const expected = displayedChoices(testCase.event.choices, seed, testCase.event.id);

      expected.forEach((entry, at) => {
        const answered: string[] = [];
        if (testCase.settle) vi.useFakeTimers();
        testCase.mount(action => answered.push(action), seed);
        press(String(at + 1));
        testCase.settle?.();
        expect(answered, `${testCase.name} key ${at + 1}`).toEqual([entry.choice.action]);
        cleanup?.();
        cleanup = null;
        vi.useRealTimers();
      });
    });

    it(`${testCase.name}: clicking an answer submits that answer`, () => {
      const seed = shufflingSeed(testCase.event.id, testCase.event.choices);
      const expected = displayedChoices(testCase.event.choices, seed, testCase.event.id);
      const labels = (testCase.event.choices ?? []).map(choice => choice.label);

      expected.forEach((entry, at) => {
        const answered: string[] = [];
        if (testCase.settle) vi.useFakeTimers();
        const host = testCase.mount(action => answered.push(action), seed);
        act(() => answerButtons(host, labels)[at].click());
        testCase.settle?.();
        expect(answered, `${testCase.name} click ${at + 1}`).toEqual([entry.choice.action]);
        cleanup?.();
        cleanup = null;
        vi.useRealTimers();
      });
    });

    it(`${testCase.name}: does not reorder when the panel re-renders`, () => {
      // The drive re-renders these on every painted frame. An order recomputed
      // per render would move the answers under the player's cursor.
      const seed = shufflingSeed(testCase.event.id, testCase.event.choices);
      const labels = (testCase.event.choices ?? []).map(choice => choice.label);
      const host = testCase.mount(noop, seed);
      const before = answerButtons(host, labels).map(button => button.textContent);
      for (let i = 0; i < 5; i++) act(() => window.dispatchEvent(new Event('resize')));
      expect(answerButtons(host, labels).map(button => button.textContent)).toEqual(before);
    });
  }
});

describe('the answers a question was authored with', () => {
  it('are never mutated by being displayed', () => {
    // A shuffle in place would rewrite the level's own content for the rest of
    // the session, and the next attempt would inherit it.
    const authored = JSON.stringify(emergency.choices);
    for (let seed = 1; seed < 50; seed++) {
      render(<EmergencyDecision event={emergency} onAnswer={noop} choiceSeed={seed} />);
      cleanup?.();
      cleanup = null;
    }
    expect(JSON.stringify(emergency.choices)).toBe(authored);
  });
});
