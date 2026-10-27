/**
 * Driving Sim's public API.
 *
 * Story mode's product workflow (map -> briefing -> drive -> results) is
 * composed in `src/pages/story`; this is the code it composes. The level
 * catalogue is exported because the ladder, the lesson route and the admin rule
 * report all need to read the curriculum without owning it.
 */
export { default as GameScreen } from './presentation/ui/GameScreen';
export { default as MissionBriefing } from './presentation/ui/MissionBriefing';
export { default as LessonReader } from './presentation/ui/LessonReader';

export { LEVELS } from './domain/scenario/levelCatalog';
export { getLevelModule, LEVEL_MODULES } from './domain/scenario/content/lessons/lessonCatalog';
export { buildAdaptivePlan } from './application/use-cases/buildAdaptivePlan';
export { startMission } from './application/use-cases/startMission';
export {
  completeMission,
  completeCourseAttempt,
  completeFreeReplay,
  completePostTest,
} from './application/use-cases/completeMission';
export { nextAttemptSeed } from './application/attemptSeed';
export { markLessonsRead } from './application/briefingProgress';

// The routing FSM in the game, behind the Legacy / New switch.
export { default as RoutingGroupOverride } from './presentation/ui/RoutingGroupOverride';
export {
  resolveRoutingGroup,
  routingGroupNow,
  loadRoutingOverride,
  saveRoutingOverride,
} from './application/use-cases/resolveRoutingGroup';
export {
  loadCourseCursor,
  startCourseEntry,
  startFreeReplay,
  startPostTest,
} from './application/use-cases/startCourseEntry';
export { cursorFrontierLevel } from './domain/adaptive/courseRouting';
export { postTestNote } from './domain/adaptive/pilotPostTest';
export type { RoutingGroupResolution } from './application/use-cases/resolveRoutingGroup';
export type { CourseRun, FreeReplayRun } from './application/use-cases/startCourseEntry';
export type { RoutingOverride } from './application/ports';
export type { RoutingCursor, GroupInEffect } from './domain/adaptive/courseRouting';
export type { CourseNote } from './domain/adaptive/routingBriefing';

export type { LevelConfig, ScenarioEvent } from './domain/scenario/scenarioDefinition';
export type { LevelFsmTelemetry } from './domain/fsm/fsmMetrics';
export type { AdaptivePlan } from './application/use-cases/buildAdaptivePlan';
export type { AttemptStart } from './application/use-cases/completeMission';
export type { LevelRecommendation, PracticeChoice } from './domain/adaptive/practiceSelection';
