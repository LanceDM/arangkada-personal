import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const levelModule = getLevelModule(0);

const startAccelerateSlot: SlotVariant[] = [
  {
    id: 'level0.start-accelerate',
    type: 'speed_limit',
    description: 'Start line: press Up or W',
    correctAction: 'accelerate',
    points: 10,
    penaltyMessage: 'Start by pressing W or the Up arrow.',
    rewardMessage: 'Good start. You can now move the vehicle.',
    duration: 200,
  },
];

const steerLeftPracticeSlot: SlotVariant[] = [
  {
    id: 'level0.steer-left-practice',
    type: 'obstacle_ahead',
    description: 'Practice cones: steer left',
    correctAction: 'turn_left',
    points: 15,
    penaltyMessage: 'Use A or the Left arrow to steer left.',
    rewardMessage: 'Nice left steer.',
    duration: 200,
  },
];

const steerRightPracticeSlot: SlotVariant[] = [
  {
    id: 'level0.steer-right-practice',
    type: 'obstacle_ahead',
    description: 'Practice cones: steer right',
    correctAction: 'turn_right',
    points: 15,
    penaltyMessage: 'Use D or the Right arrow to steer right.',
    rewardMessage: 'Nice right steer.',
    duration: 200,
  },
];

const slowZoneSlot: SlotVariant[] = [
  {
    id: 'level0.slow-zone',
    type: 'obstacle_ahead',
    description: 'Slow zone ahead',
    correctAction: 'brake',
    points: 20,
    penaltyMessage: 'Hold S, Down, or Space to slow down before hazards.',
    rewardMessage: 'Good braking. You slowed before the hazard.',
    duration: 200,
  },
];

const fullStopCheckpointSlot: SlotVariant[] = [
  {
    id: 'level0.full-stop-checkpoint',
    type: 'stop_sign',
    description: 'Stop line: hold brake',
    correctAction: 'stop',
    points: 25,
    penaltyMessage: 'For a full stop, keep holding brake until the speed reaches 0.',
    rewardMessage: 'Full stop completed. You are ready for Level 1.',
    duration: 200,
  },
];

export const SLOT_DISTANCES = [260, 760, 1260, 1850, 2450];
export const SLOTS: SlotVariant[][] = [startAccelerateSlot, steerLeftPracticeSlot, steerRightPracticeSlot, slowZoneSlot, fullStopCheckpointSlot];

export const level0: LevelConfig = {
  id: 0,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  roadLength: 3000,
  speedLimit: 40,
  requiredScore: 55,
  stars2: 70,
  stars3: 85,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
};
