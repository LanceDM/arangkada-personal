/**
 * The level to actually drive, for this attempt.
 *
 * The attempt's own route is rolled with its adaptive plan, biased by what
 * this learner still needs — sign coverage so each attempt shows the plates
 * they have not met, the weak competency so the pools lean toward it — and the
 * plan's one practice scenario is already on the end of it. Handing that level
 * back rather than rolling a second one is what keeps the route the practice
 * item was chosen against and the route the player drives the same route.
 *
 * Before the plan lands there is no attempt yet, only a screen to fill: the
 * briefing is shown against an unseeded roll of the level as authored, which
 * is replaced the moment the plan settles, before the drive can be entered.
 *
 * A use case rather than a call the page makes itself, so which of the two a
 * screen is looking at is decided in one place instead of in the route.
 */
import { buildLevelConfig } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { loadSignCoverage } from '../signCoverage';
import type { AdaptivePlan } from './buildAdaptivePlan';

export const startMission = (levelId: number, plan: AdaptivePlan | null): LevelConfig | null =>
  plan ? plan.level : buildLevelConfig(levelId, loadSignCoverage());
