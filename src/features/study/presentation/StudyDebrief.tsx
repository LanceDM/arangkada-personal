import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import { HelpButton } from './studyParts';
import { studyMessages as m, studyValueMessages as v } from './messages';

/**
 * The end of the study: thanks, what the study was
 * for, and the code. DRAFT: the team writes the debrief; it shows no score,
 * as no study screen does.
 */
export const StudyDebrief = ({ code }: { code: string }) => {
  const text = useText();
  return (
    <div className="space-y-5">
      <h1 className="text-center font-display text-lg font-bold">
        <Say {...m.thankYou} />
      </h1>
      <p className="text-sm">
        {text(v.debrief(code))}
      </p>
      <HelpButton code={code} />
    </div>
  );
};
