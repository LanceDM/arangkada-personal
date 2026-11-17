import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import { composeDrive } from '@/features/driving-sim/domain/scenario/composeDrive';
import { evaluatePlayerAction, garageHotspotToEvent } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import { competencyVerdicts, finalExamPassed } from './competencyVerdict';

const answer = (scenarioId: string, correct: boolean): ActionLog => ({
  timestamp: 0,
  action: 'x',
  result: correct ? 'correct' : 'violation',
  points: 0,
  scenarioId,
});

describe('the per-competency verdict on a drive', () => {
  const counted = [
    { competency: 'parking' as const, scenarioId: 'a' },
    { competency: 'parking' as const, scenarioId: 'b' },
    { competency: 'parking' as const, scenarioId: 'c' },
    { competency: 'lane_discipline' as const, scenarioId: 'd' },
    { competency: 'lane_discipline' as const, scenarioId: 'e' },
    { competency: 'lane_discipline' as const, scenarioId: 'f' },
  ];

  it('passes a competency at 2 of 3 and fails it at 1 of 3', () => {
    const verdicts = competencyVerdicts(counted, [
      answer('a', true), answer('b', false), answer('c', true),
      answer('d', true), answer('e', false), answer('f', false),
    ]);
    expect(verdicts.find(v => v.competency === 'parking')).toMatchObject({ correct: 2, passed: true });
    expect(verdicts.find(v => v.competency === 'lane_discipline')).toMatchObject({ correct: 1, passed: false });
  });

  it('counts a scenario the drive never reached as not correct', () => {
    const [parking] = competencyVerdicts(counted.slice(0, 3), [answer('a', true)]);
    expect(parking).toMatchObject({ correct: 1, ungraded: 2, passed: false });
  });

  it('reads only the first answer to a scenario', () => {
    const [parking] = competencyVerdicts(counted.slice(0, 3), [
      answer('a', false), answer('a', true), answer('b', true), answer('c', true),
    ]);
    expect(parking.correct).toBe(2);
  });
});

describe('an inspection point answered on a composed drive', () => {
  // A garage or crash-scene point is counted under the id its variant was
  // composed with (`level2.garage.tires.1`), so its answer must be logged
  // under that same id, or every one reads as never answered.
  it.each([2, 9, 10])('Level %i: every point answered right counts as right', levelId => {
    // A draw that places one of the stage's garage or crash-scene points: Level
    // 10's pooled slots (2026-11-16) give general_rules enough road scenarios
    // that 0.3 no longer reaches its garage.
    const draw = levelId === 10 ? 0.2 : 0.3;
    const drive = composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId as 2], rng: () => draw });
    const points = [...(drive.level.garage?.hotspots ?? []), ...(drive.level.aftermath?.hotspots ?? [])];
    expect(drive.items.some(item => item.placement === 'garage' || item.placement === 'aftermath')).toBe(true);
    const logs = [
      ...points.map(point => evaluatePlayerAction(garageHotspotToEvent(point), point.correctAction, 0).log),
      ...drive.level.events.map(event => evaluatePlayerAction(event, event.correctAction, 0).log),
    ];
    for (const verdict of competencyVerdicts(drive.items, logs)) {
      expect(verdict, verdict.competency).toMatchObject({ correct: verdict.total, ungraded: 0, passed: true });
    }
  });

  it('keeps the feedback card label the point name it always had', () => {
    const drive = composeDrive({ levelId: 2, competencies: STAGE_COMPETENCIES[2], rng: () => 0.3 });
    const point = drive.level.garage!.hotspots[0];
    expect(garageHotspotToEvent(point).id).toBe(point.scenarioId);
    expect(scenarioLabel(garageHotspotToEvent(point))).toBe(scenarioLabel(garageHotspotToEvent({ ...point, scenarioId: undefined })));
  });
});

describe('the final exam pass', () => {
  const one = (competency: 'parking' | 'pedestrians', correct: number) =>
    ({ competency, total: 1, correct, ungraded: 1 - correct, passed: correct === 1, accuracy: correct });

  it('passes at 70% of its counted scenarios right, never on points', () => {
    const eight = [...Array(8)].map(() => one('parking', 1));
    const three = [...Array(3)].map(() => one('pedestrians', 0));
    expect(finalExamPassed([...eight, ...three], false)).toBe(true);
    expect(finalExamPassed([...eight.slice(1), ...three, one('parking', 0)], false)).toBe(false);
  });

  it('fails when the run ended early, whatever was right', () => {
    expect(finalExamPassed([one('parking', 1)], true)).toBe(false);
  });
});
