/**
 * The start before the pre-test, P(L0), set by an admin (2026-11-14). Saving
 * makes an edited value set (`set-N`): the values new players get, with only
 * the start changed. Players who already started keep their set to the end.
 * The published value (0.30) is the placeholder until an admin saves another.
 */
import { useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { PUBLISHED_START_RANGE, setLabel, START_LIMITS, startProblems } from '@/domain/learner/mastery/bktValueSets';
import type { BktSets } from '@/features/admin/application/useBktSets';
import { Button } from '@/shared/ui/button';

export const BktStartSetting = ({ bkt }: { bkt: BktSets }) => {
  const { user } = useAuthSession();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  const value = Number(text);
  const problems = text.trim() === '' ? ['Enter the new start.'] : startProblems(value);
  const unchanged = problems.length === 0 && Math.abs(value - bkt.startForNew) < 1e-9;
  const outsidePublished = problems.length === 0 && (value < PUBLISHED_START_RANGE.min || value > PUBLISHED_START_RANGE.max);
  const allowed = problems.length === 0 && !unchanged && bkt.wired && !!user && !bkt.loading;

  const save = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await bkt.editStart(value, note, { uid: user.uid, email: user.email });
      setSavedAs(saved.setId);
      setText('');
      setNote('');
      setConfirming(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-border p-3 text-xs">
      <div className="font-semibold text-foreground">Start before the pre-test, P(L0)</div>
      <p className="mt-1 text-muted-foreground">
        New players start every competency at <span className="font-semibold text-foreground">{bkt.startForNew.toFixed(2)}</span> ({setLabel(bkt.state.activeSetId)}).
        Their pre-test answers then move each competency from there. The published value is {DEFAULT_BKT_MODEL.pInit.toFixed(2)}.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 font-medium text-foreground" htmlFor="bkt-start">
          New start
          <input
            id="bkt-start"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={START_LIMITS.min}
            max={START_LIMITS.max}
            value={text}
            placeholder={DEFAULT_BKT_MODEL.pInit.toFixed(2)}
            onChange={event => {
              setText(event.target.value);
              setConfirming(false);
              setSavedAs(null);
            }}
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
          />
        </label>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 font-medium text-foreground" htmlFor="bkt-start-note">
          Note for the log (optional)
          <input
            id="bkt-start-note"
            value={note}
            maxLength={500}
            onChange={event => setNote(event.target.value)}
            placeholder="e.g. agreed by the group on ..."
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
        </label>
        {!confirming ? (
          <Button size="sm" disabled={!allowed} onClick={() => setConfirming(true)}>
            Save start
          </Button>
        ) : (
          <>
            <Button size="sm" variant="destructive" disabled={busy} aria-label="Confirm start" onClick={() => void save()}>
              {busy ? 'Saving…' : `Yes, new players start at ${value.toFixed(2)}`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
      {text.trim() !== '' && problems.length > 0 && <p className="mt-2 text-destructive">{problems.join(' ')}</p>}
      {unchanged && <p className="mt-2 text-muted-foreground">That is already the start new players get.</p>}
      {outsidePublished && (
        <p className="mt-2 text-muted-foreground">
          Outside the range published BKT fits use ({PUBLISHED_START_RANGE.min} to {PUBLISHED_START_RANGE.max}, Zhang et al., 2025). Allowed, but say why in the note.
        </p>
      )}
      <p className="mt-2 text-muted-foreground">
        Saving keeps every other value of the set in force, replaces any per-competency starts a calibration fitted, and is logged in the value set log. Players
        who already started keep their values to the end of their course.
      </p>
      {savedAs && <p className="mt-2 font-medium text-foreground">Saved as {setLabel(savedAs)}: players who start from now on get it.</p>}
      {error && <p className="mt-2 text-destructive">{error}</p>}
    </div>
  );
};
