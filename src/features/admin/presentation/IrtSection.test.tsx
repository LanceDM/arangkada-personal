// @vitest-environment jsdom
/**
 * `/admin/irt` over an in-memory repository: the item bank before any data,
 * "Not calibrated yet" until a report is published, then the calibration,
 * the design and the results from the report alone, and a review sheet
 * saved at its next revision. The report here is a hand-written fixture.
 */
import { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IrtReportDoc } from '@/domain/assessment/irtReport';
import type { TwoStageDesign } from '@/domain/assessment/twoStageDesign';
import { COMPETENCIES } from '@/domain/learner/profile';
import type { QuizItemDoc } from '@/features/driving-sim';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import type { IrtRepository, ParticipantTestDocuments } from '@/features/admin/application/irtPorts';
import type { ItemReviewKind } from '@/features/admin/domain/contentValidity';
import { useIrtPanel } from '@/features/admin/application/useIrtPanel';
import { IrtSection, type IrtView } from './IrtSection';
import { flush, mount, text, unmount, view } from './adminSections.fixture';

const items: QuizItemDoc[] = COMPETENCIES.flatMap((competency, c) =>
  Array.from({ length: c < 5 ? 6 : 5 }, (_, k) => ({
    schemaVersion: 1 as const,
    id: `L${c + 1}-TS-${String(k + 1).padStart(2, '0')}`,
    moduleId: 'test',
    question: 'Q?',
    options: ['a', 'b'],
    correctIndex: 0,
    explanation: '',
    image: '',
    competency,
    source: 'RA 4136, Sec. 35',
    use: 'test' as const,
    isActive: true,
    order: k,
    revision: 1,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: 'fixture',
  })));
const ids = items.map(i => i.id);

const design: TwoStageDesign = {
  schemaVersion: 1, designId: 'design-1', calibrationId: 'calib-1',
  routing: ids.slice(0, 15), easy: ids.slice(15, 30), medium: ids.slice(30, 45), hard: ids.slice(45), cuts: [6, 11],
};

const grid = Array.from({ length: 81 }, (_, i) => Math.round((-4 + i * 0.1) * 10) / 10);
const bump = (centre: number) => grid.map(t => 3.75 * Math.exp(-((t - centre) ** 2) / 2));

const report: IrtReportDoc = {
  schemaVersion: 1, generatedAt: Date.UTC(2026, 10, 1), placeholder: false, calibrationId: 'calib-1', method: 'CML',
  calibrationPlayers: 20, extremePlayers: 0, scaleItems: 59, designId: 'design-1', cuts: [6, 11], designMatchesCalibration: true,
  cohorts: { study: 2 },
  items: ids.map((id, i) => ({
    itemId: id, competency: items[i].competency, status: i === 59 ? 'all-correct' : 'estimated',
    difficulty: i === 59 ? null : -2 + i / 15, se: i === 59 ? null : 0.5, infit: 1, outfit: 1.1,
    pctCorrectPre: 60, nPre: 2, pctCorrectPost: null, nPost: 0, postResidual: null, block: null,
  })),
  kr20Pre: 0.81,
  pre: { n: 2, rmse: 0.4, reliability: 0.7 },
  post: { n: 2, rmse: 0.5, reliability: 0.6 },
  gain: { n: 2, mean: 0.75, sd: 0.2, se: 0.14, meanCi: [-1, 2.5], t: 5.3, df: 1, p: 0.12, dz: 3.75, dzCi: [-0.2, 7.9], beyondError: 1 },
  persons: [
    { playerCode: 'P-0001', thetaPre: -0.5, sePre: 0.4, scorePre: 25, itemsPre: 59, thetaPost: 0.4, sePost: 0.5, scorePost: 17, itemsPost: 30, gain: 0.9, gainSe: 0.64, gainBeyondError: false },
    { playerCode: 'P-0002', thetaPre: 0.2, sePre: 0.4, scorePre: 33, itemsPre: 59, thetaPost: 0.8, sePost: 0.5, scorePost: 19, itemsPost: 30, gain: 0.6, gainSe: 0.64, gainBeyondError: false },
  ],
  routing: [
    { playerCode: 'P-0001', routingScore: 8, routed: 'medium', consistent: true, mostInformative: 'medium' },
    { playerCode: 'P-0002', routingScore: 12, routed: 'hard', consistent: true, mostInformative: 'hard' },
  ],
  revisionChanges: 0,
  routingTable: Array.from({ length: 16 }, (_, score) => ({
    score, theta: -3 + score * 0.4, block: score < 6 ? 'easy' : score < 11 ? 'medium' : 'hard',
    information: { easy: 2, medium: 2.5, hard: 3 },
  })),
  curves: { theta: grid, routing: bump(0), easy: bump(-1.5), medium: bump(0), hard: bump(1.5) },
};

const response = (itemId: string, correct: boolean) => ({
  itemId, revision: 1, competency: 'road_signs', stage: 'pre', block: null, position: 1, choiceOrder: [0, 1], chosen: correct ? 0 : 1, correct, timeMs: 1,
});
const tests: ParticipantTestDocuments[] = [
  {
    code: 'P-0001', cohort: 'study',
    preStatus: { status: 'finished' }, postStatus: { status: 'finished', block: 'medium' },
    preSitting: { schemaVersion: 1, sittingId: 's', playerCode: 'P-0001', kind: 'pre', seed: 1, startedAt: 0, finishedAt: 1, designId: null, routing: null, responses: [response(ids[0], true)] },
    postSitting: null,
  },
  { code: 'T-0001', cohort: 'test', preStatus: { status: 'open' }, postStatus: null, preSitting: null, postSitting: null },
];

