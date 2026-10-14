/**
 * A turn taken when the screen says to take it.
 *
 * The arrow key that commits a turn is also the arrow key that steers, and a
 * turn is refused from any lane but its own. So a commit zone narrower than the
 * cue that tells the driver to act is a trap: pressing on the cue walks the car
 * out of the turning lane before the junction will accept it, and the junction
 * then refuses the turn it just asked for.
 *
 * It only ever bit one direction, which is why it survived. A right turn is
 * made from the curb lane, so holding right pushes the car *into* the lane it
 * needs; a left turn is made from the lane nearest the centre line, so holding
 * left walks it straight out. Level 6's left turn — 25 points, the level's
 * joint-largest — failed for a driver who did exactly what the screen said.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { REACTION_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

const level = LEVELS.find(entry => entry.id === 6)!;

/**
 * Drives up to `eventId` and holds the turn arrow from `pressAt` road units
 * before the junction. Returns the action the event was graded with.
 */
const turnFrom = (eventId: string, direction: 'left' | 'right', pressAt: number): string => {
  const event = level.events.find(entry => entry.id === eventId)!;
  const session = createDrivingSession({
    level,
    fsm: new DrivingFSM(),
    signCoverage: {},
    initialDistance: Math.max(0, event.triggerAtDistance - 700),
  });

  for (let frame = 0; frame < 3000; frame++) {
    // The read phase freezes the drive where the event announces itself; a
    // player releases it and then drives the approach, so this does too.
    if (session.getSnapshot().briefingEvent) session.dismissBriefing();

    const distance = session.getSnapshot().progress * level.roadLength;
    const input: InputState = {
      ...NO_INPUT,
      // Enough taps to get to a steady cruise, then coast.
      throttle: frame < 6 && frame % 2 === 0,
      [direction]: distance - event.triggerAtDistance >= pressAt,
    } as InputState;

    for (const reported of session.update(input)) {
      if (reported.kind !== 'decision') continue;
      session.settleDecision({ isCorrect: true, weakCompetency: null });
      if (reported.event.id === eventId) return reported.action;
    }
  }
  return 'never graded';
};

describe('a turn committed on the "React Now" cue', () => {
  it('is accepted the moment the cue appears, in both directions', () => {
    // The cue flips to "React Now" at exactly -REACTION_ZONE_ENTER.
    expect(turnFrom('level6.left-turn-centre-lane', 'left', -REACTION_ZONE_ENTER)).toBe('turn_left');
    expect(turnFrom('level6.right-turn-curb-lane', 'right', -REACTION_ZONE_ENTER)).toBe('turn_right');
  });

  it('is accepted anywhere between the cue and the junction', () => {
    for (const pressAt of [-120, -110, -100, -90, -60, -30, -10, 0]) {
      expect(turnFrom('level6.left-turn-centre-lane', 'left', pressAt), `pressed at ${pressAt}`).toBe(
        'turn_left'
      );
    }
  });

  it('still refuses a turn taken long before the cue, which is only steering', () => {
    // The zone is not a licence to press the arrow on the far side of the
    // approach: out there the wheel is just the wheel, and leaving the turning
    // lane is still what costs the turn.
    expect(turnFrom('level6.left-turn-centre-lane', 'left', -320)).not.toBe('turn_left');
  });
});
