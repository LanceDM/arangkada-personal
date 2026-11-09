import { describe, expect, it } from 'vitest';
import { pilotOverview } from './pilotOverview';
import { NO_PROFILE, NO_STEPS, pilotRows, type PilotAccountProgress, type PilotSteps } from './pilotProgress';

const MIN = 60_000;
const NOW = new Date(2026, 10, 5, 15, 0, 0).getTime();
const YESTERDAY = NOW - 24 * 60 * MIN;

const ready: PilotSteps = { ...NO_STEPS, consentedAt: YESTERDAY, backgroundAt: YESTERDAY, deviceCheckedAt: YESTERDAY, preTest: 'finished' };

const account = (code: string, over: Partial<PilotAccountProgress> = {}): PilotAccountProgress => ({
  code,
  name: null,
  profile: NO_PROFILE,
  cohort: 'study',
  uid: code.toLowerCase(),
  enrolledAt: YESTERDAY,
  withdrawnAt: null,
  steps: NO_STEPS,
  group: null,
  cursor: null,
  attempts: [],
  ...over,
});

const at = (level: number, updatedAt: number, outcome: 'passed' | 'failed' | null = null) => ({ state: { kind: 'DRIVE', level }, outcome, updatedAt });

const registry = (): PilotAccountProgress[] => [
  // The study: one done, one playing now, one at the pre-test, one enrolled today, one withdrawn.
  account('P-0001', {
    steps: { ...ready, postTest: 'finished', surveyOpenedAt: YESTERDAY, surveyConfirmedAt: YESTERDAY },
    cursor: { state: { kind: 'CERTIFIED' }, outcome: 'passed', updatedAt: YESTERDAY },
  }),
  account('P-0002', { steps: ready, cursor: at(2, NOW - 3 * MIN), attempts: [{ id: 'b', levelId: 1, savedAt: NOW - 3 * MIN }] }),
  account('P-0003', { steps: { ...ready, preTest: 'open' } }),
  account('P-0004', { enrolledAt: NOW - 10 * MIN }),
  account('P-0005', { steps: ready, cursor: at(4, YESTERDAY), withdrawnAt: YESTERDAY }),
  // Counted apart.
  account('D-0001', { cohort: 'dryrun', steps: ready, cursor: at(5, NOW - MIN) }),
  account('T-0001', { cohort: 'test' }),
];

describe('the overview', () => {
  it('counts the study cohort, and the dry run and tests apart', () => {
    const overview = pilotOverview(pilotRows(registry()), NOW);
    expect(overview.participants).toBe(5);
    expect(overview.cohorts).toEqual({ study: 5, dryrun: 1, test: 1 });
  });

  it("says how the study's participants stand", () => {
    // P-0004 enrolled ten minutes ago, which is activity too; the withdrawn participant is never active.
    expect(pilotOverview(pilotRows(registry()), NOW).study).toEqual({ enrolledToday: 1, inCourse: 1, activeNow: 2, done: 1, withdrawn: 1 });
  });

  it("counts the study's participants at each stage, in the study's order", () => {
    const stages = Object.fromEntries(pilotOverview(pilotRows(registry()), NOW).stages.map(entry => [entry.stage, entry.participants]));
    expect(stages).toEqual({
      consent: 1, background: 0, device: 0, 'pre-test': 1, tutorial: 0, levels: 1, final: 0, 'post-test': 0, survey: 0, done: 1, withdrawn: 1,
    });
  });

  it('counts where the next Continue takes the participants in the course, and only them', () => {
    expect(pilotOverview(pilotRows(registry()), NOW).places).toEqual([{ place: 'Level 2', participants: 1 }]);
  });
});
