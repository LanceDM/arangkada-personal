/**
 * `/admin/quiz`: the Short Quiz bank's editor. A level's items are
 * listed, added, edited and switched on or off, never deleted; its sitting
 * size and pass mark are set here, or that it has no quiz; and the team's
 * question bank sheet is imported from CSV. The game reads only what is
 * stored: nothing bundled stands behind it.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, FileUp, ListChecks, Plus, RefreshCw } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import {
  LEVELS,
  QUIZ_IMAGE_PREFIX,
  QUIZ_ITEM_LIMITS,
  quizItemProblems,
  quizModuleProblems,
  servedItems,
  type QuizItemDoc,
  quizFilipinoProblems,
  quizFilipinoState,
  settleFilipino,
  STYLE_GUIDE_VERSION,
  type QuizItemDraft,
  type QuizItemFilipino,
  type QuizItemUse,
} from '@/features/driving-sim';
import {
  itemsOf,
  newItemIdProblems,
  settingsOf,
  switchOffProblem,
  useQuizEditor,
  type QuizModuleSettings,
} from '@/features/admin/application/useQuizEditor';
import type { QuizBankSnapshot } from '@/features/admin/application/quizPorts';
import type { ImportRow, ImportStatus } from '@/features/admin/domain/quizImport';
import { EmptyState, Notice, Panel, SectionHeader, SectionTabs } from './adminUi';

const FIELD_CLASS =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LETTERS = ['A', 'B', 'C', 'D'];

type View = 'items' | 'import';

const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
    {label}
    {children}
    {hint && <span className="font-normal">{hint}</span>}
  </label>
);

const ProblemList = ({ problems }: { problems: string[] }) =>
  problems.length ? (
    <Notice tone="error">
      <ul className="list-disc space-y-0.5 pl-4">
        {problems.map(problem => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </Notice>
  ) : null;

/** The item as the quiz shows it, with its answer marked for the editor. */
const ItemPreview = ({ draft }: { draft: QuizItemDraft }) => (
  <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview</p>
    {draft.image.startsWith(QUIZ_IMAGE_PREFIX) && (
      <img src={draft.image} alt="The item's picture" className="mx-auto max-h-32 w-auto object-contain" />
    )}
    <p className="text-base font-semibold text-foreground">{draft.question || 'The question'}</p>
    <ol className="space-y-1.5">
      {draft.options.map((option, i) => (
        <li
          key={i}
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
            i === draft.correctIndex ? 'border-accent/50 bg-accent/10 text-foreground' : 'border-border text-muted-foreground'
          )}
        >
          <span className="font-mono text-xs">{LETTERS[i]}</span>
          <span className="min-w-0 flex-1">{option || '—'}</span>
          {i === draft.correctIndex && <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-label="Correct" />}
        </li>
      ))}
    </ol>
    {draft.explanation && <p className="text-xs text-muted-foreground">{draft.explanation}</p>}
    <p className="text-xs italic text-muted-foreground">Source: {draft.source || '—'}</p>
    <p className="text-[11px] text-muted-foreground">The quiz shows the choices in a shuffled order.</p>
  </div>
);

const blankDraft = (moduleId: string, order: number): QuizItemDraft => ({
  moduleId,
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  image: '',
  competency: COMPETENCIES[0],
  source: '',
  use: 'quiz',
  isActive: true,
  order,
});

const draftOf = (item: QuizItemDoc): QuizItemDraft => {
  const { moduleId, question, options, correctIndex, explanation, image, competency, source, use, isActive, order } = item;
  return { moduleId, question, options: [...options], correctIndex, explanation, image, competency, source, use, isActive, order, ...(item.fil ? { fil: item.fil } : {}) };
};

const blankFilipino = (options: readonly string[]): QuizItemFilipino => ({
  question: '',
  options: options.map(() => ''),
  explanation: '',
  status: 'draft',
  sourceText: '',
});

