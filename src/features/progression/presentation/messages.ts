/**
 * What these screens say, in one table for the team to fill. A text
 * with no `fil` shows in English until the team writes it, under
 * the team's style guide. A developers' report lists them.
 */
import type { Localized } from '@/shared/lib/localized';

export const mapMessages = {
  back: { en: 'Back' },
  subtitle: { en: 'Driving Simulation System' },
  totalPoints: { en: 'Total Points' },
  courseComplete: { en: 'COURSE COMPLETE' },
  loadingCourse: { en: 'LOADING YOUR COURSE…' },
  continueCourse: { en: 'CONTINUE COURSE →' },
  finish: { en: 'FINISH' },
  next: { en: 'NEXT' },
  start: { en: 'START' },
  level: (id: number): Localized => ({ en: `LEVEL ${id}` }),
} as const;

export const resultMessages = {
  topicVerdict: (correct: number, total: number, passed: boolean): Localized => ({ en: `${correct} of ${total}, ${passed ? 'passed' : 'not passed'}` }),
  // A crash or time-up ends the drive before its verdict: the count stands, the
  // topic is not called failed.
  topicEnded: (correct: number, total: number): Localized => ({ en: `${correct} of ${total}, drive ended early` }),
  // The rule the course applies, worded for what this drive counted
  // (competencyVerdicts: a topic passes at 2 right, or all of them where it had
  // fewer; the final exam at 70% of its scenarios).
  topicRule: { en: 'Each topic passes at 2 of its 3 scenarios.' },
  topicRuleUneven: { en: 'A topic passes at 2 right, or all of them where it had fewer than 2 scenarios.' },
  finalRule: { en: 'The final exam passes at 70% of its scenarios, one per topic.' },
  endedRule: { en: 'The drive ended early, so no topic is passed on it.' },
  notRecorded: { en: 'Not recorded' },
  // This drive's own counts per topic: the screen shows no mastery estimate.
  topicCount: (correct: number, total: number): Localized => ({ en: `${correct} of ${total} correct` }),
  focus: { en: 'Topic to work on' },
  focusNote: (correct: number, total: number): Localized => ({
    en: `${correct} of ${total} correct on this drive: the topic with the most mistakes.`,
  }),
  cleanHeading: { en: 'This drive' },
  cleanRun: { en: 'No mistakes this drive.' },
  breakdown: { en: 'Topics This Drive' },
  recent: { en: 'Recent Decisions' },
  youAnswered: (label: string): Localized => ({ en: `You answered: ${label}` }),
  noAnswer: { en: 'no answer in time' },
  answerRight: { en: 'Right' },
  answerWrong: { en: 'Wrong' },
  correctIs: (label: string): Localized => ({ en: `Correct: ${label}` }),
  backToMap: { en: 'Back to Map' },
  crashed: { en: 'CRASHED' },
  timesUp: { en: "TIME'S UP" },
  passed: { en: 'PASSED' },
  failed: { en: 'FAILED' },
  runEnded: { en: 'RUN ENDED' },
  levelComplete: { en: 'LEVEL COMPLETE' },
  tryAgain: { en: 'TRY AGAIN' },
  checking: { en: 'CHECKING' },
  driveFinished: { en: 'DRIVE FINISHED' },
  timesUpNote: {
    en: "Time's up. The level's driving time ran out before you reached the end of the road, so the run counts as a fail whatever you scored. Time spent reading a scenario or answering a question is never counted.",
  },
  score: { en: 'Score' },
  correct: { en: 'Correct' },
  violations: { en: 'Violations' },
  // The count the stars are read from (domain/learner/stars): wrong answers,
  // unanswered included; not standing penalties or practice items.
  mistakes: (count: number): Localized => ({
    en: count === 0 ? 'No mistakes' : count === 1 ? '1 mistake' : `${count} mistakes`,
  }),
  passMark: { en: 'Pass mark' },
  continue: { en: 'CONTINUE →' },
  nextLevel: { en: 'NEXT LEVEL →' },
  practice: (competency: string): Localized => ({ en: `PRACTICE ${competency} →` }),
  retry: { en: 'RETRY' },
  expectedChose: (expected: string, chose: string): Localized => ({ en: `Expected ${expected} - chose ${chose}` }),
  signsToRevise: { en: 'Signs and markings to revise' },
  signsToReviseNote: { en: 'These came up on this drive and were answered wrongly. They will be brought back on your next attempts until you get them right.' },
  expectedYou: (expected: string, action: string): Localized => ({ en: `Expected ${expected} — you ${action}.` }),
} as const;
