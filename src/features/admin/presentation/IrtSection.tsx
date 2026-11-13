/**
 * IRT, the Rasch model: where the 60 test items and
 * the adaptive post-test are shown to work. Four views:
 * - **Item bank**: the test items, their readiness and the team's
 *   content-validity evidence, before any data exists;
 * - **Calibration**: the frozen difficulties, fit, KR-20 and the Wright map;
 * - **Post-test design**: the blocks, the cut points, the routing table and
 *   each block's information curve;
 * - **Results**: tests finished and routed, each item's percent correct
 *   before and after, and the gains.
 *
 * Every Rasch number comes from `irt_reports/current`, which the developers'
 * script `publishRaschReport.ts` writes: this section estimates nothing. The
 * counts and percentages it works out itself are labelled as live.
 * Participants appear by code only.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshCw, Sigma, TriangleAlert, Upload } from 'lucide-react';

import type { IrtReportDoc } from '@/domain/assessment/irtReport';
import type { TwoStageDesign, TestBlock } from '@/domain/assessment/twoStageDesign';
import { STUDY_COHORTS, type StudyCohort } from '@/domain/study/participantCode';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import type { IrtData, IrtPanel } from '@/features/admin/application/useIrtPanel';
import { cohenKappa, contentValidityIndex, MAX_EXPERTS, MIN_EXPERTS, type ItemReviewKind } from '@/features/admin/domain/contentValidity';
import { bankReadiness, itemDrift, testCounts } from '@/features/admin/domain/irtPanel';
import { EmptyState, Notice, Panel, SectionHeader, SectionTabs, StatTile } from './adminUi';
import { InformationCurves, WrightMap } from './IrtCharts';
import { BLOCK_COLOR, BLOCK_LABEL } from './irtPalette';
import { toShortDateTime } from './formatDate';

export type IrtView = 'bank' | 'calibration' | 'design' | 'results' | 'item-bank';

const VIEWS: ReadonlyArray<{ value: IrtView; label: string }> = [
  { value: 'bank', label: 'Test items' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'design', label: 'Post-test design' },
  { value: 'results', label: 'Results' },
  { value: 'item-bank', label: 'Item bank (mock exam)' },
];

const COHORT_NAME: Record<string, string> = { dryrun: 'dry-run (D-)', test: 'test (T-)', other: 'unknown' };
const COHORT_LABEL: Record<StudyCohort, string> = { study: 'Study (P-)', dryrun: 'Dry run (D-)', test: 'Test (T-)' };

const num = (x: number | null | undefined, d = 2) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d));
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${x.toFixed(0)}%`);

const Th = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th className={cn('px-2 py-1.5 font-medium text-muted-foreground', right ? 'text-right' : 'text-left')}>{children}</th>
);
const Td = ({ children, right, className }: { children: ReactNode; right?: boolean; className?: string }) => (
  <td className={cn('px-2 py-1.5', right && 'text-right tabular-nums', className)}>{children}</td>
);
const Table = ({ head, children }: { head: ReactNode; children: ReactNode }) => (
  <div className="max-h-[28rem] overflow-auto">
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-card">
        <tr className="border-b border-border">{head}</tr>
      </thead>
      <tbody className="divide-y divide-border">{children}</tbody>
    </table>
  </div>
);

const PlaceholderBanner = () => (
  <div role="status" className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
    <div>
      <strong>Placeholder data (PH-).</strong> These are the emulator test kit's made-up items and pre-tests, for testing the
      page only. Nothing here is a result of the study.
    </div>
  </div>
);

const NotCalibrated = ({ children }: { children?: ReactNode }) => (
  <Panel>
    <EmptyState icon={Sigma} title="Not calibrated yet">
      {children ??
        'Calibration day comes after the last pre-test: raschCalibrate.ts freezes the scale, then publishRaschReport.ts puts the analysis here.'}
    </EmptyState>
  </Panel>
);

// ── Item bank ─────────────────────────────────────────────────────────────

const ReviewImport = ({ kind, onImport }: { kind: ItemReviewKind; onImport: (kind: ItemReviewKind, csv: string) => Promise<string[]> }) => {
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label={kind === 'tagging' ? 'Tagging sheet (CSV)' : "Experts' sheet (CSV)"}
        className="hidden"
        onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy(true);
          setProblems(await onImport(kind, await file.text()));
          setBusy(false);
        }}
      />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        <Upload className="mr-1 h-4 w-4" />
        {kind === 'tagging' ? 'Import tagging CSV' : "Import experts' CSV"}
      </Button>
      {problems && problems.length > 0 && (
        <Notice tone="error">
          <p>Nothing saved:</p>
          <ul className="list-disc pl-4">
            {problems.slice(0, 8).map(p => <li key={p}>{p}</li>)}
          </ul>
        </Notice>
      )}
      {problems && problems.length === 0 && <p className="text-xs text-muted-foreground">Saved.</p>}
    </div>
  );
};

const BankView = ({ data, onImport }: { data: IrtData; onImport: IrtPanel['importReview'] }) => {
  const readiness = bankReadiness(data.items);
  const kappa = data.tagging ? cohenKappa(data.tagging.rows) : null;
  const cvi = data.experts ? contentValidityIndex(data.experts.rows) : null;
  const tagsOf = new Map(data.tagging?.rows.map(r => [r.itemId, r.tags]) ?? []);
  const iCviOf = new Map(cvi?.items.map(i => [i.itemId, i]) ?? []);
  const maxPer = Math.max(1, ...readiness.perCompetency.map(c => c.items));

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground" data-testid="irt-readiness">
        {readiness.switchedOn} of 60 switched on · {readiness.competenciesCovered} of {readiness.competencies} competencies covered
        {readiness.total !== readiness.switchedOn && ` · ${readiness.total - readiness.switchedOn} switched off`}
        {' · '}
        <span className={readiness.ready ? 'font-medium' : 'font-medium text-destructive'}>
          {readiness.ready ? 'the pre-test can open' : 'the pre-test cannot open'}
        </span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Items per competency" description="Switched-on test items, by the competency the bank tags them with.">
          <ul className="space-y-1.5">
            {readiness.perCompetency.map(c => (
              <li key={c.competency} className="grid grid-cols-[10rem_1fr_2rem] items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground">{c.competency}</span>
                <span className="h-3 rounded bg-muted">
                  <span className={cn('block h-3 rounded bg-current', BLOCK_COLOR.routing)} style={{ width: `${(100 * c.items) / maxPer}%` }} />
                </span>
                <span className={cn('text-right tabular-nums', c.items === 0 && 'text-destructive')}>{c.items}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Content validity"
          description="The team's own ratings, imported from their sheet. Raters are labels (R1, R2; E1…), never names."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Two-member competency tagging (Cohen's κ)</h4>
              {kappa ? (
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="κ" value={num(kappa.kappa)} hint={`${kappa.n} items`} />
                  <StatTile label="Agreement" value={pct(100 * kappa.agreement)} hint={`expected ${pct(100 * kappa.expected)}`} />
                  <StatTile label="Disagreements" value={kappa.disagreements.length} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tagging yet. CSV: item_id,R1,R2 with a competency id in each cell.</p>
              )}
              {data.tagging && (
                <p className="text-xs text-muted-foreground">
                  Revision {data.tagging.revision}, saved {toShortDateTime(data.tagging.updatedAt)}.
                </p>
              )}
              <ReviewImport kind="tagging" onImport={onImport} />
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Expert review (content validity index)</h4>
              {cvi ? (
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="S-CVI/Ave" value={num(cvi.sCviAve)} hint={`${cvi.experts} experts`} />
                  <StatTile label="S-CVI/UA" value={num(cvi.sCviUa)} />
                  <StatTile
                    label="Under the cut"
                    value={cvi.items.filter(i => !i.acceptable).length}
                    hint={`I-CVI < ${num(cvi.cut)}`}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No expert ratings yet. CSV: item_id,E1,E2,… ({MIN_EXPERTS}–{MAX_EXPERTS} experts), each a relevance rating 1–4.
                </p>
              )}
              {data.experts && (
                <p className="text-xs text-muted-foreground">
                  Revision {data.experts.revision}, saved {toShortDateTime(data.experts.updatedAt)}.
                </p>
              )}
              <ReviewImport kind="experts" onImport={onImport} />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="The test items" description="Every test item of the bank, with the law or source it cites.">
        {data.items.length === 0 ? (
          <EmptyState title="No test items">Test items are added on the Quiz items page, as use “test”.</EmptyState>
        ) : (
          <Table
            head={
              <>
                <Th>Item</Th>
                <Th>Competency</Th>
                <Th>Source</Th>
                <Th right>Rev.</Th>
                <Th>On</Th>
                <Th>Tags R1 / R2</Th>
                <Th right>I-CVI</Th>
              </>
            }
          >
            {data.items.map(item => {
              const tags = tagsOf.get(item.id);
              const iCvi = iCviOf.get(item.id);
              return (
                <tr key={item.id}>
                  <Td className="font-mono">{item.id}</Td>
                  <Td>{item.competency}</Td>
                  <Td className="max-w-xs text-muted-foreground">{item.source || '—'}</Td>
                  <Td right>{item.revision}</Td>
                  <Td>{item.isActive ? 'on' : 'off'}</Td>
                  <Td className={cn(tags && tags[0] !== tags[1] && 'text-destructive')}>
                    {tags ? `${tags[0]} / ${tags[1]}${tags[0] === tags[1] && tags[0] !== item.competency ? ' (≠ bank)' : ''}` : '—'}
                  </Td>
                  <Td right className={cn(iCvi && !iCvi.acceptable && 'text-destructive')}>{iCvi ? num(iCvi.iCvi) : '—'}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </div>
  );
};

// ── Calibration ───────────────────────────────────────────────────────────

const CalibrationView = ({ report }: { report: IrtReportDoc }) => {
  const left = report.items.filter(i => i.status !== 'estimated');
  const scaled = report.items.filter(i => i.difficulty !== null).sort((a, b) => a.difficulty! - b.difficulty!);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Calibration" value={<span className="font-mono text-base">{report.calibrationId}</span>} hint={`${report.method}, frozen`} />
        <StatTile label="Pre-tests calibrated" value={report.calibrationPlayers} hint={`${report.extremePlayers} at a zero or perfect score`} />
        <StatTile label="Items on the scale" value={`${report.scaleItems} of ${report.items.length}`} hint={`${left.length} left out (extreme-score rule)`} />
        <StatTile label="KR-20, pre-test" value={num(report.kr20Pre)} hint={`WLE reliability ${num(report.pre.reliability)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel title="Wright map" description="People's pre-test θ and the items' frozen b on one logit scale.">
          <WrightMap thetas={report.persons.map(p => p.thetaPre)} items={scaled.map(i => ({ id: i.itemId, b: i.difficulty! }))} />
        </Panel>
        <Panel
          title="Left out of the scale"
          description="An item everyone got right, or everyone got wrong, has no CML difficulty: it is reported and unscored at both sittings (amendment 1)."
        >
          {left.length === 0 ? (
            <p className="text-xs text-muted-foreground">None: every item has a difficulty.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {left.map(i => (
                <li key={i.itemId}>
                  <span className="font-mono">{i.itemId}</span> · {i.competency} · {i.status === 'all-correct' ? 'everyone right' : 'everyone wrong'}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel
        title="Items"
        description="b ± SE at the frozen scale; infit and outfit at the frozen b on the pre-test. Fit is shown, never used to drop an item."
      >
        <Table
          head={
            <>
              <Th>Item</Th>
              <Th>Competency</Th>
              <Th right>b</Th>
              <Th right>SE</Th>
              <Th right>Infit</Th>
              <Th right>Outfit</Th>
              <Th right>% correct (pre)</Th>
            </>
          }
        >
          {[...scaled, ...left].map(i => (
            <tr key={i.itemId}>
              <Td className="font-mono">{i.itemId}</Td>
              <Td>{i.competency}</Td>
              <Td right>{num(i.difficulty)}</Td>
              <Td right>{num(i.se)}</Td>
              <Td right>{num(i.infit)}</Td>
              <Td right>{num(i.outfit)}</Td>
              <Td right>{pct(i.pctCorrectPre)}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
};

// ── Post-test design ──────────────────────────────────────────────────────

const DesignView = ({ design, report }: { design: TwoStageDesign; report: IrtReportDoc | null }) => {
  const b = new Map(report?.items.map(i => [i.itemId, i.difficulty]) ?? []);
  const blocks: TestBlock[] = ['routing', 'easy', 'medium', 'hard'];
  const sameDesign = report?.designId === design.designId;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Design" value={<span className="font-mono text-base">{design.designId}</span>} hint={`from calibration ${design.calibrationId}`} />
        <StatTile label="Cut points" value={`[${design.cuts[0]}, ${design.cuts[1]}]`} hint={`routing score < ${design.cuts[0]} easy, < ${design.cuts[1]} medium, else hard`} />
        <StatTile label="Blocks" value={`4 × ${design.routing.length}`} hint="routing, then one of easy, medium, hard" />
      </div>
      {report && !sameDesign && (
        <Notice tone="error">The published report names design {report.designId ?? 'none'}, not the published {design.designId}.</Notice>
      )}
      {report?.curves && report.routingTable && sameDesign ? (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Panel title="Information curves" description="Where each block measures most precisely; dashed lines are the cut points.">
            <InformationCurves curves={report.curves} cuts={design.cuts} table={report.routingTable} />
          </Panel>
          <Panel
            title="Routing table"
            description="Routing score → θ̂ (WLE) → each block's information → the block chosen. People: post-tests routed from that score in the published analysis."
          >
            <Table
              head={
                <>
                  <Th right>Score</Th>
                  <Th right>θ̂</Th>
                  <Th right>Easy</Th>
                  <Th right>Medium</Th>
                  <Th right>Hard</Th>
                  <Th>Block</Th>
                  <Th right>People</Th>
                </>
              }
            >
              {report.routingTable.map(r => {
                const people = report.routing.filter(p => p.routingScore === r.score).length;
                return (
                  <tr key={r.score}>
                    <Td right>{r.score}</Td>
                    <Td right>{num(r.theta)}</Td>
                    <Td right className={cn(r.block === 'easy' && 'font-semibold')}>{num(r.information.easy)}</Td>
                    <Td right className={cn(r.block === 'medium' && 'font-semibold')}>{num(r.information.medium)}</Td>
                    <Td right className={cn(r.block === 'hard' && 'font-semibold')}>{num(r.information.hard)}</Td>
                    <Td>{BLOCK_LABEL[r.block]}</Td>
                    <Td right className={cn(people > 0 && 'font-semibold')}>{people || '—'}</Td>
                  </tr>
                );
              })}
            </Table>
          </Panel>
        </div>
      ) : (
        !report && <NotCalibrated>The routing table and the information curves come with the published analysis.</NotCalibrated>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {blocks.map(block => (
          <Panel
            key={block}
            title={<span className="flex items-center gap-2"><span className={cn('h-2.5 w-2.5 rounded-full bg-current', BLOCK_COLOR[block])} />{BLOCK_LABEL[block]}</span>}
            description={`${design[block].length} items`}
          >
            <ul className="space-y-0.5 text-xs">
              {design[block].map(id => (
                <li key={id} className="flex justify-between gap-2">
                  <span className="font-mono">{id}</span>
                  <span className="tabular-nums text-muted-foreground">{b.has(id) ? `b ${num(b.get(id))}` : ''}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
};

// ── Results ───────────────────────────────────────────────────────────────

const ResultsView = ({ data }: { data: IrtData }) => {
  const [cohort, setCohort] = useState<StudyCohort>('study');
  const participants = useMemo(() => data.participants.filter(p => p.cohort === cohort), [data.participants, cohort]);
  const counts = testCounts(participants);
  const drift = itemDrift(participants);
  const report = data.report;
  const withPost = report?.persons.filter(p => p.thetaPost !== null) ?? [];
  const inconsistent = report?.routing.filter(r => !r.consistent).length ?? 0;
  const otherCohorts = report ? Object.entries(report.cohorts).filter(([c]) => c !== 'study' && c !== 'placeholder') : [];

  return (
    <div className="space-y-4">
      <Panel
        title="Live, from the records"
        description="Counted here from every enrolled participant's test records: no model, just counts and percent correct."
        actions={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Cohort
            <select
              value={cohort}
              onChange={event => setCohort(event.target.value as StudyCohort)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              {STUDY_COHORTS.map(c => <option key={c} value={c}>{COHORT_LABEL[c]}</option>)}
            </select>
          </label>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile label="Enrolled" value={counts.enrolled} />
            <StatTile label="Pre-tests finished" value={counts.preFinished} hint={`${counts.preOpen} open`} />
            <StatTile label="Post-tests finished" value={counts.postFinished} hint={`${counts.postOpen} open`} />
            <StatTile label="Routed" value={`${counts.routed.easy} · ${counts.routed.medium} · ${counts.routed.hard}`} hint="easy · medium · hard" />
            <StatTile label="Items answered" value={drift.length} />
          </div>
          {drift.length === 0 ? (
            <p className="text-xs text-muted-foreground">No finished test in this cohort yet.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Drift, descriptive: a post-test item is answered only by those routed to its block, so its two percentages are of
                different people, and with about 20 participants no drift test applies (such methods need about 75; Jurich & Liu,
                2023). Unanswered counts as wrong.
              </p>
              <Table
                head={
                  <>
                    <Th>Item</Th>
                    <Th>Competency</Th>
                    <Th right>Pre % (n)</Th>
                    <Th right>Post % (n)</Th>
                    <Th right>Post − pre</Th>
                  </>
                }
              >
                {drift.map(d => (
                  <tr key={d.itemId}>
                    <Td className="font-mono">{d.itemId}</Td>
                    <Td>{d.competency}</Td>
                    <Td right>{`${pct(d.prePct)} (${d.preN})`}</Td>
                    <Td right>{`${pct(d.postPct)} (${d.postN})`}</Td>
                    <Td right>{d.prePct !== null && d.postPct !== null ? `${(d.postPct - d.prePct).toFixed(0)} pts` : '—'}</Td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </div>
      </Panel>

      {!report ? (
        <NotCalibrated>Gains come from raschScore.ts's anchored scoring, published after the last post-test.</NotCalibrated>
      ) : (
        <Panel
          title="The Rasch analysis"
          description={`Published ${toShortDateTime(report.generatedAt)}. WLE θ at the frozen difficulties, the same ruler at both sittings. Exploratory: one group, no comparison group; gains show the course teaches, not that the optimization works.`}
        >
          <div className="space-y-4">
            {otherCohorts.length > 0 && (
              <Notice tone="error">
                The analysed responses are not only the study cohort's: they include {otherCohorts.map(([c, n]) => `${n} from the ${COHORT_NAME[c] ?? c} cohort`).join(', ')}.
              </Notice>
            )}
            {report.gain ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Mean gain (logits)"
                  value={num(report.gain.mean)}
                  hint={`95% CI [${num(report.gain.meanCi[0])}, ${num(report.gain.meanCi[1])}], n ${report.gain.n}`}
                />
                <StatTile label="Paired t" value={`t(${report.gain.df}) = ${num(report.gain.t)}`} hint={`p = ${num(report.gain.p, 4)}`} />
                <StatTile label="d_z" value={num(report.gain.dz)} hint={`95% CI [${num(report.gain.dzCi[0])}, ${num(report.gain.dzCi[1])}]`} />
                <StatTile label="Gains beyond 1.96 SE" value={`${report.gain.beyondError} of ${report.gain.n}`} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {withPost.length < 2 ? 'Gains need at least two finished post-tests in the published analysis.' : ''}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Pre-test, Ability Estimation Error" value={num(report.pre.rmse)} hint={`n ${report.pre.n}`} />
              <StatTile label="Post-test, Ability Estimation Error" value={num(report.post?.rmse)} hint={report.post ? `n ${report.post.n}` : 'fewer than two'} />
              <StatTile
                label="Routing re-checked"
                value={`${inconsistent} of ${report.routing.length}`}
                hint={`inconsistent · ${report.revisionChanges} answer(s) at a changed revision`}
              />
            </div>
            <h4 className="text-xs font-semibold text-foreground">Each participant, by code</h4>
            <p className="text-xs text-muted-foreground">
              Ability (θ, WLE ± SE) before and after, and the gain; then the adaptation: the routing block's number correct, its row
              of the routing table (θ̂ and the block the table gives), the block the post-test sent them to, and the block most
              informative at their final θ. Those with a post-test come first. A bold gain is larger than 1.96 of its SE.
            </p>
            <Table
              head={
                <>
                  <Th>Code</Th>
                  <Th right>θ pre ± SE</Th>
                  <Th right>θ post ± SE</Th>
                  <Th right>Gain ± SE</Th>
                  <Th right>Routing score</Th>
                  <Th right>Table θ̂</Th>
                  <Th>Table block</Th>
                  <Th>Routed to</Th>
                  <Th>Most informative at θ post</Th>
                </>
              }
            >
              {[...report.persons]
                .sort((a, b) => Number(b.thetaPost !== null) - Number(a.thetaPost !== null))
                .map(p => {
                  const route = report.routing.find(r => r.playerCode === p.playerCode);
                  const row = route?.routingScore == null ? undefined : report.routingTable?.find(r => r.score === route.routingScore);
                  return (
                    <tr key={p.playerCode} data-testid={`irt-person-${p.playerCode}`}>
                      <Td className="font-mono">{p.playerCode}</Td>
                      <Td right>{`${num(p.thetaPre)} ± ${num(p.sePre)}`}</Td>
                      <Td right>{p.thetaPost === null ? '—' : `${num(p.thetaPost)} ± ${num(p.sePost)}`}</Td>
                      <Td right className={cn(p.gainBeyondError && 'font-semibold')}>
                        {p.gain === null ? '—' : `${num(p.gain)} ± ${num(p.gainSe)}`}
                      </Td>
                      <Td right>{route?.routingScore ?? '—'}</Td>
                      <Td right>{row ? num(row.theta) : '—'}</Td>
                      <Td>{row ? BLOCK_LABEL[row.block] : '—'}</Td>
                      <Td className={cn(route && !route.consistent && 'text-destructive')}>
                        {route ? `${BLOCK_LABEL[route.routed as TestBlock] ?? route.routed}${route.consistent ? '' : ' (inconsistent)'}` : '—'}
                      </Td>
                      <Td>{route?.mostInformative ? BLOCK_LABEL[route.mostInformative] : '—'}</Td>
                    </tr>
                  );
                })}
            </Table>
          </div>
        </Panel>
      )}
    </div>
  );
};

// ── The rest of the bank, from the mock exam ─────────────────────────────

const ItemBankView = ({ data }: { data: IrtData }) => {
  const { bank } = data;
  return (
    <div className="space-y-4">
      <Notice tone="info">
        The 60 test items are calibrated on the pre-test, which everyone takes. The rest of the bank is calibrated here, from
        the optional Mock Exam, as answers build up: an item's difficulty is shown once {bank.minPlayers} different players
        have answered it (first answers only). Exploratory: mock exam takers choose to take it.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Mock exam sittings" value={bank.sittings} />
        <StatTile label="Players" value={bank.players} />
        <StatTile label="Items answered" value={bank.items.length} />
        <StatTile label={`Items with ${bank.minPlayers}+ players`} value={bank.calibrated} />
      </div>
      <Panel title="Items" description="Per item: different players, share right, and the Rasch difficulty b = ln((1 − p) / p) once the item has enough players.">
        {bank.items.length === 0 ? (
          <EmptyState title="No mock exam answers yet">Sittings saved from 2026-11-13 on carry per-item answers.</EmptyState>
        ) : (
          <Table
            head={
              <>
                <Th>Item</Th>
                <Th right>Level</Th>
                <Th right>Players</Th>
                <Th right>Share right</Th>
                <Th right>b</Th>
              </>
            }
          >
            {bank.items.map(item => (
              <tr key={item.itemId}>
                <Td className="font-mono">{item.itemId}</Td>
                <Td right>{item.level ?? '—'}</Td>
                <Td right>
                  {item.players}/{bank.minPlayers}
                </Td>
                <Td right>{pct(item.p === null ? null : item.p * 100)}</Td>
                <Td right className={cn(!item.calibrated && 'text-muted-foreground')}>
                  {item.calibrated ? num(item.b) : 'collecting'}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
};

// ── The section ───────────────────────────────────────────────────────────

export const IrtSection = ({ irt, view, onView }: { irt: IrtPanel; view: IrtView; onView: (view: IrtView) => void }) => {
  const { load } = irt;
  const data = load.status === 'ready' ? load.data : null;
  const placeholder = !!data && (data.report?.placeholder || bankReadiness(data.items).placeholder);
  return (
    <div className="space-y-4">
      <SectionHeader
        title="IRT"
        description="Rasch model: the evidence for the 60 test items and the adaptive post-test. Every Rasch number is the developers' published analysis; this page estimates nothing."
        meta={
          data &&
          `Read ${toShortDateTime(data.readAt)} · ${data.report ? `analysis published ${toShortDateTime(data.report.generatedAt)}` : 'no analysis published'}`
        }
        actions={
          <Button size="sm" variant="outline" onClick={() => void irt.refresh()} disabled={load.status === 'loading'}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {placeholder && <PlaceholderBanner />}
      <SectionTabs value={view} onChange={onView} options={VIEWS} />
      {load.status === 'loading' && <p className="text-sm text-muted-foreground">Reading…</p>}
      {load.status === 'error' && <Notice tone="error">{load.error}</Notice>}
      {data && view === 'bank' && <BankView data={data} onImport={irt.importReview} />}
      {data && view === 'calibration' && (data.report ? <CalibrationView report={data.report} /> : <NotCalibrated />)}
      {data && view === 'design' &&
        (data.design ? (
          <DesignView design={data.design} report={data.report} />
        ) : (
          <NotCalibrated>The post-test's design is built on calibration day (raschAssemble.ts) and published to test_designs/post.</NotCalibrated>
        ))}
      {data && view === 'results' && <ResultsView data={data} />}
      {data && view === 'item-bank' && <ItemBankView data={data} />}
    </div>
  );
};
