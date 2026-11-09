/**
 * Text in the languages a player may choose: English, or Filipino as
 * licence applicants speak it.
 *
 * English is required and Filipino optional, so a text the team has not
 * translated yet still reads, in English. Which language a record was shown
 * in is recorded beside it; what is graded and every answer key never depend
 * on it.
 */

export type Language = 'en' | 'fil';

export const LANGUAGES: readonly Language[] = ['en', 'fil'];

/** Before anyone has chosen, and wherever a translation is missing. */
export const DEFAULT_LANGUAGE: Language = 'en';

/** Each language under its own name, as the chooser shows it. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', fil: 'Filipino' };

export const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'fil';

export interface Localized {
  readonly en: string;
  /** Absent until the team writes it; the English is shown in its place. */
  readonly fil?: string;
}

export interface Shown {
  readonly text: string;
  /** Filipino was asked for and there is none: the English stands in. */
  readonly fallback: boolean;
}

/** A text in one language, or in English where that language has none. */
export const shownIn = (text: Localized, language: Language): Shown =>
  language === 'fil' && text.fil ? { text: text.fil, fallback: false } : { text: text.en, fallback: language === 'fil' };

/** A function from a text to what is shown: `useText` on a screen, `textIn` in domain code. */
export type TextOf = (text: Localized) => string;

/** The text in a language, without the development mark `useText` adds on a screen. */
export const textIn = (language: Language = DEFAULT_LANGUAGE): TextOf => text => shownIn(text, language).text;

/** Domain code's default, so a caller with no language in hand reads as it always did. */
export const englishText: TextOf = text => text.en;
