// @vitest-environment jsdom
/**
 * The panel that holds the drive must never be the thing that ends it.
 *
 * Every one of these is a way a player could have been stuck behind it: a
 * mouse that does nothing, a key that does nothing, a key repeat that fires the
 * release a hundred times, Strict Mode's effect replay leaving two listeners on
 * the window, or — the sharp one — Space releasing the drive and then being
 * read as the brake by the very next frame, because Space is also the brake.
 */
import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { SupportLevel } from '@/domain/learner/competency';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import ScenarioBriefing from './ScenarioBriefing';
import { showsRoadPrompt } from './panelPriority';

const event = {
  id: 'test.merge',
  type: 'scenario_trigger',
  description: 'The lane you are on ends in a few hundred meters.',
  lawCitation: 'An acceleration lane is for reaching the speed of the traffic you are joining.',
  recommendedMove: 'Build speed, then move into the outer lane.',
  correctAction: 'accelerate',
  points: 10,
  triggerAtDistance: 1000,
  warningDistance: 600,
  penaltyMessage: '-',
  rewardMessage: '+',
  duration: 100,
  competency: 'speed_control',
  severity: 'minor',
} as unknown as ScenarioEvent;

const mount = (
  onContinue: () => void,
  strict = false,
  support: SupportLevel = 'full',
  scenario: ScenarioEvent = event
) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const tree = <ScenarioBriefing event={scenario} support={support} onContinue={onContinue} />;
  act(() => root.render(strict ? <StrictMode>{tree}</StrictMode> : tree));
  return {
    host,
    unmount: () => act(() => root.unmount()),
    press: (key: string) =>
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      }),
    click: () => {
      // The one that releases the drive, by name. The panel also carries a
      // disclosure for the rule behind the scenario, and a helper that took
      // whichever button came first would be testing that instead.
      const button = [...host.querySelectorAll('button')].find(candidate =>
        candidate.textContent?.includes('Continue driving')
      )!;
      act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    },
  };
};

describe('the scenario briefing', () => {
  it('leaves the road visible behind it rather than blurring it away', () => {
    // The hazard being explained is on the board. A briefing that frosts it out
    // is asking the player to learn the situation from prose.
    const panel = mount(() => {});
    const markup = panel.host.innerHTML;
    expect(markup).not.toContain('backdrop-blur');
    // And it is docked, not centred over the scene.
    expect(markup).toContain('justify-end');
    panel.unmount();
  });

  it('keeps the rule behind it folded away until it is asked for', () => {
    const panel = mount(() => {});
    expect(panel.host.textContent).toContain('Why this matters');
    expect(panel.host.textContent).not.toContain(event.lawCitation!);
    const disclosure = [...panel.host.querySelectorAll('button')].find(
      button => button.textContent?.includes('Why this matters')
    )!;
    act(() => disclosure.click());
    expect(panel.host.textContent).toContain(event.lawCitation!);
    panel.unmount();
  });

  it('says what the situation is and what to do about it', () => {
    const panel = mount(() => {});
    // Named by the scenario, not by a generic banner.
    expect(panel.host.textContent).toContain('Merge');
    expect(panel.host.textContent).toContain(event.description);
    expect(panel.host.textContent).toContain(event.recommendedMove!);
    panel.unmount();
  });

  it('is released by the button, by Enter and by Space', () => {
    for (const release of ['click', 'Enter', ' '] as const) {
      const onContinue = vi.fn();
      const panel = mount(onContinue);
      if (release === 'click') panel.click();
      else panel.press(release);
      expect(onContinue, `${release} did not release the drive`).toHaveBeenCalledTimes(1);
      panel.unmount();
    }
  });

  it('releases once however many acknowledgements arrive', () => {
    // A key held down auto-repeats `keydown` every few tens of milliseconds.
    const onContinue = vi.fn();
    const panel = mount(onContinue);
    panel.press(' ');
    panel.press(' ');
    panel.press('Enter');
    panel.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
    panel.unmount();
  });

  it('leaves nothing focused, so the drive is what the keyboard reaches', () => {
    const panel = mount(() => {});
    panel.click();
    expect(document.activeElement).toBe(document.body);
    panel.unmount();
  });

  it('survives Strict Mode without doubling its listener', () => {
    // The replay is setup -> cleanup -> setup. Two live listeners would call
    // the release twice on one press, and a latched guard would leave the
    // second setup unable to release at all.
    const onContinue = vi.fn();
    const panel = mount(onContinue, true);
    panel.press('Enter');
    expect(onContinue).toHaveBeenCalledTimes(1);
    panel.unmount();
  });

  it('stops the page acting on the key that released it', () => {
    // Space scrolls a page and is also this game's brake. The panel cancels the
    // event; the host then suppresses the held key until it is pressed again,
    // which is what stops the release becoming a brake application.
    const panel = mount(() => {});
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(space);
    });
    expect(space.defaultPrevented).toBe(true);
    panel.unmount();
  });
});

