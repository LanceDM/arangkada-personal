// Dev-only. Reads back what the adaptive layer currently believes about the
// player at the keyboard, from their real history - the same history real play
// reads (`loadLearnerHistory`), so what is shown here is what the game saw.
//
// The three algorithms it windows into are each unit-tested in isolation and
// each correct in isolation. What no test can answer is whether they are wired
// to anything: whether BKT is being fed the whole cross-session history or an
// empty array, whether the difficulty controller has ever left tier 2 for a
// real learner, whether a remediation scenario that was injected was actually
// reached, answered and logged. That is what this page is for - it computes
// nothing of its own and changes nothing, it only calls the same functions
// gameplay calls and prints the answers.
//
// Only registered as a route when import.meta.env.DEV (see app/AppRouter.tsx).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { getActiveFSM } from '@/features/driving-sim/domain/fsm/devRegistry';
import { computeFsmMetrics } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { COMPETENCIES, getLowestScoringCompetency } from '@/domain/learner/profile';
import { MASTERY_THRESHOLD, adaptsLevel, levelSupport, selectPractice } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { GAME_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import { actionKey } from '@/domain/learner/adaptive/qLearningPolicy';
import { createRng } from '@/shared/lib/rng';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { ActionLog } from '@/domain/learner/attempt';
import { historyLogs, loadLearnerHistory, type LearnerHistory, } from '@/features/driving-sim/application/learnerHistory';

/** How much of the transition tail to show. Enough to see one event's worth of transitions, not a replay. */
const FSM_TAIL = 20;

/** One remediation-tagged log entry, paired with the level it was actually played in. */
interface RemediationEntry {
  playedInLevel: number;
  log: ActionLog;
}

const card = 'rounded-lg border border-border bg-card/60 p-4';
const heading = 'mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground';
const cell = 'px-2 py-1 text-left';

const formatTime = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleString() : '—';

/**
 * Deterministic, so opening the page twice on the same history shows the same
 * prediction rather than a fresh random pick each render. `selectRemediation`
 * defaults to Math.random for the tie-break between equally suitable variants.
 */
const previewRng = createRng(1);

const LearnerProfileLab = () => {
  const { user, isLoggedIn } = useAuthSession();
  const [history, setHistory] = useState<LearnerHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewLevel, setPreviewLevel] = useState(8);
  // Neither the history nor `getTransitionLog()` is reactive - one is a
  // one-shot fetch, the other a plain method on a plain object - so a bump
  // here is what re-reads both.
  const [reloadNonce, setReloadNonce] = useState(0);

  const uid = isLoggedIn && user ? user.uid : null;

  useEffect(() => {
    let cancelled = false;
    loadLearnerHistory(uid)
      .then(loaded => {
        if (!cancelled) setHistory(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [uid, reloadNonce]);

  const loading = history === null && error === null;
  const reload = useCallback(() => setReloadNonce(n => n + 1), []);

  const logs = useMemo(() => (history ? historyLogs(history) : []), [history]);

  // Exactly the calls gameplay makes, on exactly the logs gameplay would pass.
  const profile = useMemo(() => buildBKTLearnerProfile(logs), [logs]);
  const weakest = useMemo(() => getLowestScoringCompetency(profile, GAME_OPTIONS.weakestTieBreak), [profile]);

  const rows = useMemo(
    () => [...COMPETENCIES].sort((a, b) => profile[a].score - profile[b].score),
    [profile]
  );

  // The route the pick is made against is the level as authored. For Levels 0
  // and 6-12 that is exactly what a real entry drives; for a pooled level it
  // stands in for the attempt's own roll, which does not exist until one is
  // started.
  const previewRoute = useMemo(
    () => new Set((LEVELS.find(level => level.id === previewLevel)?.events ?? []).map(event => event.id)),
    [previewLevel]
  );
  const wouldFire = useMemo(
    () =>
      logs.length > 0
        ? selectPractice(logs, previewLevel, previewRng, previewRoute, GAME_OPTIONS.weakestTieBreak)
        : null,
    [logs, previewLevel, previewRoute]
  );

  const remediationEntries = useMemo<RemediationEntry[]>(
    () =>
      (history?.attempts ?? []).flatMap(attempt =>
        attempt.logs
          .filter(log => log.remediation)
          .map(log => ({ playedInLevel: attempt.levelId, log }))
      ),
    [history]
  );

  const transitions = useMemo(() => {
    void reloadNonce;
    return getActiveFSM()?.getTransitionLog() ?? null;
  }, [reloadNonce]);

  const fsmMetrics = useMemo(() => (transitions ? computeFsmMetrics(transitions) : null), [transitions]);

  const gradedCount = logs.filter(log => log.result !== 'neutral').length;

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="font-display text-lg font-black uppercase tracking-wider">Algorithm Inspector</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        What BKT and the Q-learning practice selector currently believe about the player at this keyboard, computed
        from their real history. Read-only — nothing here writes, scores or adapts.
      </p>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-4">
          {/* ── Where the history came from ─────────────────────────────── */}
          <div className={card}>
            <p className={heading}>History source</p>
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-destructive">Failed to load history: {error}</p>}
            {history && !loading && (
              <div className="grid gap-2 text-sm">
                <p>
                  <span className="font-mono text-primary">{history.source}</span>
                  {history.source === 'firestore' ? (
                    <> — every saved attempt for uid <span className="font-mono text-xs">{uid}</span>.</>
                  ) : (
                    <> — guest play. The local store keeps only the <strong>best</strong> attempt per level, so this
                    is a smaller history than a signed-in player of the same skill would have, and it lives in
                    memory only: a page reload empties it. Reaching this page by typing the URL is a reload, so
                    a guest sees zero attempts however much they just played. Navigate here from inside the app
                    instead — <span className="font-mono">
                      {"history.pushState({}, '', '/dev/profile'); dispatchEvent(new PopStateEvent('popstate'))"}
                    </span> in the console does it. Signed-in
                    history comes from Firestore and survives reloads.</>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {history.attempts.length} attempt(s), {logs.length} log entries ({gradedCount} graded).
                </p>
                {/* BKT, the difficulty walk and recentStreak are all
                    sequential replays, so the order `historyLogs` hands them
                    matters. It sorts by each log's own timestamp regardless
                    of attempt order - `attempts` above may arrive
                    newest-first (Firestore) or in level-id order (local),
                    but `logs` below is always chronological. */}
                <p className="text-xs text-muted-foreground">
                  Replay order as handed to BKT: chronological — <span className="font-mono">historyLogs</span>{' '}
                  sorts every log by its own timestamp, independent of the order {history.source === 'firestore' ? 'Firestore returned the attempts in' : 'the local store iterated the attempts in'}.
                </p>
                <button
                  onClick={reload}
                  className="justify-self-start rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  Reload
                </button>
              </div>
            )}
          </div>

          {/* ── BKT mastery + the tier the controller derived ────────────── */}
          <div className={card}>
            <p className={heading}>BKT profile</p>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No history yet — every competency sits at the BKT prior (30). Play a level, or use{' '}
                <span className="font-mono">/dev/scenarios</span>' fake-history panel to preview the selector.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className={cell}>Competency</th>
                    <th className={cell}>BKT</th>
                    <th className={cell}>Attempts</th>
                    <th className={cell}>Correct</th>
                    <th className={cell}>Violations</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {rows.map(competency => {
                    const stats = profile[competency];
                    const below = stats.score < MASTERY_THRESHOLD;
                    return (
                      <tr key={competency} className="border-t border-border/50">
                        <td className={cell}>
                          {competency}
                          {competency === weakest && (
                            // What selectPractice targets first. Not always
                            // an attempted competency: an untouched one sits at
                            // the prior, which is below mastery by design.
                            <span className="ml-1.5 text-amber-500">← weakest</span>
                          )}
                        </td>
                        <td className={`${cell} ${below ? 'text-destructive' : 'text-emerald-500'}`}>{stats.score}</td>
                        <td className={cell}>{stats.attempts}</td>
                        <td className={cell}>{stats.correct}</td>
                        <td className={cell}>{stats.violations}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Below {MASTERY_THRESHOLD} is what makes the practice selector fire.
            </p>
          </div>

          {/* ── Every remediation-tagged decision ever logged ────────────── */}
          <div className={card}>
            <p className={heading}>Remediation history ({remediationEntries.length})</p>
            {remediationEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No injected scenario has been graded yet. Either the selector has never fired for this player, or it
                fired and the event was never reached — remediation is appended after the level's own last event, so
                a run that ends early never meets it.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className={cell}>When</th>
                    <th className={cell}>Played in</th>
                    <th className={cell}>From</th>
                    <th className={cell}>Competency</th>
                    <th className={cell}>Shown at</th>
                    <th className={cell}>Result</th>
                    <th className={cell}>Action</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {remediationEntries.map(({ playedInLevel, log }, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className={cell}>{formatTime(log.timestamp)}</td>
                      <td className={cell}>L{playedInLevel}</td>
                      <td className={cell}>{log.sourceLevelId !== undefined ? `L${log.sourceLevelId}` : '—'}</td>
                      <td className={cell}>{log.competency ?? '—'}</td>
                      {/* The support level h since support levels were added; before it, the timing
                          mode, which is not a support level - every briefing then
                          showed the move. */}
                      <td className={cell}>
                        {log.support ?? (log.mode ? `${log.mode} (old timing mode)` : '—')}
                      </td>
                      <td className={`${cell} ${log.result === 'correct' ? 'text-emerald-500' : 'text-destructive'}`}>
                        {log.result}
                      </td>
                      <td className={cell}>
                        {log.action}
                        {log.result !== 'correct' && log.expectedAction ? ` (wanted ${log.expectedAction})` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          {/* ── The selector's live decision ─────────────────────────────── */}
          <div className={card}>
            <p className={heading}>selectPractice, right now</p>
            <label className="flex items-center gap-2 text-sm">
              Entering level
              <select
                value={previewLevel}
                onChange={e => setPreviewLevel(Number(e.target.value))}
                className="rounded-md border border-border bg-background px-2 py-1"
              >
                {LEVELS.map(level => (
                  <option key={level.id} value={level.id}>
                    {level.id}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 font-mono text-xs">
              {wouldFire ? (
                <>
                  <span className="text-amber-500">→ </span>
                  practising <strong>{wouldFire.competency}</strong>
                  {wouldFire.competency !== wouldFire.weakestCompetency &&
                    ` (stand-in for ${wouldFire.weakestCompetency})`}{' '}
                  at support {wouldFire.support}, borrowed from level {wouldFire.sourceLevelId} ({wouldFire.variant.id})
                  <span className="mt-2 block text-muted-foreground">
                    Q-state <span className="font-mono">{wouldFire.state}</span> → action{' '}
                    <span className="font-mono">{actionKey(wouldFire.action)}</span>
                  </span>
                  {!adaptsLevel(previewLevel) && (
                    <span className="mt-2 block text-muted-foreground">
                      Not applied: the final exam does not adapt.
                    </span>
                  )}
                  <span className="mt-2 block text-muted-foreground">{wouldFire.reason}</span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  → null. {logs.length === 0
                    ? 'No history to decide from.'
                    : 'Nothing below the mastery threshold, or no portable content teaches what is needed at or before this level.'}
                </span>
              )}
            </p>
            <p className="mt-2 font-mono text-xs">
              Support level h for that level:{' '}
              <strong>{levelSupport(previewLevel, adaptsLevel(previewLevel) ? wouldFire : null)}</strong>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              A prediction of what entering that level would append, not a record that it did. The real decision is
              taken in StoryMode's pre-level effect and logged to the console as{' '}
              <span className="font-mono">[practice]</span>.
            </p>
          </div>

          {/* ── FSM metrics ──────────────────────────────────────────────── */}
          <div className={card}>
            <p className={heading}>FSM metrics (this drive)</p>
            {fsmMetrics === null ? (
              <p className="text-sm text-muted-foreground">Nothing driven in this tab yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
                <div className="rounded bg-background px-2 py-1.5">
                  <span className="block text-muted-foreground">Transitions</span>
                  {fsmMetrics.totalTransitions}
                </div>
                <div className="rounded bg-background px-2 py-1.5">
                  <span className="block text-muted-foreground">Correct / Incorrect</span>
                  <span className="text-emerald-500">{fsmMetrics.correctVerdicts}</span>
                  {' / '}
                  <span className="text-destructive">{fsmMetrics.incorrectVerdicts}</span>
                </div>
                <div className="rounded bg-background px-2 py-1.5">
                  <span className="block text-muted-foreground">Accuracy</span>
                  {fsmMetrics.accuracy === null ? '—' : `${Math.round(fsmMetrics.accuracy * 100)}%`}
                </div>
                <div className="rounded bg-background px-2 py-1.5">
                  <span className="block text-muted-foreground">Recoveries</span>
                  {fsmMetrics.recoveryEntries}
                </div>
                <div className="rounded bg-background px-2 py-1.5">
                  <span className="block text-muted-foreground">Crashes</span>
                  {fsmMetrics.crashes}
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Correct/Incorrect only counts since the <span className="font-mono">answer_correct</span>/
              <span className="font-mono">answer_incorrect</span> trigger fix — a right-of-way/parking/emergency
              cutscene answered wrong used to leave no trace here at all.
            </p>
          </div>

          {/* ── FSM transition tail ─────────────────────────────────────── */}
          <div className={card}>
            <p className={heading}>
              FSM transition tail{transitions ? ` (last ${Math.min(FSM_TAIL, transitions.length)} of ${transitions.length})` : ''}
            </p>
            {transitions === null ? (
              <p className="text-sm text-muted-foreground">
                Nothing driven in this tab yet. Play a level, then come back — the instance and its log outlive the
                screen that made it.
              </p>
            ) : (
              <div className="grid max-h-[50vh] gap-1 overflow-y-auto font-mono text-[11px]">
                {transitions.slice(-FSM_TAIL).reverse().map((entry, i) => (
                  <div key={i} className="rounded bg-background px-2 py-1">
                    <span className="text-muted-foreground">{entry.from}</span>
                    <span className="text-primary"> —{entry.trigger}→ </span>
                    <span>{entry.to}</span>
                    <span className="ml-1 text-muted-foreground">
                      [{entry.snapshot.competency}]
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              The most recent real drive's <span className="font-mono">DrivingFSM</span> in this tab — normal play or{' '}
              <span className="font-mono">/dev/scenarios</span>, whichever came last. A fresh instance replaces it
              every time you enter a level, so this only ever shows the latest one, not your whole session.{' '}
              <span className="font-mono">/dev/fsm</span>'s own hand-fired triggers never appear here — that console
              drives a scratch instance kept deliberately separate, so poking at it can't overwrite this. Snapshot
              only; press Reload above to re-read it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnerProfileLab;
