// @vitest-environment jsdom
/**
 * The decision docked over the frozen road, driven by the keyboard.
 *
 * Two panels share this shell — the call the road asks and the parking
 * technique — and between them they cover every frozen scenario in the game
 * that is not a vehicle failure. The drive is stopped while one is up, so it is
 * a place a player can be trapped: if the keys do not work and focus is
 * somewhere else, the road never resumes. These are the ways out, each asserted
 * rather than assumed.
 *
 * The copy is asserted here too, because that is what the shell replaced. The
 * panel was `RightOfWayDecision`: it said "Right Of Way" over a ringing phone,
 * called the wait "Watch the junction…" where there was no junction, and
 * reported leaving the phone alone as "Right of way given".
 */
import { describe, expect, it, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import RoadDecision from './RoadDecision';
import ParkingDecision from './ParkingDecision';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';

/** The phone, which is the reason this panel is no longer about junctions. */
const phone = LEVELS.find(level => level.id === 10)!.events.find(
  candidate => candidate.id === 'level10.the-phone-rings'
)!;

/** And a real right-of-way call, so generalising it did not lose that case. */
const junction = LEVELS.find(level => level.id === 5)!.events.find(
  candidate => candidate.cutscene && !candidate.emergency && candidate.choices
)!;

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

let cleanup: (() => void) | null = null;

/** Unmounts whatever `render` last mounted. */
const unmount = () => {
  cleanup?.();
  cleanup = null;
};

afterEach(unmount);

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

/**
 * Mounts the road panel for an event.
 *
 * `played` pins the canvas as having finished, so a pick steps straight to the
 * verdict: there is no driving canvas behind this, and the resolution it
 * normally waits on could never arrive. `seed` 0 keeps the authored order,
 * which is what the assertions below read against.
 */
const noop: (action: string) => void = () => {};

const mount = (
  event = phone,
  {
    onAnswer = noop,
    onPlay = noop,
    played = true,
  }: { onAnswer?: (action: string) => void; onPlay?: (action: string) => void; played?: boolean } = {}
) =>
  render(
    <RoadDecision
      event={event}
      onPlay={onPlay}
      played={played}
      onAnswer={onAnswer}
      choiceSeed={0}
    />
  );

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });

/**
 * What the dialog says it is called, read the way a screen reader would: the
 * element `aria-labelledby` actually points at, rather than the first heading.
 */
const titleOf = (host: HTMLElement) => {
  const labelledBy = host.querySelector('[role="dialog"]')!.getAttribute('aria-labelledby')!;
  return document.getElementById(labelledBy)?.textContent;
};

const answerButtons = (host: HTMLElement, event = phone) =>
  [...host.querySelectorAll('button')].filter(button =>
    event.choices!.some(choice => button.textContent?.includes(choice.label))
  );

describe('the panel names the scenario it is asking about', () => {
  it('takes its title from the scenario, not from a junction', () => {
    const host = mount();
    expect(titleOf(host)).toBe(scenarioLabel(phone));
    expect(host.textContent).not.toMatch(/right of way/i);
  });

  it('still titles a real right-of-way call correctly', () => {
    const host = mount(junction);
    expect(titleOf(host)).toBe(scenarioLabel(junction));
  });

  it('reports the verdict as a call rather than as a manoeuvre', () => {
    const host = mount();
    press('1');
    // The first authored answer is the correct one, so this is the pass line.
    expect(host.textContent).toContain('Good call');
    expect(host.textContent).not.toMatch(/right of way (given|taken)/i);
  });

  it('says what it is waiting for without claiming a junction', () => {
    const host = mount(phone, { played: false });
    press('1');
    expect(host.textContent).toContain('Watching what happens');
    expect(host.textContent).not.toMatch(/junction/i);
  });

  it('gives the parking panel its own words over the same shell', () => {
    const parking = LEVELS.flatMap(level => level.events).find(event => event.parkingCutscene)!;
    const host = render(
      <ParkingDecision
        event={parking}
        onPlay={() => {}}
        played
        onAnswer={() => {}}
        choiceSeed={0}
      />
    );
    expect(host.textContent).toContain('Parking technique');
    press('1');
    expect(host.textContent).toMatch(/parked correctly|badly parked/i);
  });
});

