/**
 * The language the screens are shown in, as one context every
 * feature's screens read. It holds no storage: the auth feature keeps the
 * choice, per device and per account, and the app passes it in through
 * `LanguageProvider`.
 *
 * `useText` turns a `Localized` into what the screen shows. A missing
 * Filipino text shows the English; in a development build that English is
 * marked `[EN]`, and warned about once, so an untranslated screen is seen.
 */
import { createContext, useCallback, useContext } from 'react';
import { DEFAULT_LANGUAGE, shownIn, type Language, type TextOf } from '@/shared/lib/localized';

export type { TextOf };

export interface LanguageChoice {
  language: Language;
  /** True once a language was chosen on this device or for this account. */
  chosen: boolean;
  choose: (language: Language) => void;
}

export const LanguageContext = createContext<LanguageChoice>({ language: DEFAULT_LANGUAGE, chosen: false, choose: () => {} });

/** The fallback mark a development build puts on English shown in place of Filipino. */
export const FALLBACK_MARK = '[EN] ';

const warned = new Set<string>();

export const useLanguage = (): LanguageChoice => useContext(LanguageContext);

/** The text in the chosen language. */
export const useText = (): TextOf => {
  const { language } = useLanguage();
  return useCallback<TextOf>(
    localized => {
      const shown = shownIn(localized, language);
      if (!shown.fallback || !import.meta.env.DEV) return shown.text;
      if (!warned.has(localized.en)) {
        warned.add(localized.en);
        console.warn(`[i18n] No Filipino for: ${localized.en}`);
      }
      return FALLBACK_MARK + shown.text;
    },
    [language]
  );
};
