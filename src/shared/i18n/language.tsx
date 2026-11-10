/**
 * The language's components: the provider the app wraps every
 * screen in, a text placed as a component, and the switch. The context and
 * its hooks are `useText.ts`.
 */
import { useEffect, type ReactNode } from 'react';
import { LANGUAGES, type Localized } from '@/shared/lib/localized';
import { LanguageContext, useLanguage, useText, type LanguageChoice } from './useText';

/** Also names the page's language, for screen readers and the browser's own translation offer. */
export const LanguageProvider = ({ value, children }: { value: LanguageChoice; children: ReactNode }) => {
  useEffect(() => {
    document.documentElement.lang = value.language;
  }, [value.language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/** A text in the chosen language, where a component is easier to place than a call. */
export const Say = ({ en, fil }: Localized) => <>{useText()({ en, fil })}</>;

/**
 * The two languages as a small switch, so a player who cannot read the one
 * shown can still find theirs.
 */
export const LanguageSwitch = ({ className = '' }: { className?: string }) => {
  const { language, choose } = useLanguage();
  return (
    <div role="group" aria-label="Language / Wika" className={`flex items-center gap-1 text-xs ${className}`}>
      {LANGUAGES.map(option => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={language === option}
          onClick={() => choose(option)}
          className={`rounded-md px-1.5 py-1 font-semibold transition-colors ${
            language === option ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option === 'en' ? 'EN' : 'FIL'}
        </button>
      ))}
    </div>
  );
};
