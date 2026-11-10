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
  notRecorded: { en: 'Not recorded' },
  mastered: { en: 'Mastered' },
  improving: { en: 'Improving' },
  needsPractice: { en: 'Needs Practice' },
  critical: { en: 'Critical' },
  focus: { en: 'Focus Area' },
  strength: { en: 'Strongest Skill' },
  report: { en: 'What Happened' },
  mastery: { en: 'Skill Breakdown' },
  recent: { en: 'Recent Decisions' },
  stepDid: { en: 'What you did' },
  stepJudged: { en: 'How it was judged' },
  stepNext: { en: 'What happened next' },
  stepPractice: { en: 'Practice next' },
  youChose: (action: string): Localized => ({ en: `You chose ${action}.` }),
  violation: (severity: string, competency: string): Localized => ({ en: `${severity} ${competency} violation detected.` }),
  correctDecision: (competency: string): Localized => ({ en: `${competency} decision was correct.` }),
  shownCorrection: { en: 'You were shown a correction before driving on.' },
  noPenalty: { en: 'You carried on without a penalty.' },
  focusNext: (competency: string): Localized => ({ en: `Focus next practice on ${competency}.` }),
  continueNext: { en: 'Continue to the next scenario.' },
  backToMap: { en: 'Back to Map' },
  crashed: { en: 'CRASHED' },
  timesUp: { en: "TIME'S UP" },
  passed: { en: 'PASSED' },
  failed: { en: 'FAILED' },
  runEnded: { en: 'RUN ENDED' },
  levelComplete: { en: 'LEVEL COMPLETE' },
  tryAgain: { en: 'TRY AGAIN' },
  timesUpNote: {
    en: "Time's up. The level's driving time ran out before you reached the end of the road, so the run counts as a fail whatever you scored. Time spent reading a scenario or answering a question is never counted.",
  },
  score: { en: 'Score' },
  correct: { en: 'Correct' },
  violations: { en: 'Violations' },
  passMark: { en: 'Pass mark' },
  continue: { en: 'CONTINUE →' },
  nextLevel: { en: 'NEXT LEVEL →' },
  practice: (competency: string): Localized => ({ en: `PRACTICE ${competency} →` }),
  retry: { en: 'RETRY' },
  cleanRun: { en: 'You handled this best on this run. Nothing dropped below full marks, so the next level moves on to new ground.' },
  lostMost: { en: 'This is the skill you lost the most points on.' },
  lostMostNextRun: { en: 'This is the skill you lost the most points on. Your next run will put more of it in your way.' },
  expectedChose: (expected: string, chose: string): Localized => ({ en: `Expected ${expected} - chose ${chose}` }),
  signsToRevise: { en: 'Signs and markings to revise' },
  signsToReviseNote: { en: 'These came up on this drive and were answered wrongly. They will be brought back on your next attempts until you get them right.' },
  expectedYou: (expected: string, action: string): Localized => ({ en: `Expected ${expected} — you ${action}.` }),
} as const;
