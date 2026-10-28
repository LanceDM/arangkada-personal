/**
 * Every setting the study's algorithms run with, in one record, and the
 * version tag stamped on every logged event, BKT update and Q-table update.
 *
 * The database keeps a copy of each version (`configVersions/{tag}`, and the
 * active one in `policy/config`), written by `npm run db:init`. When the panel
 * changes a value, the tag is bumped, so every logged record says which
 * settings produced it and an analysis can replay the logs under another one.
 *
 * `runConfig.test.ts` pins a fingerprint of this record: changing any value
 * without bumping RUN_CONFIG_VERSION fails the test.
 */
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { MASTERY_CUTOFFS, MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING } from '@/domain/competencyRouting/mastery';
import { DEFAULT_REWARD, DEFAULT_WARM_UP, GAMMA } from '@/domain/competencyRouting/qLearning';
import { COMPETENCY_ATTEMPT_CAP } from '@/domain/competencyRouting/course';
import {
  DIAGNOSTIC_ITEMS_PER_COMPETENCY,
  DRIVE_ITEMS_PER_COMPETENCY,
  DRIVE_PASS_CORRECT,
  QUIZ_ATTEMPT_CAP,
  QUIZ_ITEMS_PER_COMPETENCY,
  QUIZ_PASS_CORRECT,
  STAGE_COMPETENCIES,
} from '@/domain/learner/stageCompetencies';
import { BACKGROUND_FORM_ENABLED, BACKGROUND_FORM_VERSION } from './backgroundForm';

/** Bump when any value below changes: `<date><letter>`. */
export const RUN_CONFIG_VERSION = '2026-10-28a';

export const RUN_CONFIG = {
  bktModel: DEFAULT_BKT_MODEL,
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
    diagnosticItemsPerCompetency: DIAGNOSTIC_ITEMS_PER_COMPETENCY,
  },
  stageCompetencies: STAGE_COMPETENCIES,
  backgroundForm: { enabled: BACKGROUND_FORM_ENABLED, version: BACKGROUND_FORM_VERSION },
  irt: { model: 'rasch', itemParameters: 'shared', status: 'undecided' },
} as const;

export type RunConfig = typeof RUN_CONFIG;

/** A stable text form of the config: keys sorted at every level. */
export const canonicalJSON = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

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
