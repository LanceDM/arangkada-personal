/**
 * The screens of a test sitting, the pre-test's and the post-test's. No screen says whether an answer was right, and none
 * shows a score or which block a post-test was routed to: the end screen says
 * only that the answers are saved.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { ClipboardList, Eye, Timer } from 'lucide-react';
import type { NotReadyReason, TestSittingState } from '@/features/assessment/application/useTestSitting';
import { ActionBar } from '@/shared/ui/ActionBar';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { testMessages as m } from './messages';

/** What a test's screens say: everything else is the same for both. */
export interface TestCopy {
  readonly title: Localized;
  readonly notParticipant: Localized;
  readonly couldNotOpen: Localized;
  readonly intro: ReactNode;
  readonly startLabel: Localized;
  readonly continueLabel: Localized;
  readonly notReady: (reason: NotReadyReason) => Localized;
  readonly preview: (count: number | null) => Localized;
  /** Above a question: which part of the test it is in, if the test has parts. */
  readonly part?: (stageIndex: number) => Localized;
  /** The screen between a post-test's two parts. */
  readonly between?: ReactNode;
  readonly beginStage2Label?: Localized;
}

const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const primary =
  'w-full py-4 bg-primary text-primary-foreground font-display font-black rounded-2xl uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all';
const secondary = 'w-full py-3 text-muted-foreground text-sm hover:text-foreground transition-colors';

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="min-h-full px-4 py-10 flex justify-center">
    <div className="max-w-xl w-full space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-6 h-6 text-primary" aria-hidden />
        <h1 className="text-2xl font-black text-foreground">{title}</h1>
      </div>
      {children}
    </div>
  </div>
);

const PreviewBanner = ({ text }: { text: string }) => (
  <div role="note" className="flex gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
    <Eye className="w-5 h-5 flex-shrink-0 text-primary" aria-hidden />
    <span>{text}</span>
  </div>
);

const Question = ({ state, copy, preview, onLeave }: { state: TestSittingState; copy: TestCopy; preview: boolean; onLeave: () => void }) => {
  const { current, position, total, selected, secondsLeft } = state;
  const t = useText();
  if (!current) return null;
  const last = position === total;
  return (
    <div className="min-h-full px-4 py-6 flex justify-center">
      <div className="max-w-2xl w-full space-y-6">
        {preview && <PreviewBanner text={t(copy.preview(null))} />}
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-muted-foreground">
          <span>
            {copy.part && `${t(copy.part(state.stageIndex))} · `}
            {t(m.question(position, total))}
          </span>
          <span role="timer" aria-label={t(m.timeLeft)} className="flex items-center gap-1 tabular-nums">
            <Timer className="w-4 h-4" aria-hidden />
            {clockText(secondsLeft)}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${((position - 1) / total) * 100}%` }} />
        </div>

        {current.item.image && (
          <img
            src={current.item.image}
            alt={t(m.pictureAlt)}
            className="mx-auto max-h-32 sm:max-h-48 w-auto object-contain"
          />
        )}
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold leading-snug text-foreground">{current.item.question}</h2>

        <div className="grid gap-3">
          {current.choiceOrder.map((optionIndex, i) => (
            <button
              key={optionIndex}
              onClick={() => state.choose(optionIndex)}
              aria-pressed={selected === optionIndex}
              className={`w-full p-3 sm:p-4 bg-card border rounded-2xl text-left flex items-center gap-3 transition-all ${
                selected === optionIndex ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'
              }`}
            >
              <span className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-xs font-black text-muted-foreground flex-shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-foreground font-semibold">{current.item.options[optionIndex]}</span>
            </button>
          ))}
        </div>

        <ActionBar className="-mx-4 px-4 bg-[#0F0F1A]">
          {state.answerSave === 'failed' && (
            <p role="alert" className="text-sm text-foreground pb-2">{t(m.answerNotSaved)}</p>
          )}
          <button onClick={() => void state.next()} disabled={selected === null || state.answerSave === 'saving'} className={primary}>
            {t(last ? m.finish : m.next)}
          </button>
          <button onClick={onLeave} className={secondary}>{t(m.continueLaterClock)}</button>
        </ActionBar>
      </div>
    </div>
  );
};

export const TestSittingScreen = ({ state, copy, onLeave }: { state: TestSittingState; copy: TestCopy; onLeave: () => void }) => {
  const { phase, access } = state;
  const screen = useRef<HTMLDivElement>(null);

  // Each item and each screen opens at its top, wherever the last was scrolled to.
  useEffect(() => {
    if (screen.current) screen.current.scrollTop = 0;
  }, [state.position, state.stageIndex, phase.kind]);
  const preview = access === 'preview';
  const t = useText();
  const title = t(copy.title);

  const body = (() => {
    switch (phase.kind) {
      case 'checking':
      case 'loading':
        return <Panel title={title}><p className="text-muted-foreground">{t(m.loading)}</p></Panel>;
      case 'none':
        return (
          <Panel title={title}>
            <p className="text-muted-foreground">{t(copy.notParticipant)}</p>
            <button onClick={onLeave} className={secondary}>{t(m.back)}</button>
          </Panel>
        );
      case 'intro':
        return (
          <Panel title={title}>
            {preview && <PreviewBanner text={t(copy.preview(null))} />}
            {copy.intro}
            <button onClick={() => void state.start()} className={primary}>
              {t(phase.resuming ? copy.continueLabel : copy.startLabel)}
            </button>
            <button onClick={onLeave} className={secondary}>{t(m.notNow)}</button>
          </Panel>
        );
      case 'not-ready':
        return (
          <Panel title={title}>
            {preview && phase.reason === 'items' ? (
              <PreviewBanner text={t(copy.preview(phase.count))} />
            ) : (
              <p className="text-muted-foreground">{t(copy.notReady(phase.reason))}</p>
            )}
            <button onClick={onLeave} className={secondary}>{t(m.back)}</button>
          </Panel>
        );
      case 'running':
        return <Question state={state} copy={copy} preview={preview} onLeave={onLeave} />;
      case 'between':
        return (
          <Panel title={title}>
            {preview && <PreviewBanner text={t(copy.preview(null))} />}
            {copy.between}
            <button onClick={() => void state.beginStage2()} className={primary}>{copy.beginStage2Label && t(copy.beginStage2Label)}</button>
            <button onClick={onLeave} className={secondary}>{t(m.continueLater)}</button>
          </Panel>
        );
      case 'saving':
        return <Panel title={title}><p className="text-muted-foreground">{t(m.saving)}</p></Panel>;
      case 'save-failed':
        return (
          <Panel title={title}>
            <p role="alert" className="text-foreground">
              {t(m.saveFailed)}
            </p>
            <button onClick={state.retry} className={primary}>{t(m.tryAgain)}</button>
          </Panel>
        );
      case 'done':
        return (
          <Panel title={title}>
            {preview ? (
              <PreviewBanner text={t(copy.preview(state.previewCount))} />
            ) : (
              <p className="text-foreground">{t(m.saved)}</p>
            )}
            <button onClick={onLeave} className={primary}>{t(m.backToMenu)}</button>
          </Panel>
        );
      case 'failed':
        return (
          <Panel title={title}>
            <p role="alert" className="text-foreground">{t(copy.couldNotOpen)}</p>
            <button onClick={state.retry} className={primary}>{t(m.tryAgain)}</button>
            <button onClick={onLeave} className={secondary}>{t(m.back)}</button>
          </Panel>
        );
    }
  })();

  return (
    <div ref={screen} className="fixed inset-0 bg-[#0F0F1A] z-[110] overflow-y-auto">
      {body}
    </div>
  );
};
