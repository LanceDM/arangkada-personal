/**
 * An in-drive question left unanswered past its time limit is settled as not
 * passed, with no answer, and the drive goes on (TENTATIVE 30 s limit).
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

const THROTTLE: InputState = { ...NO_INPUT, throttle: true };

/** The host's half of a graded decision, as in eventFlow.test.ts. */
const hostVerdict = (fsm: DrivingFSM) => {
  if (!['REACTION_WINDOW', 'INTERSECTION', 'HAZARD', 'DECISION'].includes(fsm.getState())) return;
  fsm.transition('answer_correct');
  fsm.transition('feedback_displayed');
  fsm.transition('road_clear');
};

describe('an in-drive question that runs out of time', () => {
  it('settles as a timeout decision and releases the drive', () => {
    // Level 5 asks right-of-way questions with the road frozen.
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level: LEVELS.find(l => l.id === 5)!, fsm, signCoverage: {} });
    let timedOut: Extract<GameEvent, { kind: 'decision' }> | null = null;
    for (let frame = 0; frame < 12000 && !timedOut; frame++) {
      const held = session.getSnapshot();
      if (held.adaptationNotice) session.dismissAdaptationNotice();
      if (held.briefingEvent) session.dismissBriefing();
      if (held.inspectionEvent || held.cutsceneEvent) {
        const reported = session.timeoutQuestion();
        timedOut = reported.find((e): e is Extract<GameEvent, { kind: 'decision' }> => e.kind === 'decision') ?? null;
        expect(session.getSnapshot().inspectionEvent).toBeNull();
        expect(session.getSnapshot().cutsceneEvent).toBeNull();
        // Idempotent: nothing is open any more.
        expect(session.timeoutQuestion()).toEqual([]);
        break;
      }
      for (const event of session.update(frame % 4 === 0 ? THROTTLE : NO_INPUT)) {
        if (event.kind !== 'decision') continue;
        session.settleDecision({ isCorrect: true, weakCompetency: null });
        hostVerdict(fsm);
      }
    }
    expect(timedOut).not.toBeNull();
    expect(timedOut!.action).toBe('timeout');
    expect(timedOut!.settlement).toBe('question_timeout');
  });
});
