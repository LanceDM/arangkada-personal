// The level a player drives outside the study course: a guest, a signed-in
// account that is not a study account, Legacy or New routing, a free replay
// (2026-11-16, future work).
//
// Levels 6 and 8-11 play the study course's draw here too: three scenarios per
// competency the stage teaches, unseen first, borrowed by competency from any
// stage 1-11, never an `offRoad` one (`composeDrive`), seeded by the attempt's
// roll stream so a reload rebuilds the same drive. No seen history reaches these
// paths, so every scenario counts as unseen. Nothing here is recorded as the
// course's: no cursor, no `seen`, no Q-table.
//
// Every other level is `buildLevelConfig`'s roll, unchanged. Level 7 stays as
// authored: its slots are the expressway road itself. `buildLevelConfig` itself
// is left as it was, because the frozen design's simulations call it and must
// keep reproducing.
import type { DrivingCompetency } from '@/domain/learner/competency';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { composeDrive } from './composeDrive';
import { buildLevelConfig, withRemediation } from './levelCatalog';
import type { SlotVariant } from './pooling';
import type { LevelConfig } from './scenarioDefinition';

/** The stages normal play composes as the course does. */
export const COMPOSED_IN_PLAY = [6, 8, 9, 10, 11] as const;
type ComposedStage = (typeof COMPOSED_IN_PLAY)[number];
const isComposed = (levelId: number): levelId is ComposedStage =>
  (COMPOSED_IN_PLAY as readonly number[]).includes(levelId);

/** `buildLevelConfig`'s signature, so each game call site swaps one name. */
export const buildPlayLevel = (
  levelId: number,
  coverage?: SignCoverage,
  weakCompetency?: DrivingCompetency | null,
  rng?: () => number,
  remediation?: SlotVariant | null
): LevelConfig | null => {
  if (!isComposed(levelId)) return buildLevelConfig(levelId, coverage, weakCompetency, rng, remediation);
  const { level } = composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: rng ?? Math.random });
  return remediation ? withRemediation(level, remediation) : level;
};
