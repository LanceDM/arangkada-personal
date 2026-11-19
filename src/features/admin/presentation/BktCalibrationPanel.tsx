/**
 * Admin > Model evaluation > BKT calibration (2026-11-13): the values the
 * marked pilot players' logged answers support, beside the values new players
 * get now; applying them as the next calibration; and the log of every
 * calibration and every pilot mark.
 */
import { Fragment, useState } from 'react';
import { CheckCircle2, Download, Play, SlidersHorizontal } from 'lucide-react';
import { useAuthSession } from '@/features/auth';
import { MIN_PILOT_PLAYERS, modelOfSet, setLabel } from '@/domain/learner/mastery/bktValueSets';
import type { BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import type { BktSets } from '@/features/admin/application/useBktSets';
import { toDateTime } from './formatDate';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { priorFor } from '@/domain/learner/mastery/buildBKTProfile';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { downloadFile } from '@/features/admin/domain/adminExport';
import { isStartEdit } from '@/features/admin/domain/bktSetsAdmin';
import { CALIBRATION_MINIMUMS, HELD_OUT_TEST, calibrateBkt, calibrationRecord, canApply, sensitivityCheck, type BktCalibration, type Fit, type SensitivityRow } from '@/features/admin/domain/bktCalibration';
import { EmptyState, Legend, Notice, Panel } from './adminUi';

const fmt = (value: number | null | undefined, digits = 3) => (typeof value === 'number' ? value.toFixed(digits) : '–');
const fitted = (value: number | null, current: number) => (value === null ? `${current.toFixed(3)} (kept: too little data)` : value.toFixed(3));

const LEGEND = [
  { term: 'Start', meaning: 'P(L) before any answer: one group value per competency from the marked players\' pre-tests (or one shared value). Each player\'s own pre-test answers then update it.' },
  { term: 'T (learn)', meaning: 'Chance of learning at one quiz or drive answer. One value for everyone; 0 for the pre-test and post-test (no feedback).' },
  { term: 'S (slip)', meaning: 'Chance of a wrong answer despite knowing. Shared by all players: one for 4-choice items, one for drive scenarios.' },
  { term: 'G (guess)', meaning: 'Chance of a right answer without knowing. Not calibrated: 0.25 for 4-choice items (1 of 4), 0.20 for drive scenarios.' },
  { term: 'Search range', meaning: 'Start 0.001–0.5, T 0.001–0.1, slip 0.01–0.3 (Zhang et al., 2025). "at the edge" marks an estimate on a limit: read it with care.' },
  { term: 'Pilot players', meaning: `Only players ticked Pilot on BKT & export are used, whatever value set they run on. At least ${MIN_PILOT_PLAYERS} with pre-tests are needed to apply.` },
  { term: 'Apply', meaning: 'Saves the calibrated values as the next numbered set, with this log, and gives it to every player who starts from then on. Players who already started keep their set. A saved set can never be edited.' },
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

const Result = ({ result, sensitivity, base, baseLabel }: { result: BktCalibration; sensitivity: { rows: SensitivityRow[]; pairs: number }; base: BKTModel; baseLabel: string }) => {
  const current = base;
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
      {(result.excluded.postTest > 0 || result.excluded.notPilot > 0) && (
        <p className="text-xs text-muted-foreground">
          Left out: {result.excluded.notPilot} answer(s) of players not marked pilot; {result.excluded.postTest} post-test answer(s) of pilot players.
        </p>
      )}
      {result.ready ? (
        <Notice>Every value could be fitted from {result.players} pilot player(s) and {result.answers} answers. Nothing is applied until you press Apply below.</Notice>
      ) : (
        <Notice>
          Not enough data yet for every value ({result.players} pilot player(s), {result.answers} answers). Still missing: {result.missing.join('; ')}. Values that could not be fitted are kept as they are.
        </Notice>
      )}
      <Panel
        title={`Values: ${baseLabel} and calibrated`}
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
              <TableHead>{baseLabel}</TableHead>
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
              <TableCell className="text-xs">{current.diagnostic.pGuess.toFixed(3)} (not calibrated: 1 of 4)</TableCell>
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
              <TableCell className="text-xs">{current.drive.pGuess.toFixed(3)} (not calibrated)</TableCell>
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
              <TableHead>{baseLabel}</TableHead>
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

const ApplyPanel = ({ result, sensitivity, bkt, label, onApplied }: { result: BktCalibration; sensitivity: SensitivityRow[]; bkt: BktSets; label: (uid: string) => string; onApplied: (setId: string) => void }) => {
  const { user } = useAuthSession();
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = bkt.state.number + 1;
  const allowed = canApply(result) && bkt.wired && !!user;
  const pilots = [...bkt.pilotIds].map(uid => ({ uid, label: label(uid) })).sort((a, b) => a.label.localeCompare(b.label));

  const apply = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const record = calibrationRecord({ result, sensitivity, pilots, state: bkt.state, note, settingsVersion: RUN_CONFIG_VERSION });
      const saved = await bkt.apply(record, { uid: user.uid, email: user.email });
      onApplied(saved.setId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={`Apply as Calibration ${next}`}
      description={`Saves these values, with everything above as its log, and gives them to every player who starts from now on. Players who already started keep ${'their'} set to the end. A saved calibration can never be edited; a later calibration replaces it for new players only.`}
    >
      {!canApply(result) && (
        <p className="mb-2 text-xs text-muted-foreground">Needs at least {MIN_PILOT_PLAYERS} players marked pilot with pre-test answers.</p>
      )}
      <label className="block text-xs font-medium text-foreground" htmlFor="calibration-note">
        Note for the log (optional)
      </label>
      <textarea
        id="calibration-note"
        value={note}
        maxLength={500}
        onChange={event => setNote(event.target.value)}
        className="mt-1 h-16 w-full rounded-md border border-input bg-background p-2 text-xs"
        placeholder="e.g. pilot of 7, agreed by the group on ..."
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Pilot players used ({pilots.length}): {pilots.map(p => p.label).join(', ') || '–'}
      </p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!confirming ? (
          <Button size="sm" disabled={!allowed} onClick={() => setConfirming(true)}>
            Apply as Calibration {next}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="destructive" disabled={busy} aria-label="Confirm apply" onClick={() => void apply()}>
              {busy ? 'Saving…' : `Yes, new players get Calibration ${next}`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
};

const range = (values: number[]) => {
  if (values.length === 0) return '–';
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? low.toFixed(3) : `${low.toFixed(3)}–${high.toFixed(3)}`;
};

/** Every applied calibration and every pilot mark, newest first. */
export const CalibrationLog = ({ bkt }: { bkt: BktSets }) => {
  const [open, setOpen] = useState<string | null>(null);
  const sets = [...bkt.sets].reverse();
  return (
    <div className="space-y-4">
      <Panel
        title="Value set log"
        description={`Every calibration applied and every edited start, newest first. New players get: ${setLabel(bkt.state.activeSetId)}. Click a row for its starts, its pilot players and its note.`}
        bodyClassName="p-0"
      >
        {sets.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No set saved yet: every player runs on the default values.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Pilot players</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>T</TableHead>
                  <TableHead>Slip (4-choice · drive)</TableHead>
                  <TableHead>RMSE before → after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sets.map(set => (
                  <Fragment key={set.setId}>
                    <TableRow className="cursor-pointer" onClick={() => setOpen(open === set.setId ? null : set.setId)}>
                      <TableCell className="text-xs font-semibold">
                        {setLabel(set.setId)}
                        {set.setId === bkt.state.activeSetId && <span className="ml-1 text-muted-foreground">(new players)</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {toDateTime(set.appliedAt)}
                        <div className="text-muted-foreground">{set.appliedByEmail ?? set.appliedBy}</div>
                      </TableCell>
                      <TableCell className="text-xs">{isStartEdit(set) ? '–' : set.pilots.length}</TableCell>
                      <TableCell className="text-xs">
                        {isStartEdit(set)
                          ? `${fmt(set.previousStart)} → ${fmt(set.start)} (edited)`
                          : set.startRule === 'shared'
                            ? `shared ${fmt(set.sharedStart)}`
                            : range(set.starts.map(s => s.value))}
                      </TableCell>
                      <TableCell className="text-xs">{fmt(set.model.drive.pTransit)}</TableCell>
                      <TableCell className="text-xs">
                        {fmt(set.model.diagnostic.pSlip)} · {fmt(set.model.drive.pSlip)}
                      </TableCell>
                      <TableCell className="text-xs">{isStartEdit(set) ? 'not refitted' : `${fmt(set.fit.before.rmse)} → ${fmt(set.fit.after.rmse)}`}</TableCell>
                    </TableRow>
                    {open === set.setId && isStartEdit(set) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 text-xs">
                          <p>
                            <span className="font-semibold">Start before the pre-test changed:</span> {fmt(set.previousStart)} → {fmt(set.start)}, for every competency.
                            Everything else is as in {setLabel(set.basedOn)} · settings version {set.settingsVersion}.
                          </p>
                          {set.note && (
                            <p className="mt-1">
                              <span className="font-semibold">Note:</span> {set.note}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {open === set.setId && !isStartEdit(set) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 text-xs">
                          <p>
                            <span className="font-semibold">Based on:</span> {setLabel(set.basedOn)} · settings version {set.settingsVersion} · {set.data.players} pilot player(s),{' '}
                            {set.data.answers} answers ({set.data.bySource.diagnostic} pre-test, {set.data.bySource.quiz} quiz, {set.data.bySource.drive} drive)
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">Starts:</span>{' '}
                            {set.starts.map(s => `${getCompetencyLabel(s.competency)} ${s.value.toFixed(3)}`).join(' · ')}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">Pilot players:</span> {set.pilots.map(p => p.label).join(', ')}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">Held-out test of per-player T:</span>{' '}
                            {set.heldOut.players === 0 ? 'not enough answers' : set.heldOut.adopt ? 'passed (not applied: the app uses the shared T)' : 'did not pass'}
                          </p>
                          {set.missing.length > 0 && (
                            <p className="mt-1">
                              <span className="font-semibold">Kept as before:</span> {set.missing.join('; ')}
                            </p>
                          )}
                          {set.note && (
                            <p className="mt-1">
                              <span className="font-semibold">Note:</span> {set.note}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      <Panel title="Pilot marks log" description="Every time a player was marked or unmarked pilot, newest first." bodyClassName="p-0">
        {bkt.pilotLog.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No player marked yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bkt.pilotLog.slice(0, 200).map((entry, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap text-xs">{toDateTime(entry.at)}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.label}</TableCell>
                  <TableCell className="text-xs">{entry.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
};

export const BktCalibrationPanel = ({ rows, label, bkt }: { rows: readonly Record<string, unknown>[] | null; label: (uid: string) => string; bkt: BktSets }) => {
  const [result, setResult] = useState<{ rows: readonly Record<string, unknown>[]; pilots: string; value: BktCalibration; sensitivity: ReturnType<typeof sensitivityCheck> } | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const pilotsKey = [...bkt.pilotIds].sort().join('|');
  const base = modelOfSet(bkt.state.activeSetId, bkt.models);
  const baseLabel = setLabel(bkt.state.activeSetId);
  if (!rows) {
    return (
      <div className="space-y-4">
        <EmptyState icon={SlidersHorizontal} title="The logs are not loaded">
          The calibration reads the BKT update log. Press “Load the logs” first.
        </EmptyState>
        <CalibrationLog bkt={bkt} />
      </div>
    );
  }
  // A result belongs to the log and the pilot marks it was computed from: a change to either clears it.
  const shown = result && result.rows === rows && result.pilots === pilotsKey ? result : null;
  return (
    <div className="space-y-4">
      <Legend title="Legend: BKT calibration" items={LEGEND} />
      <Panel
        title="Calibrate from the pilot players"
        description={`Fits the start per competency, T and the two slips on the answers of the ${bkt.pilotIds.size} player(s) marked pilot; the guesses stay as they are. It takes a few seconds and changes nothing until you apply it.`}
        actions={
          <Button
            size="sm"
            aria-label="Run the calibration"
            onClick={() => (setApplied(null), setResult({ rows, pilots: pilotsKey, value: calibrateBkt(rows, label, base, bkt.pilotIds), sensitivity: sensitivityCheck(rows.filter(row => bkt.pilotIds.has(String(row.uid))), base) }))}
          >
            <Play className="mr-2 h-4 w-4" />
            {shown ? 'Run again' : 'Run the calibration'}
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground">
          {rows.length} logged BKT update(s). Pilot players' pre-test, quiz and drive answers are used, whatever value set they run on; post-test answers still update each player's final BKT but are not used here. Grid search inside the published bounds, by the likelihood of each answer given the answers before it. Real players only.
        </p>
      </Panel>
      {applied && !shown && (
        <Notice>
          <CheckCircle2 className="mr-1 inline h-4 w-4" /> {applied} is saved and is now the set new players get. Players who already started keep theirs.
        </Notice>
      )}
      {shown && (
        <>
          <Result result={shown.value} sensitivity={shown.sensitivity} base={base} baseLabel={baseLabel} />
          <ApplyPanel
            result={shown.value}
            sensitivity={shown.sensitivity.rows}
            bkt={bkt}
            label={label}
            onApplied={setId => {
              // The result is spent: applying it again would save the same values as the next calibration.
              setResult(null);
              setApplied(setLabel(setId));
            }}
          />
        </>
      )}
      <CalibrationLog bkt={bkt} />
    </div>
  );
};