/** The item's Filipino, written by the team under the style guide. Items are public: initials only. */
const FilipinoFields = ({ draft, set }: { draft: QuizItemDraft; set: (change: Partial<QuizItemDraft>) => void }) => {
  const stored = draft.fil ?? blankFilipino(draft.options);
  // The English's choices decide how many there are, as adding or removing one changes them.
  const fil = { ...stored, options: draft.options.map((_, i) => stored.options[i] ?? '') };
  const change = (next: Partial<QuizItemFilipino>) => set({ fil: { ...fil, ...next } });
  const signature = (key: 'translatedBy' | 'reviewedBy' | 'reviewedOn' | 'guide', label: string) => (
    <input aria-label={label} placeholder={label} value={fil[key] ?? ''} onChange={event => change({ [key]: event.target.value })} className={FIELD_CLASS} />
  );
  return (
    <fieldset className="space-y-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">Filipino (optional): initials only, as items are public</legend>
      <textarea aria-label="Filipino question" placeholder="Question" rows={2} value={fil.question} onChange={event => change({ question: event.target.value })} className={FIELD_CLASS} />
      {fil.options.map((option, i) => (
        <input key={i} aria-label={`Filipino choice ${i + 1}`} placeholder={`Choice ${i + 1}: ${draft.options[i]}`} value={option} onChange={event => change({ options: fil.options.map((old, j) => (j === i ? event.target.value : old)) })} className={FIELD_CLASS} />
      ))}
      <textarea aria-label="Filipino explanation" placeholder="Explanation" rows={2} value={fil.explanation} onChange={event => change({ explanation: event.target.value })} className={FIELD_CLASS} />
      <select aria-label="Filipino status" value={fil.status} onChange={event => change({ status: event.target.value as QuizItemFilipino['status'] })} className={SELECT_CLASS}>
        <option value="draft">Draft</option>
        <option value="reviewed">Reviewed</option>
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        {signature('translatedBy', 'Translated by (initials)')}
        {signature('reviewedBy', 'Reviewed by (initials)')}
        {signature('reviewedOn', 'Reviewed on (YYYY-MM-DD)')}
        {signature('guide', `Guide (${STYLE_GUIDE_VERSION})`)}
      </div>
    </fieldset>
  );
};