let stored: { report: unknown; design: unknown; tagging: unknown; experts: unknown };
const repository: IrtRepository = {
  report: async () => stored.report,
  design: async () => stored.design,
  testItems: async () => items,
  participantTests: async () => tests,
  reviews: async () => ({ tagging: stored.tagging, experts: stored.experts }),
  examResponses: async () => [
    { uid: 'u1', timestamp: 1, responses: [{ itemId: 'L5-RW-01', level: 5, chosen: 0, correct: true }] },
  ],
  saveReview: vi.fn(async (kind: ItemReviewKind, review: { revision: number }) => {
    const before = stored[kind] as { revision: number } | null;
    if (review.revision !== (before ? before.revision + 1 : 1)) throw new Error('Missing or insufficient permissions.');
    stored = { ...stored, [kind]: review };
  }),
};

const Harness = ({ start }: { start: IrtView }) => {
  const [view, setView] = useState<IrtView>(start);
  return <IrtSection irt={useIrtPanel(true, 'admin-1')} view={view} onView={setView} />;
};

beforeEach(() => {
  stored = { report: null, design: null, tagging: null, experts: null };
  vi.clearAllMocks();
  provideAdminDependencies({ irt: repository } as unknown as AdminDependencies);
});
afterEach(unmount);

const open = async (start: IrtView) => {
  await mount(<Harness start={start} />);
  await flush();
};

describe('the IRT section', () => {
  it('shows the item bank and its readiness before any data exists', async () => {
    await open('bank');
    expect(view().querySelector('[data-testid="irt-readiness"]')!.textContent).toContain('60 of 60 switched on · 11 of 11 competencies covered');
    expect(text()).toContain('the pre-test can open');
    expect(text()).toContain('RA 4136, Sec. 35');
    expect(text()).toContain('No tagging yet');
  });

  it('says "Not calibrated yet" until the analysis is published', async () => {
    await open('calibration');
    expect(text()).toContain('Not calibrated yet');
    unmount();
    await open('design');
    expect(text()).toContain('Not calibrated yet');
    unmount();
    await open('results');
    expect(text()).toContain('Not calibrated yet');
    // The live counts need no analysis: the study cohort alone by default.
    expect(text()).toContain('Enrolled1');
  });

  it('shows the calibration, the design and the results from the published report', async () => {
    stored = { ...stored, report, design };
    await open('calibration');
    expect(text()).toContain('calib-1');
    expect(text()).toContain('59 of 60');
    expect(text()).toContain('0.81');
    expect(view().querySelector('[aria-label^="Wright map"]')).not.toBeNull();
    expect(text()).toContain('everyone right');
    unmount();

    await open('design');
    expect(text()).toContain('[6, 11]');
    expect(view().querySelector('[aria-label^="Information curves"]')).not.toBeNull();
    expect(text()).toContain('cut 1: score 6');
    // The routing table counts who was routed from each score.
    const row8 = [...view().querySelectorAll('tbody tr')].find(tr => tr.querySelector('td')?.textContent === '8')!;
    expect(row8.lastElementChild!.textContent).toBe('1');
    unmount();

    await open('results');
    expect(text()).toContain('d_z');
    expect(text()).toContain('3.75');
    expect(text()).toContain('P-0002');
    expect(text()).toContain('0.90 ± 0.64');
    // The adaptation, per person: the routing score, its row of the routing table, and the block it sent them to.
    const cells = (code: string) => [...view().querySelector(`[data-testid="irt-person-${code}"]`)!.querySelectorAll('td')].map(td => td.textContent);
    expect(cells('P-0001')).toEqual(['P-0001', '-0.50 ± 0.40', '0.40 ± 0.50', '0.90 ± 0.64', '8', '0.20', 'Medium', 'Medium', 'Medium']);
    expect(cells('P-0002').slice(4)).toEqual(['12', '1.80', 'Hard', 'Hard', 'Hard']);
    expect(text()).toContain('Exploratory');
  });

  it('marks placeholder data on every view', async () => {
    stored = { ...stored, report: { ...report, placeholder: true }, design };
    await open('results');
    expect(text()).toContain('Placeholder data (PH-)');
  });

  it('saves a tagging sheet at its next revision, and refuses one with names', async () => {
    await open('bank');
    const input = view().querySelector<HTMLInputElement>('input[aria-label="Tagging sheet (CSV)"]')!;
    const upload = async (csv: string) => {
      Object.defineProperty(input, 'files', { value: [new File([csv], 't.csv', { type: 'text/csv' })], configurable: true });
      act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
      await flush();
      await flush();
    };
    await upload(`item_id,Ana,Ben\n${ids[0]},road_signs,road_signs`);
    expect(text()).toContain('never names');
    expect(repository.saveReview).not.toHaveBeenCalled();

    await upload(`item_id,R1,R2\n${ids[0]},${items[0].competency},${items[0].competency}\n${ids[1]},${items[1].competency},road_signs`);
    expect(repository.saveReview).toHaveBeenCalledWith('tagging', expect.objectContaining({ revision: 1, updatedBy: 'admin-1', raters: ['R1', 'R2'] }));
    expect(text()).toContain('Revision 1');
    expect(text()).toContain('Disagreements1');
  });
});