describe('answering a docked decision from the keyboard', () => {
  it('opens with the first answer focused, so a key press goes somewhere', () => {
    const host = mount();
    expect(document.activeElement).toBe(answerButtons(host)[0]);
  });

  it('is a modal dialog, so a screen reader is told the road is not the subject', () => {
    const host = mount();
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('takes each answer by its number key', () => {
    // Every choice, not just the first: an off-by-one here silently answers the
    // wrong one, and the player is told they chose something they did not.
    phone.choices!.forEach((choice, index) => {
      const answered: string[] = [];
      const host = mount(phone, { onPlay: action => answered.push(action) });
      press(String(index + 1));
      expect(answered).toEqual([choice.action]);
      // And the question is gone: the verdict replaces it rather than joining it.
      expect(host.textContent).not.toContain(phone.question);
      unmount();
    });
  });

  it('commits on Enter once the verdict is up, and not before', () => {
    const committed: string[] = [];
    mount(phone, { onAnswer: action => committed.push(action), played: false });
    press('Enter');
    expect(committed, 'Enter answered nothing before a choice was made').toEqual([]);
    press('1');
    press('Enter');
    expect(committed, 'Enter still committed while the answer was resolving').toEqual([]);
  });

  it('commits on Enter and on Space at the verdict', () => {
    for (const key of ['Enter', ' ']) {
      const committed: string[] = [];
      mount(phone, { onAnswer: action => committed.push(action) });
      press('1');
      press(key);
      expect(committed).toEqual([phone.choices![0].action]);
      unmount();
    }
  });

  it('keeps Tab inside the panel', () => {
    // Nothing behind it is reachable while the drive is frozen, and Tab leaking
    // out lands on a control that does nothing — or on the exit button.
    const host = mount();
    const buttons = [...host.querySelectorAll('button')];
    act(() => buttons[buttons.length - 1].focus());
    press('Tab');
    expect(document.activeElement).toBe(buttons[0]);
    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('focuses the way back to the drive once the verdict is up', () => {
    const host = mount();
    press('1');
    const back = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Continue driving')
    );
    expect(document.activeElement).toBe(back);
  });
});

describe('the docked decision shows one thing at a time', () => {
  it('folds the citation away until it is asked for', () => {
    const host = mount();
    press('1');
    expect(host.textContent, 'the statute is printed under the verdict').not.toContain(
      phone.lawCitation
    );
    const disclosure = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Why this matters')
    )!;
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    act(() => disclosure.click());
    expect(host.textContent).toContain(phone.lawCitation);
  });

  it('does not cover the road it is asking about', () => {
    // The drive freezes just short of what it asks about, so the car, the bay
    // and the junction's cross traffic all stand low on the board: the car from
    // 78%. The panel docks at the top, under the HUD strip, and ends above the
    // car. Docked at the foot, it sat over the car and the bay, and the parking
    // manoeuvre could not be watched.
    const host = mount();
    const dock = host.querySelector('[data-testid="road-decision"]')!;
    expect(dock.className).toContain('absolute');
    expect(dock.className).toContain('items-start');
    expect(dock.className).toContain('bottom-[22%]');
    expect(dock.className.split(/\s+/)).not.toContain('bottom-0');
    // Docked below the HUD strip, which is shorter on a phone because the whole
    // board is drawn at a smaller scale there.
    expect(dock.className).toContain('top-[48px]');
    expect(dock.className).toContain('sm:top-[64px]');
  });

  it('is a header and a status line while the answer plays out, and gives the verdict after', () => {
    for (const event of [phone, LEVELS.flatMap(level => level.events).find(e => e.parkingCutscene)!]) {
      const parking = Boolean(event.parkingCutscene);
      const props = { event, onPlay: noop, onAnswer: noop, choiceSeed: 0 };
      const watching = render(
        parking ? <ParkingDecision {...props} played={false} /> : <RoadDecision {...props} played={false} />
      );
      press('1');
      expect(watching.textContent, event.id).not.toContain(event.rewardMessage);
      expect(watching.textContent, event.id).not.toContain(event.penaltyMessage);
      expect(watching.textContent, event.id).not.toMatch(/parked correctly|badly parked|good call|wrong call/i);
      expect(watching.querySelectorAll('button[disabled]').length, event.id).toBe(1);
      unmount();

      const done = render(parking ? <ParkingDecision {...props} played /> : <RoadDecision {...props} played />);
      press('1');
      const verdict = done.textContent!;
      expect(verdict.includes(event.rewardMessage) || verdict.includes(event.penaltyMessage), event.id).toBe(true);
      unmount();
    }
  });

  it('shows the situation once, and the question louder than it', () => {
    const host = mount();
    const heading = host.querySelector('h2')!;
    expect(heading.textContent).toBe(phone.question);
    expect(host.textContent).toContain(phone.description);
    // The description appears once, not once per phase.
    expect(host.textContent!.split(phone.description).length - 1).toBe(1);
  });
});
