/**
 * What the briefing and the results screen say about the routing FSM's move:
 * the transition and the reason, in the
 * player's terms, and never which group or policy chose it.
 */
import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { ROUTING_Q_STATES, type RoutingAction, type RoutingTable } from '@/domain/learner/adaptive/routingQPolicy';
import { FINAL_STATE, driveState, type FrontierState, type Outcome } from '@/domain/routing/routingTypes';
import { enterCourseEntry, nextCourseEntry, type PendingEntry, type RoutingGroup } from './courseRouting';
import { courseNote, courseResultNote } from './routingBriefing';

const weakAt = (weak: DrivingCompetency): ActionLog[] => [
  ...COMPETENCIES.flatMap((c, i) => [
    { timestamp: i * 2, action: 'brake', result: 'correct' as const, points: 10, competency: c },
    { timestamp: i * 2 + 1, action: 'brake', result: 'correct' as const, points: 10, competency: c },
  ]),
  { timestamp: 100, action: 'brake', result: 'violation', points: -10, competency: weak },
  { timestamp: 101, action: 'brake', result: 'violation', points: -10, competency: weak },
];

const table = (row: RoutingAction[]): RoutingTable =>
  Object.fromEntries(ROUTING_Q_STATES.map(state => [state, row])) as unknown as RoutingTable;

const entryFor = (state: FrontierState, outcome: Outcome | null, group: RoutingGroup, history: ActionLog[] = [], row: RoutingAction[] = ['none']) =>
  enterCourseEntry(
    nextCourseEntry({
      cursor: { state, outcome, seq: 0, decisionsSpent: 0, pending: null },
      group,
      history,
      attemptSeed: 0x5eed,
      coverage: {},
      optimized: { table: table(row), tableId: 'test', seed: 0, budgetSize: 336 },
    })
  );

const text = (entry: ReturnType<typeof entryFor>) => {
  const note = courseNote(entry);
  return [note.heading, ...note.lines].join(' ');
};

describe('the briefing names the move', () => {
  it('for an entry played as it stands', () => {
    const note = courseNote(entryFor(driveState(3), null, 'conventional'));
    expect(note.heading).toMatch(/^Your course: Level 3: \S/);
    expect(note.lines).toEqual(['Pass this level to move on to Level 4.']);
    expect(text(entryFor(driveState(11), null, 'conventional'))).toContain('move on to the final exam');
    expect(text(entryFor(FINAL_STATE, null, 'conventional'))).toContain('the same test for every learner');
  });

  it('for a retry, an advance and the move to the final exam', () => {
    expect(courseNote(entryFor(driveState(4), 'failed', 'conventional')).heading).toMatch(/^Again: Level 4/);
    expect(text(entryFor(driveState(4), 'failed', 'conventional'))).toContain('did not reach the pass mark on Level 4');
    expect(courseNote(entryFor(driveState(4), 'passed', 'conventional')).heading).toMatch(/^Next: Level 5/);
    expect(text(entryFor(driveState(4), 'passed', 'conventional'))).toContain('You passed Level 4.');
    expect(text(entryFor(driveState(11), 'passed', 'conventional'))).toContain('You passed Level 11. The final exam');
    expect(text(entryFor(FINAL_STATE, 'failed', 'conventional'))).toContain('sitting it again');
  });

  it('for practice: what was added, that it does not count, and why', () => {
    const weakest = entryFor(driveState(5), 'passed', 'optimized', weakAt('lane_discipline'), ['weakest', 'none']);
    expect(weakest.item?.competency).toBe('lane_discipline');
    expect(text(weakest)).toContain('One extra scenario on Lane Discipline is added at the end of this drive.');
    expect(text(weakest)).toContain('does not count toward your pass mark');
    expect(text(weakest)).toContain('Lane Discipline is your weakest area right now.');

    const related = entryFor(driveState(5), 'passed', 'optimized', weakAt('lane_discipline'), ['related', 'none']);
    expect(related.item).not.toBeNull();
    expect(related.item!.competency).not.toBe('lane_discipline');
    expect(text(related)).toContain('closely related to Lane Discipline, your weakest area right now');
  });

  it('for a review: the weak area it is for, and that it does not hold the player back', () => {
    const pending: PendingEntry = {
      from: driveState(3),
      outcome: 'passed',
      transition: { kind: 'review', level: 2, competency: 'general_rules' },
      group: 'optimized',
      attemptSeed: 0x5eed,
      coverage: {},
      observation: { weakest: 'general_rules', weakestScore: 20, spent: 40, size: 336, budgetLeft: 'more', asked: true, qState: 'early:critical:passed:more', row: ['review', 'none'], action: 'review', tableId: 'test' },
      starts: 1,
    };
    const entry = enterCourseEntry(pending);
    const note = courseNote(entry);
    expect(note.heading).toMatch(/^Review: Level 2/);
    expect(note.lines[0]).toContain('You passed Level 3. Before Level 4, you will drive Level 2 once more, because General Rules is your weakest area right now');
    expect(note.lines[1]).toContain('does not hold you back');
    expect(courseResultNote(entry, 'failed')).toBe('Review done. Continue goes on to Level 4.');
  });

  it('never names the group, the policy or the table', () => {
    const notes = [
      entryFor(driveState(5), 'passed', 'optimized', weakAt('lane_discipline'), ['weakest', 'none']),
      entryFor(driveState(5), 'passed', 'conventional', weakAt('lane_discipline')),
      entryFor(driveState(5), 'failed', 'optimized', weakAt('road_signs'), ['related', 'none']),
    ].map(text);
    for (const note of notes) expect(note).not.toMatch(/optimi[sz]ed|conventional|q-learning|policy|table|group|algorithm/i);
  });
});

describe('the results screen says where Continue goes', () => {
  it('after the final exam, a pass and a fail', () => {
    expect(courseResultNote(entryFor(FINAL_STATE, null, 'conventional'), 'passed')).toContain('Your course is complete');
    expect(courseResultNote(entryFor(driveState(4), null, 'conventional'), 'failed')).toBe('Continue to drive Level 4 again.');
    expect(courseResultNote(entryFor(driveState(4), null, 'conventional'), 'passed')).toBe('Continue to the next step of your course.');
  });
});
