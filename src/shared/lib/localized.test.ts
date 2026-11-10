import { describe, expect, it } from 'vitest';
import { isLanguage, shownIn } from './localized';

describe('a text in the chosen language', () => {
  it('shows the Filipino where there is one, and English otherwise', () => {
    expect(shownIn({ en: 'Brake', fil: 'Preno' }, 'fil')).toEqual({ text: 'Preno', fallback: false });
    expect(shownIn({ en: 'Brake', fil: 'Preno' }, 'en')).toEqual({ text: 'Brake', fallback: false });
  });

  it('falls back to English, saying so, where the Filipino is missing or empty', () => {
    expect(shownIn({ en: 'Brake' }, 'fil')).toEqual({ text: 'Brake', fallback: true });
    expect(shownIn({ en: 'Brake', fil: '' }, 'fil')).toEqual({ text: 'Brake', fallback: true });
    expect(shownIn({ en: 'Brake' }, 'en')).toEqual({ text: 'Brake', fallback: false });
  });

  it('knows the two languages and nothing else', () => {
    expect(['en', 'fil'].every(isLanguage)).toBe(true);
    expect(['tl', 'EN', '', null, 1].some(isLanguage)).toBe(false);
  });
});
