/**
 * Admin > Model evaluation > BKT calibration: the values the pilot's logged
 * answers support, beside the values in force. It estimates and shows; it
 * applies nothing.
 */
import { useState } from 'react';
import { Download, Play, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { DEFAULT_BKT_MODEL, priorFor } from '@/domain/learner/mastery/buildBKTProfile';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { downloadFile } from '@/features/admin/domain/adminExport';
import { CALIBRATION_MINIMUMS, HELD_OUT_TEST, calibrateBkt, sensitivityCheck, type BktCalibration, type Fit, type SensitivityRow } from '@/features/admin/domain/bktCalibration';
import { EmptyState, Legend, Notice, Panel } from './adminUi';

const fmt = (value: number | null | undefined, digits = 3) => (typeof value === 'number' ? value.toFixed(digits) : '–');
const fitted = (value: number | null, current: number) => (value === null ? `${current.toFixed(3)} (kept: too little data)` : value.toFixed(3));

const LEGEND = [
  { term: 'Start', meaning: 'P(L) before any answer. Now 0.30 for every competency; calibrated, one group value per competency from the pilot pre-tests. Each player\'s own pre-test answers then update it.' },
  { term: 'T (learn)', meaning: 'Chance of learning at one quiz or drive answer. One value for everyone; 0 for the pre-test and post-test (no feedback).' },
  { term: 'S (slip)', meaning: 'Chance of a wrong answer despite knowing. Shared by all players: one for 4-choice items, one for drive scenarios.' },
  { term: 'G (guess)', meaning: 'Chance of a right answer without knowing. Fixed at 0.25 for 4-choice items (1 of 4); one fitted value for drive scenarios.' },
  { term: 'Search range', meaning: 'Start 0.001–0.5, T 0.001–0.1, slip and guess 0.01–0.3 (Zhang et al., 2025). "at the edge" marks an estimate on a limit: read it with care.' },
  { term: 'Log-likelihood', meaning: 'Mean per answer, of each answer given the ones before it. Closer to 0 is better.' },
  { term: 'Same-data fit', meaning: 'The calibrated values are scored on the answers they were fitted on, so they look a little better than they will on new players.' },
  { term: 'Start rule', meaning: `A start per competency only when every competency has pre-tests from ${CALIBRATION_MINIMUMS.playersPerCompetency} players; otherwise one shared start from all pre-test answers pooled.` },
  { term: 'Sensitivity check', meaning: 'The same answers replayed with the start at 0.10 or 0.50, or every slip 0.05 lower or higher, one change at a time; shows how many final mastery levels would move.' },
  { term: 'Per-player T', meaning: 'Comparison only: each player\'s own learn rate, shared across their competencies. Not used by the app.' },
  { term: 'Held-out test', meaning: `Each player's first ${HELD_OUT_TEST.trainShare * 100}% of quiz and drive answers fit their T; the rest are predicted with it and with the shared T. Per-player T passes only if RMSE improves by ${HELD_OUT_TEST.rmseMargin} and the 95% interval stays above zero.` },
] as const;

const FitRow = ({ label, fit }: { label: string; fit: Fit }) => (
  <TableRow>
    <TableCell className="text-xs font-semibold">{label}</TableCell>
    <TableCell className="text-xs">{fit.n}</TableCell>
    <TableCell className="text-xs">{fmt(fit.logLik)}</TableCell>
    <TableCell className="text-xs">{fmt(fit.auc)}</TableCell>
    <TableCell className="text-xs">{fmt(fit.rmse)}</TableCell>
    <TableCell className="text-xs">{fmt(fit.accuracy)}</TableCell>
  </TableRow>
);

const Result = ({ result, sensitivity }: { result: BktCalibration; sensitivity: { rows: SensitivityRow[]; pairs: number } }) => {
  const current = DEFAULT_BKT_MODEL;
  const exportResult = () =>
    downloadFile(
      `bkt-calibration-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          note: 'Estimated from logged answers. Not applied: the app still runs the values in force.',
          settingsVersionInForce: RUN_CONFIG_VERSION,
          players: result.players,
          answers: result.answers,
          excluded: result.excluded,
          bySource: result.bySource,
          minimums: CALIBRATION_MINIMUMS,
          missing: result.missing,
          model: result.model,
          startRule: result.startRule,
          sharedStart: result.sharedStart,
          starts: result.starts,
          heldOutTest: { rule: HELD_OUT_TEST, result: result.perPlayerLearn.heldOut },
          fit: { current: result.current, calibrated: result.calibrated, perPlayerLearn: result.perPlayerLearn.fit },
          sensitivity,
          perPlayerLearn: result.perPlayerLearn.rates.map(({ label, answers, learn }) => ({ player: label, answers, learn })),
        },
        null,
        2
      ),
      'application/json'
    );
  return (
    <div className="space-y-4">
      {(result.excluded.postTest > 0 || result.excluded.calibratedSet > 0) && (
        <p className="text-xs text-muted-foreground">
          Left out: {result.excluded.postTest} post-test answer(s); {result.excluded.calibratedSet} answer(s) of players on the calibrated set.
        </p>
      )}
      {result.ready ? (
        <Notice>Every value could be fitted from {result.players} pilot player(s) and {result.answers} answers. Nothing is applied: review the values with the group first.</Notice>
      ) : (
        <Notice>
          Not enough data yet for every value ({result.players} pilot player(s), {result.answers} answers). Still missing: {result.missing.join('; ')}. Values that could not be fitted are kept as they are.
        </Notice>
      )}
      <Panel
        title="Values: in force and calibrated"
        description="Shared by all players and all competencies, except the start (next table)."
        actions={
          <Button variant="outline" size="sm" onClick={exportResult}>
            <Download className="mr-2 h-4 w-4" />
            Download (JSON)
          </Button>
        }
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead>In force</TableHead>
              <TableHead>Calibrated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-xs font-semibold">Slip, 4-choice items (pre-test, quiz, post-test)</TableCell>
              <TableCell className="text-xs">{current.diagnostic.pSlip.toFixed(3)}</TableCell>
              <TableCell className="text-xs">{fitted(result.slipChoice, current.diagnostic.pSlip)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-semibold">Guess, 4-choice items</TableCell>
              <TableCell className="text-xs">{current.diagnostic.pGuess.toFixed(3)}</TableCell>
              <TableCell className="text-xs">{current.diagnostic.pGuess.toFixed(3)} (fixed: 1 of 4)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-semibold">T, quiz and drive answers</TableCell>
              <TableCell className="text-xs">{current.drive.pTransit.toFixed(3)}</TableCell>
              <TableCell className="text-xs">{fitted(result.learn, current.drive.pTransit)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-semibold">T, pre-test and post-test</TableCell>
              <TableCell className="text-xs">0.000</TableCell>
              <TableCell className="text-xs">0.000 (fixed: no feedback)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-semibold">Slip, drive scenarios</TableCell>
              <TableCell className="text-xs">{current.drive.pSlip.toFixed(3)}</TableCell>
              <TableCell className="text-xs">{fitted(result.slipDrive, current.drive.pSlip)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-semibold">Guess, drive scenarios</TableCell>
              <TableCell className="text-xs">{current.drive.pGuess.toFixed(3)}</TableCell>
              <TableCell className="text-xs">{fitted(result.guessDrive, current.drive.pGuess)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Panel>
      <Panel
        title="Starting value per competency"
        description={`The group's start, from the pilot pre-tests. Rule in use: ${
          result.startRule === 'per_competency'
            ? 'one start per competency (every competency has enough players)'
            : result.startRule === 'shared'
              ? `one shared start of ${fmt(result.sharedStart)} for all (some competencies have fewer than ${CALIBRATION_MINIMUMS.playersPerCompetency} players)`
              : `the value in force is kept (fewer than ${CALIBRATION_MINIMUMS.playersPerCompetency} players with pre-test answers)`
        }. Shared start from all pre-test answers pooled: ${fmt(result.sharedStart)}.`}
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competency</TableHead>
              <TableHead>Players</TableHead>
              <TableHead>Pre-test answers</TableHead>
              <TableHead>Share right</TableHead>
              <TableHead>In force</TableHead>
              <TableHead>Own estimate</TableHead>
              <TableHead>Calibrated (by the rule)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.starts.map(row => (
              <TableRow key={row.competency}>
                <TableCell className="text-xs font-semibold">{getCompetencyLabel(row.competency)}</TableCell>
                <TableCell className="text-xs">{row.players}</TableCell>
                <TableCell className="text-xs">{row.answers}</TableCell>
                <TableCell className="text-xs">{fmt(row.shareRight, 2)}</TableCell>
                <TableCell className="text-xs">{priorFor(current, row.competency).toFixed(3)}</TableCell>
                <TableCell className="text-xs">
                  {row.estimate === null ? 'too few players' : row.estimate.toFixed(3)}
                  {row.atBound && <span className="ml-1 text-muted-foreground">at the edge</span>}
                </TableCell>
                <TableCell className="text-xs font-semibold">
                  {row.value.toFixed(3)}
                  {result.startRule === 'kept' && <span className="ml-1 font-normal text-muted-foreground">(kept)</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel title="Fit, on the same answers" description="How well each set of values predicts every logged answer from the answers before it." bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Values</TableHead>
              <TableHead>Answers</TableHead>
              <TableHead>Log-likelihood</TableHead>
              <TableHead>AUC</TableHead>
              <TableHead>RMSE</TableHead>
              <TableHead>Accuracy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <FitRow label="In force" fit={result.current} />
            <FitRow label="Calibrated" fit={result.calibrated} />
            <FitRow label={`Calibrated + per-player T (${result.perPlayerLearn.fitted} player(s) fitted)`} fit={result.perPlayerLearn.fit} />
          </TableBody>
        </Table>
      </Panel>
      <Panel
        title="Sensitivity check"
        description={`Every logged answer (post-test included) replayed with nearby values, one change at a time. "Levels changed" is the share of the ${sensitivity.pairs} player-competency pairs whose final mastery level differs from the values in force. If conclusions hold across these rows, they do not hinge on the exact values.`}
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Values</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Log-likelihood</TableHead>
              <TableHead>AUC</TableHead>
              <TableHead>RMSE</TableHead>
              <TableHead>Levels changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sensitivity.rows.map(row => (
              <TableRow key={row.label}>
                <TableCell className="text-xs font-semibold">{row.label}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.change}</TableCell>
                <TableCell className="text-xs">{fmt(row.fit.logLik)}</TableCell>
                <TableCell className="text-xs">{fmt(row.fit.auc)}</TableCell>
                <TableCell className="text-xs">{fmt(row.fit.rmse)}</TableCell>
                <TableCell className="text-xs">{row.levelsChanged === null ? '–' : `${(row.levelsChanged * 100).toFixed(0)}%`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel
        title={`Held-out test of per-player T: ${result.perPlayerLearn.heldOut.players === 0 ? 'not enough answers yet' : result.perPlayerLearn.heldOut.adopt ? 'passes' : 'does not pass (keep the shared T)'}`}
        description={`Rule set in advance (Tentative): adopt a learn rate per player only if held-out RMSE improves by at least ${HELD_OUT_TEST.rmseMargin} and the 95% interval of the improvement, players resampled, stays above zero. ${result.perPlayerLearn.heldOut.players} player(s), ${result.perPlayerLearn.heldOut.answers} held-out answers.`}
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>On the held-out answers</TableHead>
              <TableHead>RMSE</TableHead>
              <TableHead>AUC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-xs font-semibold">Shared T</TableCell>
              <TableCell className="text-xs">{fmt(result.perPlayerLearn.heldOut.shared.rmse)}</TableCell>
              <TableCell className="text-xs">{fmt(result.perPlayerLearn.heldOut.shared.auc)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-semibold">Per-player T (fitted on the earlier answers)</TableCell>
              <TableCell className="text-xs">{fmt(result.perPlayerLearn.heldOut.perPlayer.rmse)}</TableCell>
              <TableCell className="text-xs">{fmt(result.perPlayerLearn.heldOut.perPlayer.auc)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-semibold">RMSE improvement (95% interval)</TableCell>
              <TableCell className="text-xs" colSpan={2}>
                {fmt(result.perPlayerLearn.heldOut.improvement, 4)}
                {result.perPlayerLearn.heldOut.interval && ` (${result.perPlayerLearn.heldOut.interval[0].toFixed(4)} to ${result.perPlayerLearn.heldOut.interval[1].toFixed(4)})`}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Panel>
      <Panel
        title="Per-player learn rate (comparison only)"
        description={`Each player's own T, shared across their competencies, with the calibrated values for everything else. Needs ${CALIBRATION_MINIMUMS.answersPerPlayerT} quiz and drive answers; others use the group T. The app does not use it.`}
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Quiz and drive answers</TableHead>
              <TableHead>Own T</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.perPlayerLearn.rates.map(row => (
              <TableRow key={row.uid}>
                <TableCell className="font-mono text-xs">{row.label}</TableCell>
                <TableCell className="text-xs">{row.answers}</TableCell>
                <TableCell className="text-xs">{row.learn === null ? 'group T (too few answers)' : row.learn.toFixed(3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
};

export const BktCalibrationPanel = ({ rows, label }: { rows: readonly Record<string, unknown>[] | null; label: (uid: string) => string }) => {
  const [result, setResult] = useState<{ rows: readonly Record<string, unknown>[]; value: BktCalibration; sensitivity: ReturnType<typeof sensitivityCheck> } | null>(null);
  if (!rows) {
    return (
      <EmptyState icon={SlidersHorizontal} title="The logs are not loaded">
        The calibration reads the BKT update log. Press “Load the logs” first.
      </EmptyState>
    );
  }
  // A result belongs to the log it was computed from: reloading the logs clears it.
  const shown = result && result.rows === rows ? result : null;
  return (
    <div className="space-y-4">
      <Legend title="Legend: BKT calibration" items={LEGEND} />
      <Panel
        title="Calibrate from the logged answers"
        description="Estimates the group start per competency, the slips, the drive guess and the learn rate from every player's logged answers. It takes a few seconds and changes nothing: the app keeps the values in force until they are set in the code under a new settings version."
        actions={
          <Button size="sm" aria-label="Run the calibration" onClick={() => setResult({ rows, value: calibrateBkt(rows, label), sensitivity: sensitivityCheck(rows) })}>
            <Play className="mr-2 h-4 w-4" />
            {shown ? 'Run again' : 'Run the calibration'}
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground">
          {rows.length} logged BKT update(s). Fitted on pilot players only (a player is marked pilot in the database when they start, and keeps the mark), on their pre-test, quiz and drive answers: post-test answers still update each player's final BKT but are not used here. Grid search inside the published bounds, by the likelihood of each answer given the answers before it. Real players only.
        </p>
      </Panel>
      {shown && <Result result={shown.value} sensitivity={shown.sensitivity} />}
    </div>
  );
};
