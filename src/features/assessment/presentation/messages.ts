/**
 * What these screens say, in one table for the team to fill. A text
 * with no `fil` shows in English until the team writes it, under
 * the team's style guide. A developers' report lists them.
 */
import type { Localized } from '@/shared/lib/localized';

export const testMessages = {
  question: (position: number, total: number): Localized => ({ en: `Question ${position} of ${total}` }),
  timeLeft: { en: 'Time left' },
  pictureAlt: { en: 'The sign or picture this question asks about' },
  finish: { en: 'Finish' },
  next: { en: 'Next' },
  continueLaterClock: { en: 'Continue later (the clock keeps running)' },
  loading: { en: 'Loading…' },
  back: { en: 'Back' },
  notNow: { en: 'Not now' },
  continueLater: { en: 'Continue later' },
  saving: { en: 'Saving your answers…' },
  saveFailed: { en: "Your answers couldn't be saved. They are safe on the server: check your connection and try again." },
  answerNotSaved: { en: "Not saved yet: check your connection, then press the button again. The clock keeps running." },
  tryAgain: { en: 'Try again' },
  saved: { en: 'Your answers are saved. Thank you.' },
  backToMenu: { en: 'Back to the menu' },
} as const;

const answerRules = {
  oneAtATime: { en: "One question at a time: choose an answer, then press Next. An answer counts once you press Next, and you can't go back to a question." },
  noScore: { en: "You won't see a score or which answers were right. This is not a pass or fail: answer from what you know now, without looking anything up." },
};

export const preTestMessages = {
  ...answerRules,
  title: { en: 'Pre-test' },
  count: (size: number): Localized => ({ en: `${size} questions on the rules of the road.` }),
  time: (minutes: number): Localized => ({ en: `You have ${minutes} minutes for the whole test. The clock keeps running if you leave, and carries on from any device you sign in on. Questions left when it ends count as not answered.` }),
  start: { en: 'Start the pre-test' },
  continue: { en: 'Continue the pre-test' },
  notParticipant: { en: "The pre-test is for the study's participants. Sign in with your participant account to take it." },
  couldNotOpen: { en: "Couldn't open the pre-test. Check your connection and try again." },
  notReady: { en: "The pre-test isn't ready yet. Please tell the researchers." },
  preview: (count: number | null, size: number): Localized => ({
    en: `Preview: nothing is saved.${count !== null ? ` ${count} test items are switched on; a participant's sitting opens only with ${size}.` : ''}`,
  }),
};

export const postTestMessages = {
  ...answerRules,
  title: { en: 'Post-test' },
  count: (size: number): Localized => ({ en: `Two parts of ${size} questions on the rules of the road. The questions in the second part depend on your answers in the first.` }),
  time: (minutes: number): Localized => ({ en: `You have ${minutes} minutes for each part. The clock keeps running if you leave, and carries on from any device you sign in on. Questions left when it ends count as not answered.` }),
  start: { en: 'Start the post-test' },
  continue: { en: 'Continue the post-test' },
  notParticipant: { en: "The post-test is for the study's participants. Sign in with your participant account to take it." },
  couldNotOpen: { en: "Couldn't open the post-test. Check your connection and try again." },
  notReadyPreTest: { en: 'The post-test opens after your pre-test is saved.' },
  notReadyDesign: { en: "The post-test isn't ready yet. It opens once the researchers have prepared it." },
  notReadyItems: { en: "The post-test isn't ready yet. Please tell the researchers." },
  preview: (count: number | null): Localized => ({
    en: `Preview: nothing is saved.${count !== null ? ` ${count} of the routing block's items could be read.` : ''}`,
  }),
  part: (stageIndex: number): Localized => ({ en: `Part ${stageIndex + 1} of 2` }),
  part1Done: { en: 'Part 1 is done.' },
  part2: (size: number, minutes: number): Localized => ({ en: `Part 2 has ${size} questions and its own ${minutes} minutes, which start when you press the button below.` }),
  startPart2: { en: 'Start part 2' },
};
