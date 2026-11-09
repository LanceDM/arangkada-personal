// @vitest-environment jsdom
/**
 * The guided home and the consent step: the one next
 * step and the tracker for each stage, withdrawal, and a consent that stops
 * a minor and saves nothing; each in the language the participant chose,
 * which the consent's records name.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudyFacts, StudyStage } from '@/domain/study/studyStage';
import { provideStudyDependencies, type StudyDependencies } from '@/features/study/application/dependencies';
import { StudyProgressContext, type StudyProgressState } from '@/features/study/application/studyProgress';
import { LanguageProvider } from '@/shared/i18n/language';
import type { Language } from '@/shared/lib/localized';
import { ConsentStep } from './ConsentStep';
import { StudyHome } from './StudyHome';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const saveConsent = vi.fn(async () => {});
const withdraw = vi.fn(async () => {});

beforeEach(() => {
  saveConsent.mockClear();
  withdraw.mockClear();
  provideStudyDependencies({
    registry: {} as StudyDependencies['registry'],
    accounts: {} as StudyDependencies['accounts'],
    sources: {} as StudyDependencies['sources'],
    records: { saveConsent, withdraw } as unknown as StudyDependencies['records'],
  });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const facts = {} as StudyFacts;
const ready = (stage: StudyStage, refresh = vi.fn(async () => {})): StudyProgressState => ({
  status: 'ready',
  enrolment: { schemaVersion: 1, code: 'P-0004', cohort: 'study', enrolledAt: 1 },
  facts,
  stage,
  refresh,
});

const render = (node: React.ReactNode, progress: StudyProgressState, language: Language = 'en') => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <LanguageProvider value={{ language, chosen: true, choose: () => {} }}>
        <StudyProgressContext.Provider value={progress}>{node}</StudyProgressContext.Provider>
      </LanguageProvider>
    )
  );
  return host;
};

const button = (label: RegExp) => [...host!.querySelectorAll('button')].find(b => label.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
const type = (selector: string, value: string) => {
  const input = host!.querySelector(selector) as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('the guided home', () => {
  it('shows the code, one next step for the stage, and where it falls in the order', () => {
    const onNext = vi.fn();
    render(<StudyHome uid="u" onNext={onNext} onSignOut={() => {}} />, ready('pre-test'));
    expect(host!.textContent).toContain('P-0004');
    act(() => button(/NEXT STEP.*TAKE THE PRE-TEST/)!.click());
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ to: '/play/pre-test' }));
    const current = host!.querySelector('[aria-current="step"]')!;
    expect(current.textContent).toContain('Pre-test');
    expect(host!.querySelectorAll('ol li').length).toBe(10);
  });

  it('enters the course by Continue at the course stages', () => {
    const onNext = vi.fn();
    render(<StudyHome uid="u" onNext={onNext} onSignOut={() => {}} />, ready('levels'));
    act(() => button(/NEXT STEP.*CONTINUE THE COURSE/)!.click());
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ to: '/play/story', continueCourse: true }));
  });

  it('reads the progress afresh each time it opens', () => {
    const refresh = vi.fn(async () => {});
    render(<StudyHome uid="u" onNext={() => {}} onSignOut={() => {}} />, ready('consent', refresh));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('records a withdrawal only once confirmed, keeping what was given, with no choice to delete it', async () => {
    render(<StudyHome uid="u" onNext={() => {}} onSignOut={() => {}} />, ready('levels'));
    act(() => button(/Withdraw from the study/)!.click());
    expect(host!.textContent).toContain('What you already gave is kept under your participant code');
    expect(host!.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(withdraw).not.toHaveBeenCalled();
    await act(async () => button(/^Withdraw$/)!.click());
    expect(withdraw).toHaveBeenCalledWith('P-0004', { at: expect.any(Number) });
  });

  it('is shown in Filipino alone when the participant chose it', () => {
    render(<StudyHome uid="u" onNext={() => {}} onSignOut={() => {}} />, ready('pre-test'), 'fil');
    expect(button(/SAGUTAN ANG PRE-TEST/)).toBeDefined();
    expect(host!.querySelector('[aria-current="step"]')!.textContent).toBe('Pre-test');
    expect(host!.textContent).toContain('Tungkol sa iyo');
    expect(host!.textContent).not.toContain('About you');
  });

  it('offers no next step and no withdrawal once withdrawn', () => {
    render(<StudyHome uid="u" onNext={() => {}} onSignOut={() => {}} />, ready('withdrawn'));
    expect(host!.textContent).toContain('You have withdrawn from the study');
    expect(button(/NEXT STEP/)).toBeUndefined();
    expect(button(/Withdraw from the study/)).toBeUndefined();
  });
});

describe('the consent step', () => {
  const fill = (age: string) => {
    type('#consent-name', 'Juan dela Cruz');
    type('#consent-age', age);
    type('#consent-signature', 'Juan dela Cruz');
    act(() => (host!.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  };
  const submit = async () => act(async () => host!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  it('saves the name, age and username to the consent record, none of them to its marker, then moves on', async () => {
    const onDone = vi.fn();
    render(<ConsentStep uid="u1" code="P-0004" username="juan_2026" onDone={onDone} />, ready('consent'));
    fill('24');
    await submit();
    expect(saveConsent).toHaveBeenCalledWith('u1', {
      consent: expect.objectContaining({ participantCode: 'P-0004', fullName: 'Juan dela Cruz', age: 24, variant: 'adult', username: 'juan_2026' }),
      marker: expect.not.objectContaining({ fullName: expect.anything() }),
    });
    const { marker } = (saveConsent.mock.calls[0] as unknown[])[1] as { marker: Record<string, unknown> };
    expect(Object.keys(marker)).not.toContain('username');
    expect(Object.keys(marker)).not.toContain('age');
    expect(onDone).toHaveBeenCalled();
  });

  it('records the language its text was read in, on the record and its marker', async () => {
    render(<ConsentStep uid="u1" code="P-0004" username="juan_2026" onDone={() => {}} />, ready('consent'), 'fil');
    expect(host!.textContent).toContain('Ano ang pag-aaral na ito');
    expect(host!.textContent).not.toContain('What this study is');
    fill('24');
    await submit();
    expect(saveConsent).toHaveBeenCalledWith('u1', {
      consent: expect.objectContaining({ consentLanguage: 'fil' }),
      marker: expect.objectContaining({ consentLanguage: 'fil' }),
    });
  });

  it('stops anyone under 18 and saves nothing', async () => {
    const onDone = vi.fn();
    render(<ConsentStep uid="u1" code="P-0004" username="juan_2026" onDone={onDone} />, ready('consent'));
    fill('17');
    await submit();
    expect(saveConsent).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(host!.textContent).toContain('this study is for people 18 and older');
    expect(host!.textContent).toContain('Nothing you typed was saved');
  });
});
