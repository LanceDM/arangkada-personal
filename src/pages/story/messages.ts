/**
 * What these screens say, in one table for the team to fill. A text
 * with no `fil` shows in English until the team writes it, under
 * the team's style guide. A developers' report lists them.
 */
import type { Localized } from '@/shared/lib/localized';

export const storyMessages = {
  backToHome: { en: 'Back to Home' },
  savingResult: { en: 'Saving your result...' },
  preparingRoute: { en: 'Preparing route...' },
  courseNotLoaded: { en: 'Your course could not be loaded. Check your connection and reload.' },
  loadingCourse: { en: 'Loading your course...' },
  levelNotPrepared: { en: 'That level could not be prepared. Check your connection and try again.' },
  replayOutside: { en: 'A replay outside your course: Continue picks your course up where you left it.' },
  resultNotSaved: { en: 'Your result could not be saved. Continue will give you this step of your course again.' },
} satisfies Record<string, Localized>;
