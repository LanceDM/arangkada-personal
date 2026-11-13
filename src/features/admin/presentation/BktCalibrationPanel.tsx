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
import { CALIBRATION_MINIMUMS, calibrateBkt, type BktCalibration, type Fit } from '@/features/admin/domain/bktCalibration';
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
  { term: 'Per-player T', meaning: 'Comparison only: each player\'s own learn rate, shared across their competencies. Not used by the app.' },
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

const Result = ({ result }: { result: BktCalibration }) => {
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
          bySource: result.bySource,
          minimums: CALIBRATION_MINIMUMS,
          missing: result.missing,
          model: result.model,
          starts: result.starts,
          fit: { current: result.current, calibrated: result.calibrated, perPlayerLearn: result.perPlayerLearn.fit },
          perPlayerLearn: result.perPlayerLearn.rates.map(({ label, answers, learn }) => ({ player: label, answers, learn })),
        },
        null,
        2
      ),
      'application/json'
    );
  return (
    <div className="space-y-4">
      {result.ready ? (
        <Notice>Every value could be fitted from {result.players} player(s) and {result.answers} answers. Nothing is applied: review the values with the group first.</Notice>
      ) : (
        <Notice>
          Not enough data yet for every value ({result.players} player(s), {result.answers} answers). Still missing: {result.missing.join('; ')}. Values that could not be fitted are kept as they are.
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
        description={`The group's start, from the pilot pre-tests. A competency needs pre-test answers from ${CALIBRATION_MINIMUMS.playersPerCompetency} players (Tentative); until then it keeps the value in force.`}
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
              <TableHead>Calibrated</TableHead>
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
                  {row.estimate === null ? `${row.value.toFixed(3)} (kept: too few players)` : row.estimate.toFixed(3)}
                  {row.atBound && <span className="ml-1 text-muted-foreground">at the edge</span>}
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
  const [result, setResult] = useState<{ rows: readonly Record<string, unknown>[]; value: BktCalibration } | null>(null);
  if (!rows) {
    return (
      <EmptyState icon={SlidersHorizontal} title="The logs are not loaded">
        The calibration reads the BKT update log. Press “Load the logs” first.
      </EmptyState>
    );
  }
  // A result belongs to the log it was computed from: reloading the logs clears it.
  const shown = result && result.rows === rows ? result.value : null;
  return (
    <div className="space-y-4">
      <Legend title="Legend: BKT calibration" items={LEGEND} />
      <Panel
        title="Calibrate from the logged answers"
        description="Estimates the group start per competency, the slips, the drive guess and the learn rate from every player's logged answers. It takes a few seconds and changes nothing: the app keeps the values in force until they are set in the code under a new settings version."
        actions={
          <Button size="sm" aria-label="Run the calibration" onClick={() => setResult({ rows, value: calibrateBkt(rows, label) })}>
            <Play className="mr-2 h-4 w-4" />
            {shown ? 'Run again' : 'Run the calibration'}
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground">
          {rows.length} logged BKT update(s). Fitted on a grid inside the published bounds, by the likelihood of each answer given the answers before it. Real players only.
        </p>
      </Panel>
      {shown && <Result result={shown} />}
    </div>
  );
};
