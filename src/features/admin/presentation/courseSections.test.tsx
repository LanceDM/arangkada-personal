// @vitest-environment jsdom
/**
 * The three course views over in-memory repositories: nothing is read from the
 * participants until Load, then one cohort's enrolled participants alone,
 * named by code; the cohort's table is followed live.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DecisionRecord } from '@/domain/competencyRouting/course';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import type { CourseLogsRepository } from '@/features/admin/application/courseLogsPorts';
import { useCourseRecords } from '@/features/admin/application/useCourseRecords';
import { CourseBktSection } from './CourseBktSection';
import { CourseFlowSection } from './CourseFlowSection';
import { CourseQLearningSection } from './CourseQLearningSection';
import { clickLabel, flush, mount, pressTab, repository, text, unmount } from './routingSections.fixture';

const decision: DecisionRecord = {
  seq: 1, levelId: 1, phase: 'DRIVE(1)', competency: 'driver_legality', state: { mastery: 2, result: 'failed' }, masteryP: 0.6,
  legal: ['practice', 'review'], action: 'practice', source: 'explore_1', probability: 0.5, probabilities: { practice: 0.5, review: 0.5 },
  leader: null, selection: 'explore', draw: 0.2, snapshot: {}, timestamp: 1000,
};

// The fixture's registry: u1 and u2 in the study cohort, u3 in the test cohort.
const reads: string[] = [];
const watched: string[] = [];
const logs: CourseLogsRepository = {
  bktUpdates: async uid => (
    reads.push(`bkt/${uid}`),
    uid === 'u3' ? [] : [{ uid, userSeq: 1, competency: 'driver_legality', source: 'drive', correct: true, pAfter: uid === 'u1' ? 0.97 : 0.42, levelAfter: uid === 'u1' ? 4 : 1 }]
  ),
  courseLog: async uid => (
    reads.push(`course/${uid}`),
    uid === 'u1'
      ? [{ kind: 'drive', levelId: 1, phase: 'DRIVE(1)', verdicts: [{ competency: 'driver_legality', total: 3, correct: 1, passed: false, masteryP: 0.6, driveEvidence: 3 }], decisions: [decision], rewards: [], timestamp: 1000 }]
      : []
  ),
  watchTable: (cohort, onChange) => {
    watched.push(`table/${cohort}`);
    onChange({ updates: 1, updatedAt: 1000, table: { 'M2-failed': { practice: { q: 0, n: 0, visits: 1 } } }, states: { 'M2-failed': { tag: 'exploring', phase: 'explore_1', leader: null } } });
    return () => {};
  },
  watchUpdates: (cohort, _limit, onChange) => {
    watched.push(`updates/${cohort}`);
    onChange([{ globalSeq: 1, kind: 'visit', participantCode: 'P01', stateKey: 'M2-failed', action: 'practice', competency: 'driver_legality', at: 1000, decision: { selection: 'explore', warmUpPhase: 'explore_1', probability: 0.5, draw: 0.2 }, learning: null }]);
    return () => {};
  },
};

const Q = () => <CourseQLearningSection course={useCourseRecords()} />;
const B = () => <CourseBktSection course={useCourseRecords()} />;
const F = () => <CourseFlowSection course={useCourseRecords()} />;

beforeEach(() => {
  reads.length = 0;
  watched.length = 0;
  provideAdminDependencies({ pilotRecords: repository, courseLogs: logs } as unknown as AdminDependencies);
});
afterEach(unmount);

describe('the course views', () => {
  it('Q-learning: the live table at once, the logs only on Load, one cohort alone', async () => {
    await mount(<Q />);
    expect(watched).toContain('table/study');
    expect(text()).toContain('Exploring');
    expect(text()).toContain('n 0 · visits 1');
    expect(text()).toContain('explore · explore_1 · p 0.50');
    expect(reads).toEqual([]);

    await pressTab('Decisions');
    expect(text()).toContain('The records are not loaded');
    await clickLabel('Load the records');
    await flush();
    expect(reads.sort()).toEqual(['bkt/u1', 'bkt/u2', 'course/u1', 'course/u2']);
    expect(text()).toContain('practice / review → practice');
    expect(text()).toContain('waiting');
  });

  it('BKT: each participant by code, P(L) as the log wrote it', async () => {
    await mount(<B />);
    await clickLabel('Load the records');
    await flush();
    expect(text()).toContain('P01');
    expect(text()).toContain('0.97');
    expect(text()).toContain('P02');
    expect(text()).not.toContain('E01B');
  });

  it('Course flow: the machine, then where each participant is', async () => {
    await mount(<F />);
    expect(text()).toContain('QUIZ_REVIEW(L)');
    await clickLabel('Load the records');
    await flush();
    await pressTab('Participants');
    expect(text()).toContain('DRIVE(1)');
    expect(text()).toContain('open 1/3');
  });
});
