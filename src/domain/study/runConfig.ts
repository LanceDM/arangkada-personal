/**
 * Every setting the redesigned course runs with, in one record, and the version
 * tag stamped on every BKT update and Q-table update, so each logged record says
 * which settings produced it and an analysis can replay the logs under another.
 *
 * `runConfig.test.ts` pins a fingerprint of this record: changing any value
 * without bumping RUN_CONFIG_VERSION fails the test.
 */
import { EVIDENCE_BKT_MODEL } from '@/domain/learner/mastery/evidenceBKT';
import { MASTERY_CUTOFFS, MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING } from '@/domain/competencyRouting/mastery';
import { DEFAULT_REWARD, DEFAULT_WARM_UP, GAMMA } from '@/domain/competencyRouting/qLearning';
import { COMPETENCY_ATTEMPT_CAP } from '@/domain/competencyRouting/course';
import {
  DRIVE_ITEMS_PER_COMPETENCY,
  DRIVE_PASS_CORRECT,
  QUIZ_ATTEMPT_CAP,
  QUIZ_ITEMS_PER_COMPETENCY,
  QUIZ_PASS_CORRECT,
  STAGE_COMPETENCIES,
} from '@/domain/learner/stageCompetencies';

/** Bump when any value below changes: `<date><letter>`. */
export const RUN_CONFIG_VERSION = '2026-11-17c';

export const RUN_CONFIG = {
  bktModel: EVIDENCE_BKT_MODEL,
  masteryCutoffs: MASTERY_CUTOFFS,
  minDriveEvidenceForLevel4: MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING,
  reward: DEFAULT_REWARD,
  gamma: GAMMA,
  learningRate: '1/n',
  warmUp: DEFAULT_WARM_UP,
  rules: {
    competencyAttemptCap: COMPETENCY_ATTEMPT_CAP,
    driveItemsPerCompetency: DRIVE_ITEMS_PER_COMPETENCY,
    drivePassCorrect: DRIVE_PASS_CORRECT,
    quizItemsPerCompetency: QUIZ_ITEMS_PER_COMPETENCY,
    quizPassCorrect: QUIZ_PASS_CORRECT,
    quizAttemptCap: QUIZ_ATTEMPT_CAP,
    unansweredInBKT: false,
    preTestSeedsBKT: true,
    postTestRewardsQ: false,
    // A drive ended early (crash, time-up) measures only the topics it asked.
    endedDriveMeasuresAskedOnly: true,
  },
  stageCompetencies: STAGE_COMPETENCIES,
  irt: { model: 'rasch', scope: 'pre-test and post-test only, off gameplay' },
  // What each record keeps so every result can be recomputed later from it alone.
  recorded: { courseDriveSeedAndComposition: true, courseQuizShownOrder: true },
} as const;

export type RunConfig = typeof RUN_CONFIG;

export { canonicalJSON } from './canonical';
import { canonicalJSON } from './canonical';

/** FNV-1a, 32-bit, as 8 hex digits: a fingerprint, not security. */
export const fingerprint = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const RUN_CONFIG_FINGERPRINT = (): string => fingerprint(canonicalJSON(RUN_CONFIG));