const ItemForm = ({
  bank,
  levelId,
  before,
  initial,
  onSave,
  onCancel,
}: {
  bank: QuizBankSnapshot;
  levelId: number;
  before: QuizItemDoc | null;
  initial: QuizItemDraft;
  onSave: (id: string, draft: QuizItemDraft) => Promise<string | null>;
  onCancel: () => void;
}) => {
  const [id, setId] = useState(before?.id ?? `L${levelId}-`);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (change: Partial<QuizItemDraft>) => setDraft(current => ({ ...current, ...change }));
  const problems = [...(before ? [] : newItemIdProblems(bank, id.trim(), levelId)), ...quizItemProblems(draft), ...quizFilipinoProblems(draft)];

  const setOption = (index: number, value: string) =>
    set({ options: draft.options.map((option, i) => (i === index ? value : option)) });
  const removeOption = (index: number) =>
    set({
      options: draft.options.filter((_, i) => i !== index),
      correctIndex: draft.correctIndex === index ? 0 : draft.correctIndex > index ? draft.correctIndex - 1 : draft.correctIndex,
    });

  const save = async () => {
    setSaving(true);
    // A block is saved settled, or not at all: see `settleFilipino`.
    const { fil: typed, ...english } = draft;
    const fil = settleFilipino(draft, before?.fil);
    void typed;
    const failure = await onSave(before?.id ?? id.trim(), { ...english, ...(fil ? { fil } : {}) });
    setSaving(false);
    if (failure) setError(failure);
  };

  return (
    <Panel
      title={before ? `Edit ${before.id} (revision ${before.revision})` : 'Add an item'}
      description={before ? 'Saving makes the next revision; sittings already recorded keep the one they showed.' : undefined}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {!before && (
            <Field label="Item ID" hint="As in the question bank: level, competency, number, e.g. L3-RS-10.">
              <input aria-label="Item ID" value={id} onChange={event => setId(event.target.value)} className={FIELD_CLASS} />
            </Field>
          )}
          <Field label="Question" hint={`${draft.question.length} / ${QUIZ_ITEM_LIMITS.questionMax}`}>
            <textarea
              aria-label="Question"
              rows={3}
              value={draft.question}
              onChange={event => set({ question: event.target.value })}
              className={FIELD_CLASS}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">
              Choices ({QUIZ_ITEM_LIMITS.optionsMin}–{QUIZ_ITEM_LIMITS.optionsMax}); mark the one correct answer
            </legend>
            {draft.options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  aria-label={`Choice ${LETTERS[i]} is correct`}
                  checked={draft.correctIndex === i}
                  onChange={() => set({ correctIndex: i })}
                />
                <span className="w-4 font-mono text-xs text-muted-foreground">{LETTERS[i]}</span>
                <input
                  aria-label={`Choice ${LETTERS[i]}`}
                  value={option}
                  onChange={event => setOption(i, event.target.value)}
                  className={FIELD_CLASS}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={draft.options.length <= QUIZ_ITEM_LIMITS.optionsMin}
                  onClick={() => removeOption(i)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {draft.options.length < QUIZ_ITEM_LIMITS.optionsMax && (
              <Button variant="outline" size="sm" onClick={() => set({ options: [...draft.options, ''] })}>
                Add a choice
              </Button>
            )}
          </fieldset>
          <Field label="Explanation (optional)" hint="Shown after the sitting with the source. Leave it blank to show the source alone.">
            <textarea
              aria-label="Explanation"
              rows={2}
              value={draft.explanation}
              onChange={event => set({ explanation: event.target.value })}
              className={FIELD_CLASS}
            />
          </Field>
          <FilipinoFields draft={draft} set={set} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Competency" hint="What the correct answer depends on.">
              <select
                aria-label="Competency"
                value={draft.competency}
                onChange={event => set({ competency: event.target.value as DrivingCompetency })}
                className={SELECT_CLASS}
              >
                {COMPETENCIES.map(competency => (
                  <option key={competency} value={competency}>
                    {getCompetencyLabel(competency)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Use" hint="Test: an item of the 55-item pre-test and post-test. The game never shows it.">
              <select
                aria-label="Use"
                value={draft.use}
                onChange={event => set({ use: event.target.value as QuizItemUse })}
                className={SELECT_CLASS}
              >
                <option value="quiz">Quiz</option>
                <option value="test">Test</option>
              </select>
            </Field>
            <Field label="Source" hint="The official basis, e.g. FDM Vol. 1 (2021), Ch. I, p. 5.">
              <input aria-label="Source" value={draft.source} onChange={event => set({ source: event.target.value })} className={FIELD_CLASS} />
            </Field>
            <Field label="Picture (optional)" hint={`A file under ${QUIZ_IMAGE_PREFIX}, e.g. ${QUIZ_IMAGE_PREFIX}level3/no-u-turn.png.`}>
              <input aria-label="Picture" value={draft.image} onChange={event => set({ image: event.target.value.trim() })} className={FIELD_CLASS} />
            </Field>
            <Field label="Order" hint="Where it lists; a sitting draws at random.">
              <input
                aria-label="Order"
                type="number"
                min={0}
                value={draft.order}
                onChange={event => set({ order: Number(event.target.value) })}
                className={FIELD_CLASS}
              />
            </Field>
          </div>
          <ProblemList problems={problems} />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || problems.length > 0}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
        <ItemPreview draft={draft} />
      </div>
    </Panel>
  );
};

const SettingsPanel = ({
  bank,
  moduleId,
  onSave,
}: {
  bank: QuizBankSnapshot;
  moduleId: string;
  onSave: (settings: QuizModuleSettings) => Promise<string | null>;
}) => {
  const current = settingsOf(bank, moduleId);
  const [settings, setSettings] = useState<QuizModuleSettings>(current);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const served = servedItems(itemsOf(bank, moduleId)).length;
  const problems = quizModuleProblems(settings, served);

  const save = async () => {
    const failure = await onSave(settings);
    setMessage(failure ? { tone: 'error', text: failure } : { tone: 'info', text: 'Saved.' });
  };

  return (
    <Panel
      title="Sitting and pass mark"
      description={
        current.saved
          ? `Revision ${current.saved.revision}.`
          : 'Not saved yet: the game plays 10 items, 6 to pass, once this level has quiz items.'
      }
    >
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            aria-label="This level has a quiz"
            checked={settings.hasQuiz}
            onChange={event => setSettings({ ...settings, hasQuiz: event.target.checked })}
          />
          This level has a quiz
        </label>
        <Field label="Items per sitting">
          <input
            aria-label="Items per sitting"
            type="number"
            min={1}
            disabled={!settings.hasQuiz}
            value={settings.itemsPerSitting}
            onChange={event => setSettings({ ...settings, itemsPerSitting: Number(event.target.value) })}
            className={cn(FIELD_CLASS, 'w-28')}
          />
        </Field>
        <Field label="Pass mark">
          <input
            aria-label="Pass mark"
            type="number"
            min={1}
            disabled={!settings.hasQuiz}
            value={settings.passingScore}
            onChange={event => setSettings({ ...settings, passingScore: Number(event.target.value) })}
            className={cn(FIELD_CLASS, 'w-28')}
          />
        </Field>
        <Button onClick={save} disabled={problems.length > 0}>
          Save
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {settings.hasQuiz
          ? `${served} quiz items switched on. With none, the level is blocked with "Couldn't load the quiz".`
          : "No quiz: this level's drive opens without a checkpoint."}
      </p>
      <div className="mt-3 space-y-2">
        <ProblemList problems={problems} />
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </Panel>
  );
};

const ItemRow = ({
  item,
  bank,
  onEdit,
  onSwitch,
}: {
  item: QuizItemDoc;
  bank: QuizBankSnapshot;
  onEdit: () => void;
  onSwitch: () => void;
}) => {
  const blocked = item.isActive ? switchOffProblem(bank, item) : null;
  return (
    <li className={cn('flex flex-wrap items-start gap-3 px-4 py-3', !item.isActive && 'opacity-60')}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{item.id}</span>
          <span>{getCompetencyLabel(item.competency)}</span>
          <span>rev. {item.revision}</span>
          {item.use === 'test' && <Badge variant="destructive">Test item</Badge>}
          {!item.isActive && <Badge variant="outline">Off</Badge>}
          {item.image && <Badge variant="outline">Picture</Badge>}
          {quizFilipinoState(item) !== 'none' && <Badge variant="outline">Filipino: {quizFilipinoState(item)}</Badge>}
        </div>
        <p className="text-sm text-foreground">{item.question}</p>
        {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onSwitch} disabled={Boolean(blocked)}>
          {item.isActive ? 'Switch off' : 'Switch on'}
        </Button>
      </div>
    </li>
  );
};

const STATUS_LABEL: Record<ImportStatus, string> = {
  new: 'New',
  changed: 'Changed',
  unchanged: 'Unchanged',
  invalid: 'Cannot import',
};

const ImportPanel = ({
  planSheet,
  runImport,
}: {
  planSheet: (csv: string) => { rows: ImportRow[]; problems: string[] } | null;
  runImport: (rows: readonly ImportRow[]) => Promise<string | null>;
}) => {
  const [plan, setPlan] = useState<{ name: string; rows: ImportRow[]; problems: string[] } | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);

  const readFile = async (file: File | undefined) => {
    setMessage(null);
    if (!file) return setPlan(null);
    const read = planSheet(await file.text());
    setPlan(read ? { name: file.name, ...read } : null);
  };

  const counts = useMemo(() => {
    const byStatus: Record<ImportStatus, number> = { new: 0, changed: 0, unchanged: 0, invalid: 0 };
    const byLevel = new Map<string, Record<ImportStatus, number>>();
    for (const { row, status } of plan?.rows ?? []) {
      byStatus[status]++;
      const level = row.id.split('-')[0] || '?';
      const entry = byLevel.get(level) ?? { new: 0, changed: 0, unchanged: 0, invalid: 0 };
      entry[status]++;
      byLevel.set(level, entry);
    }
    return { byStatus, byLevel: [...byLevel].sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1))) };
  }, [plan]);

  const writes = counts.byStatus.new + counts.byStatus.changed;

  const run = async () => {
    if (!plan) return;
    setImporting(true);
    const failure = await runImport(plan.rows);
    setImporting(false);
    setMessage(failure ? { tone: 'error', text: failure } : { tone: 'info', text: `Imported ${writes} items.` });
    if (!failure) setPlan(null);
  };

  return (
    <Panel
      title="Import the question bank"
      description="Save the sheet as CSV (File › Save As › CSV), then choose it here. Nothing is written until you import."
    >
      <div className="space-y-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Question bank CSV
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Question bank CSV"
            onChange={event => readFile(event.target.files?.[0])}
            className="text-sm text-foreground"
          />
        </label>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Each row's Item ID is its id. A row whose item exists is saved as its next revision only if something changed.</li>
          <li>New items are switched on. An import never deletes, and never switches an item on or off.</li>
          <li>A Use column (Quiz or Test) is read if the sheet has one; without it, every existing item keeps its use.</li>
          <li>Reviewer Notes are never imported. The sheet's Wikimedia sign links become the game's own pictures.</li>
        </ul>
        {plan && (
          <div className="space-y-3">
            <ProblemList problems={plan.problems} />
            <p className="text-sm text-foreground">
              {plan.name}: {plan.rows.length} rows. {counts.byStatus.new} new, {counts.byStatus.changed} changed,{' '}
              {counts.byStatus.unchanged} unchanged, {counts.byStatus.invalid} cannot be imported.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Level</th>
                    {(Object.keys(STATUS_LABEL) as ImportStatus[]).map(status => (
                      <th key={status} className="py-1 pr-4 font-medium">
                        {STATUS_LABEL[status]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {counts.byLevel.map(([level, entry]) => (
                    <tr key={level} className="border-t border-border">
                      <td className="py-1 pr-4 font-mono">{level}</td>
                      {(Object.keys(STATUS_LABEL) as ImportStatus[]).map(status => (
                        <td key={status} className="py-1 pr-4 tabular-nums">
                          {entry[status]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {counts.byStatus.invalid > 0 && (
              <Notice tone="error">
                <p>These rows are left out; fix them in the sheet and import again:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {plan.rows
                    .filter(entry => entry.status === 'invalid')
                    .map(({ row }) => (
                      <li key={`${row.line}-${row.id}`}>
                        Row {row.line} ({row.id || 'no id'}): {row.problems.join(' ')}
                      </li>
                    ))}
                </ul>
              </Notice>
            )}
            <Button onClick={run} disabled={importing || writes === 0}>
              <FileUp className="h-4 w-4" />
              {importing ? 'Importing…' : `Import ${writes} items`}
            </Button>
          </div>
        )}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </Panel>
  );
};

export const QuizEditorSection = ({ uid }: { uid: string | null }) => {
  const editor = useQuizEditor(uid);
  const [view, setView] = useState<View>('items');
  const [levelId, setLevelId] = useState(1);
  const [editing, setEditing] = useState<{ before: QuizItemDoc | null; initial: QuizItemDraft } | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const level = LEVELS.find(entry => entry.id === levelId) ?? LEVELS[0];

  const header = (
    <SectionHeader
      title="Quiz items"
      description="The Short Quiz each level's briefing asks. The game reads only these: a level whose quiz has no item switched on is blocked until it has one, unless it is set to have no quiz."
      actions={
        <Button variant="outline" size="sm" onClick={editor.reload}>
          <RefreshCw className="h-4 w-4" />
          Reload
        </Button>
      }
    />
  );

  const rules = (
    <Notice>
      Edits stop once the first participant starts, so every sitting in the study is played on the same items.
      Never enter an item of the 55-item pre-test and post-test as a quiz item: mark it Test, and the game never shows it.
    </Notice>
  );

  if (editor.load.status !== 'ready') {
    return (
      <div className="space-y-6">
        {header}
        {editor.load.status === 'loading' ? (
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        ) : (
          <Notice tone="error">Could not read the quiz bank: {editor.load.error}</Notice>
        )}
      </div>
    );
  }

  const { bank } = editor.load;
  const items = itemsOf(bank, level.moduleId);
  const served = servedItems(items).length;

  const switchItem = async (item: QuizItemDoc) => {
    const failure = await editor.saveItem(item.id, { ...draftOf(item), isActive: !item.isActive }, item);
    setSwitchError(failure);
  };

  return (
    <div className="space-y-6">
      {header}
      {rules}
      <SectionTabs
        value={view}
        onChange={setView}
        options={[
          { value: 'items', label: 'Items' },
          { value: 'import', label: 'Import' },
        ]}
      />

      {view === 'import' ? (
        <ImportPanel planSheet={editor.planSheet} runImport={editor.runImport} />
      ) : (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Level
            <select
              aria-label="Level"
              value={levelId}
              onChange={event => {
                setLevelId(Number(event.target.value));
                setEditing(null);
                setSwitchError(null);
              }}
              className={cn(SELECT_CLASS, 'w-full sm:w-80')}
            >
              {LEVELS.map(entry => {
                const count = itemsOf(bank, entry.moduleId).length;
                return (
                  <option key={entry.id} value={entry.id}>
                    Level {entry.id} · {entry.name} · {count} items
                  </option>
                );
              })}
            </select>
          </label>

          <SettingsPanel key={`${level.moduleId}-${settingsOf(bank, level.moduleId).saved?.revision ?? 0}`} bank={bank} moduleId={level.moduleId} onSave={settings => editor.saveSettings(level.moduleId, settings)} />

          {editing && (
            <ItemForm
              key={editing.before?.id ?? 'new'}
              bank={bank}
              levelId={level.id}
              before={editing.before}
              initial={editing.initial}
              onSave={async (id, draft) => {
                const failure = await editor.saveItem(id, draft, editing.before);
                if (!failure) setEditing(null);
                return failure;
              }}
              onCancel={() => setEditing(null)}
            />
          )}

          <Panel
            title={`Level ${level.id} items`}
            description={`${items.length} items, ${served} quiz items switched on.`}
            actions={
              <Button
                size="sm"
                onClick={() =>
                  setEditing({
                    before: null,
                    initial: blankDraft(level.moduleId, Math.max(0, ...items.map(item => item.order)) + 1),
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            }
            bodyClassName="p-0"
          >
            {switchError && (
              <div className="p-4">
                <Notice tone="error">{switchError}</Notice>
              </div>
            )}
            {items.length === 0 ? (
              <EmptyState icon={ListChecks} title="No items for this level">
                Add one, or import the question bank.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {items.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    bank={bank}
                    onEdit={() => setEditing({ before: item, initial: draftOf(item) })}
                    onSwitch={() => switchItem(item)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};
