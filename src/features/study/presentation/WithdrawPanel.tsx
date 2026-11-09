import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { withdrawFromStudy } from '@/features/study/application/studyActions';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote } from './studyFields';
import { studyMessages as m } from './messages';

/**
 * Withdrawing: the participant confirms, and from then
 * on the app records nothing more. What they already gave is kept under
 * their code, as the consent page says before they agree; nothing is
 * deleted. It is recorded once, and nothing opens after it.
 */
export const WithdrawPanel = ({ code, onWithdrawn }: { code: string; onWithdrawn: () => void }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const text = useText();

  if (!open) {
    return (
      <div className="text-center">
        <button onClick={() => setOpen(true)} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          {text(m.withdrawFromTheStudy)}
        </button>
      </div>
    );
  }

  const withdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await withdrawFromStudy(code);
      onWithdrawn();
    } catch {
      setError(m.couldNotSaveCheck2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-semibold">{text(m.withdrawFromTheStudy2)}</p>
      <p className="text-muted-foreground">
        {text(m.youMayStopAt)}
      </p>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" disabled={busy} onClick={() => void withdraw()}>
          {busy ? text(m.saving) : text(m.withdraw)}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          {text(m.stayInTheStudy)}
        </Button>
      </div>
    </div>
  );
};
