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
  courseHeading: { en: 'Your course' },
  courseModuleThenQuiz: { en: 'Read the module, then pass its Short Quiz to unlock the drive.' },
  courseDriveNow: { en: 'Your drive is ready: 3 scenarios for each topic of this level.' },
  courseRepeat: (topics: string): Localized => ({ en: `A repeat drive. Extra practice was chosen for: ${topics}.` }),
  courseReview: (topics: string): Localized => ({ en: `Review these parts of the module before you drive: ${topics}.` }),
  courseQuizReview: { en: 'Three quiz attempts are used. Read the module again; your drive comes next.' },
  courseFinal: { en: 'The final exam: one scenario for each of the 11 topics. Pass 70% to be certified.' },
  courseTutorial: { en: 'The tutorial teaches the controls. Nothing in it is graded.' },
  courseVerdict: (topic: string, correct: number, total: number, passed: boolean): Localized => ({ en: `${topic}: ${correct} of ${total}, ${passed ? 'passed' : 'not passed yet'}` }),
  courseNextRepeat: (topics: string): Localized => ({ en: `Extra practice was chosen for: ${topics}. Continue for a repeat drive with 3 more scenarios on it.` }),
  courseNextStage: (level: number): Localized => ({ en: `Level done. Continue to Level ${level}.` }),
  courseNextFinal: { en: 'Every level is done. Continue to the final exam.' },
  courseCertified: { en: 'Final exam passed: you are certified. The post-test is next on your study home.' },
  courseFinalAgain: { en: 'Final exam not passed. Continue to sit it again.' },
  courseDone: { en: 'Your course is complete.' },
} satisfies Record<string, Localized | ((...args: never[]) => Localized)>;
