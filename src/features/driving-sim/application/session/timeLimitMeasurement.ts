/**
 * How a level's time limit is measured, in one place, so it can be measured
 * again whenever the content moves.
 *
 * A level's longest correct drive is the longest reference drive over:
 * - every roll of `ROLL_SEEDS`, where the level rolls (Levels 1-5 and 12), or
 *   its one road where it does not;
 * - and, on the longest of those rolls, every practice item the routing FSM's
 *   `+ practice(c)` could append there: any portable item, of any competency,
 *   from this level or an earlier one (`remediationCandidates`). The final
 *   exam and the tutorial take none.
 *
 * An appended item lengthens the road by the level's own last spacing,
 * whatever was rolled, so the longest roll with the longest item is the
 * longest drive the level can be.
 *
 * Every roll must be driven correctly (`isCorrectDrive`), or the level is not
 * measured at all. A practice item the reference driver cannot drive correctly
 * where it is appended is listed on the level's row (`unpassed`) and its drive
 * left out of the longest, because a wrong drive measures nothing; the list is
 * part of the record, so an item is never dropped unseen.
 *
 * `timeLimitFingerprint` names the content a limit was measured on, so a test
 * can say when a change to it (spacing, speed, a scenario) needs a re-measure.
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import { asPracticeItem } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { buildLevelConfig, getPooledSlots, LEVELS, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import { limitSecondsFor, DRIVING_STEPS_PER_SECOND, type LevelTimeLimit } from '@/features/driving-sim/domain/scenario/levelTimeLimits';
import { isTutorial } from '@/features/driving-sim/domain/systems/tutorial';
import { FINAL_EXAM_LEVEL } from '@/domain/routing/routingTypes';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import { rng } from './driveSamples';
import { driveReference, isCorrectDrive, referenceCruise, type ReferenceDriveResult } from './referenceDrive';

/** The rolls a pooled level is measured over. Fixed, so a re-measure on the same content gives the same limit. */
export const ROLL_SEEDS: readonly number[] = Array.from({ length: 20 }, (_, i) => i + 1);

/** The level as rolled for `seed`, or its one road where it does not roll. */
export const rollFor = (levelId: number, seed: number): LevelConfig =>
  buildLevelConfig(levelId, undefined, null, rng(seed * 31 + 7))!;

/** Whether the routing FSM can append practice to this level. */
const takesPractice = (level: LevelConfig): boolean => !isTutorial(level) && level.id !== FINAL_EXAM_LEVEL;

/** Every item `+ practice(c)` could append to this level, for any c. */
export const practiceItemsFor = (levelId: number): SlotVariant[] => {
  const seen = new Set<string>();
  return COMPETENCIES.flatMap(competency => remediationCandidates(competency, levelId))
    .filter(candidate => !seen.has(candidate.variant.id) && Boolean(seen.add(candidate.variant.id)))
    .map(asPracticeItem);
};

/** FNV-1a, as the drive golden digests a trace. */
const digest = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

/**
 * The content a level's limit depends on: its road as declared, every variant
 * it can roll and every practice item it can take. Any change to them, a
 * scenario moved or a speed changed, changes this.
 */
export const timeLimitFingerprint = (levelId: number): string => {
  const level = LEVELS.find(entry => entry.id === levelId)!;
  return digest(
    JSON.stringify({
      level,
      pooled: getPooledSlots(levelId),
      practice: takesPractice(level) ? practiceItemsFor(levelId) : [],
      cruise: referenceCruise(level),
    })
  );
};

export interface MeasuredDrive {
  roll: number | null;
  item: string | null;
  result: ReferenceDriveResult;
}

export interface LevelMeasurement {
  row: LevelTimeLimit;
  /** Rolls the reference driver got wrong: a measurement with any is not one. */
  failures: MeasuredDrive[];
}

/** Why a drive is not a correct one, in a line. */
export const whyNotCorrect = (result: ReferenceDriveResult): string =>
  [
    !result.finished && 'did not reach the end',
    result.crash && `crashed: ${result.crash.split('.')[0]}`,
    result.penalties > 0 && `${result.penalties} standing penalt${result.penalties === 1 ? 'y' : 'ies'}`,
    ...result.decisions.filter(decision => !decision.correct).map(d => `${d.id} graded ${d.action}, not ${d.expected}`),
  ]
    .filter(Boolean)
    .join('; ');

/** Measures one level's limit. */
export const measureLevelTimeLimit = (levelId: number): LevelMeasurement => {
  const base = LEVELS.find(entry => entry.id === levelId)!;
  const pooled = getPooledSlots(levelId) !== null;
  const drives: MeasuredDrive[] = [];

  const seeds = pooled ? ROLL_SEEDS : [ROLL_SEEDS[0]];
  for (const seed of seeds) {
    drives.push({ roll: pooled ? seed : null, item: null, result: driveReference(rollFor(levelId, seed), { seed }) });
  }
  const failures = drives.filter(drive => !isCorrectDrive(drive.result));
  const longestRoll = drives.reduce((a, b) => (b.result.drivenSteps > a.result.drivenSteps ? b : a));

  if (takesPractice(base)) {
    const seed = longestRoll.roll ?? ROLL_SEEDS[0];
    const rolled = rollFor(levelId, seed);
    const onRoute = new Set(rolled.events.map(event => event.id));
    for (const item of practiceItemsFor(levelId).filter(candidate => !onRoute.has(candidate.id))) {
      drives.push({
        roll: longestRoll.roll,
        item: item.id,
        result: driveReference(withRemediation(rolled, item), { seed }),
      });
    }
  }

  const correct = drives.filter(drive => isCorrectDrive(drive.result));
  const longest = correct.reduce((a, b) => (b.result.drivenSteps > a.result.drivenSteps ? b : a), correct[0] ?? drives[0]);
  const limitSeconds = limitSecondsFor(longest.result.drivenSteps);
  return {
    row: {
      levelId,
      limitSeconds,
      limitSteps: limitSeconds * DRIVING_STEPS_PER_SECOND,
      longestSteps: longest.result.drivenSteps,
      longestRoll: longest.roll,
      longestItem: longest.item,
      drives: drives.length,
      fingerprint: timeLimitFingerprint(levelId),
      unpassed: drives
        .filter(drive => drive.item !== null && !isCorrectDrive(drive.result))
        .map(drive => ({ item: drive.item!, why: whyNotCorrect(drive.result) })),
    },
    failures,
  };
};
