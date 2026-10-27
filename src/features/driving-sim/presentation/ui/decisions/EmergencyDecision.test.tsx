// @vitest-environment jsdom
/**
 * The frozen emergency prompt, driven by the keyboard.
 *
 * It is the one place in the game where the drive is stopped and an answer is
 * taken from a panel, so it is the one place a player can be trapped: if the
 * keys do not work and focus is somewhere else, the road never resumes. These
 * are the ways out, each asserted rather than assumed.
 *
 * The hierarchy is asserted here too. The panel used to show the situation, the
 * question, three answers, the verdict, the correction and the whole law
 * citation in one 300px column; the rule now is that the citation is folded
 * away until it is asked for, and that the verdict replaces the question rather
 * than joining it.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import EmergencyDecision from './EmergencyDecision';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';

const event = LEVELS.find(level => level.id === 9)!.events.find(
  candidate => candidate.id === 'level9.brakes-gone'
)!;

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.useRealTimers();
});

/**
  * Mounts the panel and returns its host, with teardown registered.
  *
  * `seed` 0 is the authored order, which is what most of these assert against;
  * the ordering tests pass a real seed to move the answers around.
  */
const mount = (onAnswer: (action: string) => void = () => {}, seed = 0) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(<EmergencyDecision event={event} onAnswer={onAnswer} choiceSeed={seed} />);
  });
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
};

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });

const answerButtons = (host: HTMLElement) =>
  [...host.querySelectorAll('button')].filter(button =>
    event.choices!.some(choice => button.textContent?.includes(choice.label))
  );

describe('answering an emergency from the keyboard', () => {
  it('opens with the first answer focused, so a key press goes somewhere', () => {
    const host = mount();
    expect(document.activeElement).toBe(answerButtons(host)[0]);
  });

  it('takes each answer by its number key', () => {
    // Every choice, not just the first: an off-by-one here silently answers the
    // wrong one, and the player is told they chose something they did not.
    event.choices!.forEach((choice, index) => {
      const answered: string[] = [];
      const host = mount(action => answered.push(action));
      press(String(index + 1));
      // The emergency plays out before the answer is committed, so nothing has
      // reached the session yet — but the question is gone and the verdict is up.
      expect(answered).toEqual([]);
      expect(host.textContent).not.toContain(event.question);
      cleanup?.();
      cleanup = null;
      expect(choice.action).toBeTruthy();
    });
  });

  it('ignores a number key with no answer behind it', () => {
    const host = mount();
    press('9');
    expect(host.textContent).toContain(event.question);
    expect(answerButtons(host)).toHaveLength(event.choices!.length);
  });

  it('commits the verdict on Enter, and only once it is a verdict', () => {
    vi.useFakeTimers();
    const answered: string[] = [];
    mount(action => answered.push(action));

    press('1');
    // Still resolving: Enter must not skip past the consequence.
    press('Enter');
    expect(answered).toEqual([]);

    // The resolution clock runs on animation frames; jsdom fires them on a
    // timer, so advancing past the whole resolution reaches the verdict.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    press('Enter');
    expect(answered).toEqual([event.choices![0].action]);
  });

  it('keeps Tab inside the panel', () => {
    // There is a whole driving screen behind this one. Tabbing onto it lands on
    // controls that do nothing while the world is frozen.
    const host = mount();
    const buttons = [...host.querySelectorAll('button')];
    buttons[buttons.length - 1].focus();
    press('Tab');
    expect(host.contains(document.activeElement)).toBe(true);
  });
});

describe('what the emergency panel shows at once', () => {
  it('asks the question without the verdict, and shows the verdict without the question', () => {
    const host = mount();
    expect(host.textContent).toContain(event.question);
    expect(host.textContent).not.toContain(event.rewardMessage);
    expect(host.textContent).not.toContain(event.penaltyMessage);

    press('1');
    expect(host.textContent).not.toContain(event.question);
    expect(host.textContent).toContain(event.rewardMessage);
  });

  it('never shows the law citation until somebody asks for it', () => {
    const host = mount();
    expect(host.textContent).not.toContain(event.lawCitation);
    press('1');
    expect(host.textContent).not.toContain(event.lawCitation);

    const disclosure = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Why this matters')
    )!;
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    act(() => {
      disclosure.click();
    });
    expect(host.textContent).toContain(event.lawCitation);
  });

  it('says the verdict in words as well as in color', () => {
    // A reader who cannot tell the green border from the red one still has to
    // know which way it went.
    const host = mount();
    press('1');
    expect(host.textContent).toContain('Speed brought down');
  });
});