describe('the briefing and the cue beside the road', () => {
  it('are never both up', () => {
    // Two copies of the situation, the plate and the recommended move is what
    // made the merge screen unreadable.
    expect(showsRoadPrompt({ inspectionEvent: null, cutsceneEvent: null, briefingEvent: event })).toBe(false);
    expect(showsRoadPrompt({ inspectionEvent: null, cutsceneEvent: null, briefingEvent: null })).toBe(true);
  });

  it('leave the road to the checkpoint and the cutscene too', () => {
    expect(showsRoadPrompt({ inspectionEvent: event, cutsceneEvent: null, briefingEvent: null })).toBe(false);
    expect(showsRoadPrompt({ inspectionEvent: null, cutsceneEvent: event, briefingEvent: null })).toBe(false);
  });
});

describe('the briefing at a narrow viewport', () => {
  it('keeps the plate, the recommendation and the button on screen', () => {
    // 375px is the narrowest phone the game is played on. The panel is a block
    // in the normal flow with its own max width, so nothing here depends on the
    // viewport being wide — but the button and the plate are what a player
    // cannot do without, so they are named.
    const panel = mount(() => {});
    const section = panel.host.querySelector('section')!;
    expect(section.className).toMatch(/max-w-\[460px\]/);
    expect(panel.host.querySelector('button')).not.toBeNull();
    expect(panel.host.textContent).toContain('Continue driving');
    expect(panel.host.textContent).toContain('Do this');
    panel.unmount();
  });

  it('shows the official plate without stretching or cropping it', () => {
    const withImage = {
      ...event,
      sign: {
        image: 'arangkada_extracted_images/level7/merge.png',
        name: 'Merge Ahead',
        category: 'B. Warning Sign',
        meaning: 'The lane you are on ends ahead.',
        art: 'rect_instruction',
      },
    } as unknown as ScenarioEvent;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<ScenarioBriefing event={withImage} support="full" onContinue={() => {}} />));
    const img = host.querySelector('img')!;
    expect(img.className).toContain('object-contain');
    expect(img.className).toContain('max-h-full');
    expect(img.className).toContain('max-w-full');
    act(() => root.unmount());
  });
});

/**
 * The support level h decides how much of the answer the panel carries.
 * The situation is always there; the move, the note and the rule
 * only at full; where to look only at cue.
 */
describe('the briefing at each support level', () => {
  const signed = {
    ...event,
    realWorldNote: 'Signal before you move across.',
    sign: {
      name: 'Merge Ahead',
      category: 'B. Warning Sign',
      meaning: 'The lane you are on ends ahead.',
      art: 'rect_instruction',
      glyph: 'MERGE',
    },
  } as unknown as ScenarioEvent;

  it('gives the move, the note and the rule at full', () => {
    const panel = mount(() => {}, false, 'full', signed);
    const text = panel.host.textContent!;
    expect(text).toContain(signed.description);
    expect(text).toContain('Merge Ahead');
    expect(text).toContain('Do this');
    expect(text).toContain(signed.recommendedMove!);
    expect(text).toContain(signed.realWorldNote!);
    expect(text).toContain('Why this matters');
    expect(text).not.toContain('Where to look');
    panel.unmount();
  });

  it('gives where to look instead at cue, and nothing that says what to do', () => {
    const panel = mount(() => {}, false, 'cue', signed);
    const text = panel.host.textContent!;
    expect(text).toContain(signed.description);
    expect(text).toContain('Merge Ahead');
    expect(text).toContain('Where to look');
    expect(text).toContain('Watch the sign (Warning Sign).');
    expect(text).not.toContain('Do this');
    expect(text).not.toContain(signed.recommendedMove!);
    expect(text).not.toContain(signed.realWorldNote!);
    expect(text).not.toContain('Why this matters');
    panel.unmount();
  });

  it('gives the situation alone at none', () => {
    const panel = mount(() => {}, false, 'none', signed);
    const text = panel.host.textContent!;
    expect(text).toContain(signed.description);
    expect(text).toContain('Merge Ahead');
    expect(text).not.toContain('Do this');
    expect(text).not.toContain(signed.recommendedMove!);
    expect(text).not.toContain('Where to look');
    expect(text).not.toContain(signed.realWorldNote!);
    expect(text).not.toContain('Why this matters');
    panel.unmount();
  });

  it('is released by the button, by Enter and by Space at every level', () => {
    for (const support of ['full', 'cue', 'none'] as const) {
      for (const release of ['click', 'Enter', ' '] as const) {
        const onContinue = vi.fn();
        const panel = mount(onContinue, false, support, signed);
        if (release === 'click') panel.click();
        else panel.press(release);
        expect(onContinue, `${release} at ${support}`).toHaveBeenCalledTimes(1);
        panel.unmount();
      }
    }
  });
});
