/**
 * The full adaptive decision for one level entry, and the route it decided
 * over: which competency the player is weakest at (BKT), which single extra
 * scenario — if any — is appended to practise it, and the support level and θ
 * the whole level is played at.
 *
 * It happens here rather than mid-drive because cross-level practice needs the
 * player's whole history, and the drive loop only ever sees the current run.
 *
 * The attempt's route is rolled here too, before the practice item is picked,
 * because the pick has to see it: a scenario the route already holds cannot be
 * appended to it (`withRemediation`), so choosing one used to leave the record
 * naming an injected scenario that was never added. Rolling once and
 * carrying the finished level means the route the item was chosen against and
 * the route the player drives cannot be two different routes.
 *
 * `options` are the adaptive layer's repairs; the game plays `GAME_OPTIONS`,
 * and a test can pass `LEGACY_OPTIONS` to see the entry as the game-level
 * simulation played it.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { getLowestScoringCompetency } from '@/domain/learner/profile';
import type { SupportLevel, WeakArea } from '@/domain/learner/competency';
import {
  MASTERY_THRESHOLD,
  adaptsLevel,
  decidePractice,
  levelSupport,
  practiceFor,
  type PracticeChoice,
} from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { GAME_OPTIONS, type AdaptiveOptions } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import { attemptStream } from '@/features/driving-sim/domain/scenario/attemptSeed';
import { buildLevelConfig, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  recordPolicyDecision,
  type PolicyDecisionRecord,
} from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import { loadSignCoverage } from '../signCoverage';
import { historyLogs, loadLearnerHistory } from '../learnerHistory';

export interface AdaptivePlan {
  /**
   * Biases the level's own pool roll, and the pre-level hint. Null on the
   * final exam unless `finalExamRollBias` is on.
   */
  weakArea: WeakArea | null;
  /** The one scenario to append, plus the FSM θ chosen for this entry. */
  practice: PracticeChoice | null;
  /**
   * The level to drive: this attempt's roll with the practice item already on
   * the end of it. Null only for a level id with no content behind it, which
   * `buildLevelConfig` answers for.
   */
  level: LevelConfig | null;
  /** What every scenario in the level shows while it is presented. */
  support: SupportLevel;
  /**
   * The decision as the per-decision record keeps it: the state the policy
   * read, what it chose, from which table, and what the level was played at -
   * including when the level was not adapted, and why.
   */
  record: PolicyDecisionRecord;
  /**
   * The learner's graded history as this plan read it, oldest first. The
   * mid-drive re-roll reads BKT over it, ahead of the run's own logs, where
   * `rerollHistory` is `full`, so the drive and the entry share one belief.
   */
  priorLogs: ActionLog[];
  /** Why, in one line. Read only by the DEV console log in the story layout. */
  explanation: string;
}

export const buildAdaptivePlan = async (
  uid: string | null,
  levelId: number,
  /** The attempt's seed: the roll and the practice pick each draw from it. */
  attemptSeed: number,
  options: AdaptiveOptions = GAME_OPTIONS
): Promise<AdaptivePlan> => {
  const logs = historyLogs(await loadLearnerHistory(uid));
  const adapts = adaptsLevel(levelId);
  const tieBreak = options.weakestTieBreak;

  // The final exam takes no practice item, no θ and no support level from the
  // policy, and - unless `finalExamRollBias` is on - no weak area either: it
  // is the same test for every learner, so its roll reads no history, and its
  // briefing promises no extra questions it will not bring.
  const decision = adapts ? decidePractice(logs, tieBreak) : null;

  const profile = logs.length > 0 ? buildBKTLearnerProfile(logs) : null;
  const competency = profile ? getLowestScoringCompetency(profile, tieBreak) : null;
  const score = profile && competency ? profile[competency].score : null;
  const weakArea: WeakArea | null =
    (adapts || options.finalExamRollBias) && competency !== null && score !== null && score < MASTERY_THRESHOLD
      ? { competency, score }
      : null;

  // The roll first, then the pick against what it rolled. The two draw from
  // streams of their own, so reading the route here takes nothing from the
  // roll and changes no attempt's content.
  const rolled = buildLevelConfig(
    levelId,
    loadSignCoverage(),
    weakArea?.competency ?? null,
    attemptStream(attemptSeed, 'roll')
  );
  const practice = rolled
    ? practiceFor(
        decision,
        levelId,
        attemptStream(attemptSeed, 'practice'),
        new Set(rolled.events.map(event => event.id))
      )
    : null;
  const support = levelSupport(levelId, practice);
  const record = recordPolicyDecision({ history: logs, decision, practice, adapts, support, tieBreak });
  const level = rolled && practice ? withRemediation(rolled, practice.variant) : rolled;

  return {
    weakArea,
    practice,
    level,
    support,
    record,
    priorLogs: logs,
    explanation:
      logs.length === 0
        ? 'No history yet: playing the level exactly as authored.'
        : practice
          ? `practising ${practice.competency}` +
            (practice.competency !== practice.weakestCompetency
              ? ` (stand-in for ${practice.weakestCompetency})`
              : '') +
            ` at support ${support}, approach window x${practice.transitionParams.approachScale},` +
            ` borrowed from level ${practice.sourceLevelId} (${practice.variant.id}). ${practice.reason}`
          : adapts
            ? `nothing injected (weakest is ${competency} at ${score}); support ${support}.`
            : `final exam: nothing adapted; support ${support}.`,
  };
};
