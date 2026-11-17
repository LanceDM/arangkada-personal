// @vitest-environment jsdom
/**
 * The course's results screen claims a pass only on the course's own verdict
 * (every topic 2 of 3, the final exam's 70%), never on the points total. Every
 * screen counts topics on the drive itself, shows no mastery estimate, and
 * names a check's answer by its choice, never the action token behind it.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import { LEVELS } from '@/features/driving-sim';
import LevelComplete from './LevelComplete';


let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const level = LEVELS.find(l => l.id === 1)!;
const result = (over: Partial<LevelResult>): LevelResult => ({
  levelId: 1, score: 0, stars: 0, completed: false, violations: 0, correctActions: 0, logs: [], ...over,
});
const topic = (passed: boolean) => ({ competency: 'driver_legality', correct: passed ? 3 : 1, total: 3, passed });

const show = (r: LevelResult, course: { passed: boolean | null; verdicts: ReturnType<typeof topic>[] | null }) => {
  act(() =>
    root.render(
      <LevelComplete
        result={r} level={level} onNext={() => {}} onRetry={() => {}} onMenu={() => {}} hasNextLevel={false}
        course={{ note: null, onContinue: null, topics: ['driver_legality'], ...course }}
      />
    )
  );
  return host.textContent ?? '';
};

describe('the course results screen', () => {
  it('shows PASSED on the course verdict, though the score is under the points pass mark', () => {
    expect(show(result({ completed: false }), { passed: true, verdicts: [topic(true)] })).toContain('PASSED');
  });

  it('shows the final exam passed at 70% though some of its one-scenario topics were missed', () => {
    const text = show(result({ completed: false }), { passed: true, verdicts: [topic(true), { ...topic(false), competency: 'parking' }] });
    expect(text).toContain('PASSED');
  });

  it('claims no pass from the points total while the verdict is saving or was not saved', () => {
    const text = show(result({ completed: true, score: 999 }), { passed: null, verdicts: null });
    expect(text).toContain('CHECKING');
    expect(text).not.toContain('PASSED');
    expect(text).not.toContain('LEVEL COMPLETE');
  });

  it('shows a topic the attempt cap closed as not passed, and the drive as failed', () => {
    const text = show(result({ completed: true, score: 999 }), { passed: false, verdicts: [topic(false)] });
    expect(text).toContain('1 of 3, not passed');
    expect(text).toContain('FAILED');
  });

  it('says a crashed drive ended early, never that a right answer was not passed', () => {
    const text = show(result({ crashReason: 'You drove into an ambulance.' }), {
      passed: false,
      verdicts: [{ competency: 'document_awareness', correct: 1, total: 1, passed: false }],
    });
    expect(text).toContain('1 of 1, drive ended early');
    expect(text).not.toContain('not passed');
    expect(text).toContain('The drive ended early, so no topic is passed on it.');
    expect(text).not.toContain('2 of its 3');
  });

  it("states the final exam's own rule on Level 12", () => {
    act(() =>
      root.render(
        <LevelComplete
          result={result({ levelId: 12 })} level={LEVELS.find(l => l.id === 12)!} onNext={() => {}} onRetry={() => {}} onMenu={() => {}} hasNextLevel={false}
          course={{ note: null, onContinue: null, topics: ['parking'], passed: true, verdicts: [{ competency: 'parking', correct: 1, total: 1, passed: true }] }}
        />
      )
    );
    expect(host.textContent).toContain('The final exam passes at 70% of its scenarios, one per topic.');
    expect(host.textContent).not.toContain('2 of its 3');
  });

  it('states the rule for a topic with fewer than 3 scenarios', () => {
    const text = show(result({}), { passed: false, verdicts: [{ competency: 'parking', correct: 0, total: 2, passed: false }] });
    expect(text).toContain('0 of 2, not passed');
    expect(text).toContain('or all of them where it had fewer than 2 scenarios');
    expect(text).not.toContain('2 of its 3');
  });
});

const plain = (r: LevelResult, onLevel = level) => {
  act(() =>
    root.render(
      <LevelComplete result={r} level={onLevel} onNext={() => {}} onRetry={() => {}} onMenu={() => {}} hasNextLevel={false} />
    )
  );
  return host.textContent ?? '';
};
const decision = (over: Partial<ActionLog>): ActionLog => ({
  timestamp: 1, action: 'brake', expectedAction: 'brake', result: 'correct', points: 10, competency: 'lane_discipline', ...over,
});

describe('what the results screen counts', () => {
  it('shows one correct answer as 1 of 1 correct, never a mastery percentage', () => {
    // The stored projection still says 69 (the frozen design's BKT over one
    // drive); the screen must not show it.
    const text = plain(result({ logs: [decision({})], competencyScores: { lane_discipline: 69 } }));
    expect(text).toContain('1 of 1 correct');
    expect(text).toContain('No mistakes this drive.');
    for (const gone of ['69%', 'Needs Practice', 'Mastered', 'Improving', 'Critical']) expect(text, gone).not.toContain(gone);
  });

  it('names the topic with the most mistakes and its count, and leaves standing penalties out', () => {
    const logs = [
      decision({ timestamp: 1 }),
      decision({ timestamp: 2, competency: 'speed_control', result: 'violation', action: 'accelerate' }),
      decision({ timestamp: 3, competency: 'speed_control', result: 'violation', standing: true }),
      decision({ timestamp: 4, competency: 'speed_control' }),
    ];
    const text = plain(result({ logs }));
    expect(text).toContain('Topic to work on');
    expect(text).toContain('1 of 2 correct on this drive: the topic with the most mistakes.');
    expect(text).not.toContain('lost the most points');
  });

  it('carries none of the removed layered-FSM wording, and no What Happened panel', () => {
    const text = plain(result({ logs: [decision({ result: 'violation', action: 'accelerate' })] }));
    for (const gone of ['Layered FSM', 'Suggested phase', 'remediation', 'toward mastery', 'Focus next practice', 'What Happened', 'You chose', 'violation detected', 'What comes next']) {
      expect(text, gone).not.toContain(gone);
    }
  });

  it('shows the points pass mark outside the course, and none in a course drive', () => {
    expect(plain(result({ logs: [decision({})] }))).toContain('Pass mark');
    expect(show(result({}), { passed: true, verdicts: [topic(true)] })).not.toContain('Pass mark');
  });
});

describe('a garage check on the results screen', () => {
  const level2 = LEVELS.find(l => l.id === 2)!;
  const point = level2.garage!.hotspots[0];
  const wrong = point.choices.find(c => c.action !== point.correctAction)!;
  const right = point.choices.find(c => c.action === point.correctAction)!;

  it('names the answer and the correct one by their choices, never the action token', () => {
    const text = plain(
      result({
        levelId: 2,
        logs: [decision({ scenarioId: point.scenarioId ?? point.id, action: wrong.action, expectedAction: point.correctAction, result: 'violation', competency: point.competency })],
      }),
      level2,
    );
    expect(text).toContain(`You answered: ${wrong.label}`);
    expect(text).toContain(`Correct: ${right.label}`);
    expect(text).not.toMatch(/You chose (Brake|Accelerate|Stop|Honk)/);
    expect(text).not.toMatch(/Expected (Brake|Accelerate|Stop|Honk)/);
    expect(text).toContain('Wrong');
    expect(text).not.toContain('violation');
  });
});
