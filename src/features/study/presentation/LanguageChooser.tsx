import { Button } from '@/shared/ui/button';
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '@/shared/lib/localized';
import { useLanguage } from '@/shared/i18n/useText';

/**
 * The first screen of joining: the language the study is shown in,
 * chosen before anything else is read. Each language is named in itself, so
 * it reads whichever the participant knows. It can be changed later, on any
 * study screen and in Settings; the account keeps it.
 */
export const LanguageChooser = ({ onChosen }: { onChosen: (language: Language) => void }) => {
  const { language, chosen, choose } = useLanguage();
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        Choose a language. You can change it later in Settings.
      </p>
      <div className="grid gap-3">
        {LANGUAGES.map(option => (
          <Button
            key={option}
            lang={option}
            size="lg"
            variant={chosen && language === option ? 'default' : 'outline'}
            className="h-16 w-full font-display text-lg font-bold"
            onClick={() => {
              choose(option);
              onChosen(option);
            }}
          >
            {LANGUAGE_NAMES[option]}
          </Button>
        ))}
      </div>
    </div>
  );
};
