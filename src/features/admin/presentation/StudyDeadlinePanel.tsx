import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button';
import type { StudyDeadlineRepository } from '@/features/admin/application/pilotPorts';
import { Notice, Panel } from './adminUi';

/** A local date and time for the input, from ms. */
const toInput = (at: number) => {
  const d = new Date(at - new Date(at).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

/**
 * The study deadline (the end path's backstop): once it has passed, the study
 * home offers everyone not yet certified to finish the study, so their
 * post-test and survey still happen. Off unless set.
 */
export const StudyDeadlinePanel = ({ repository }: { repository: StudyDeadlineRepository }) => {
  const [at, setAt] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => repository.watch(value => {
    setAt(value);
    setDraft(value === null ? '' : toInput(value));
  }, setError), [repository]);

  const save = async (value: number | null) => {
    setBusy(true);
    setError(null);
    try {
      await repository.set(value);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Study deadline"
      description="Off unless set. Once it has passed, every participant not yet certified is offered Finish the study on their home: the post-test, then the survey."
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {at === undefined ? 'Reading…' : at === null ? 'No deadline is set.' : `Set to ${new Date(at).toLocaleString()}${Date.now() >= at ? ' (passed)' : ''}.`}
        </span>
        <input
          type="datetime-local"
          className="rounded-md border border-border bg-background px-2 py-1"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          aria-label="Study deadline"
        />
        <Button size="sm" disabled={busy || !draft} onClick={() => void save(new Date(draft).getTime())}>
          Set deadline
        </Button>
        <Button size="sm" variant="outline" disabled={busy || at === null} onClick={() => void save(null)}>
          Turn off
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Panel>
  );
};
