import type { ReactNode } from 'react';
import { ArrowDown, CircleDot, Eye, ShieldAlert } from 'lucide-react';
import type { MarkingPlate, SignPlate } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import SignPlateCard from './SignPlateCard';
import MarkingPlateCard from './MarkingPlateCard';

export const Keycap = ({ children, active = false }: { children: string; active?: boolean }) => (
  <span
    className={`flex min-h-9 min-w-9 items-center justify-center rounded-md border px-2.5 font-display text-sm font-black shadow-[inset_0_-3px_0_rgba(0,0,0,0.28)] ${
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-background text-foreground'
    }`}
  >
    {children}
  </span>
);

/**
 * The three states one scenario passes through, and how each announces itself.
 *
 * Distinguished by an icon and a word as well as by a colour, so the state is
 * still legible to a colour-blind reader and on a washed-out screen.
 */
const promptTones = {
  instructor: {
    frame: 'border-primary/70',
    header: 'border-border bg-primary/10',
    accent: 'text-primary',
    word: 'Practice',
    Icon: CircleDot,
  },
  approach: {
    frame: 'border-primary/60',
    header: 'border-border bg-primary/10',
    accent: 'text-primary',
    word: 'Coming up',
    Icon: Eye,
  },
  react: {
    frame: 'border-road-yellow/70',
    header: 'border-road-yellow/25 bg-road-yellow/10',
    accent: 'text-road-yellow',
    word: 'Act now',
    Icon: ArrowDown,
  },
  checkpoint: {
    frame: 'border-destructive/60',
    header: 'border-destructive/25 bg-destructive/10',
    accent: 'text-destructive',
    word: 'Full stop',
    Icon: ShieldAlert,
  },
} as const;

export type PromptTone = keyof typeof promptTones;

/**
 * What one live metric looks like, whichever of them a scenario is measuring.
 *
 * Exactly one is ever shown. The prompt used to be able to stack a lane cue, a
 * gap cue, a road-position cue and a weak-area hint at once, which is four
 * readouts for a scenario that grades one thing — and the one that mattered was
 * never the one nearest the top.
 */
export interface PromptMetric {
  /** Two or three words: what is being measured. */
  label: string;
  /** The reading itself, large and tabular where it is a number. */
  value: string;
  /** Whether the reading currently satisfies what is being graded. */
  ok: boolean;
  /** Three or four words on what to do about it. Optional. */
  note?: string;
}

const MetricRow = ({ metric }: { metric: PromptMetric }) => (
  <div
    className={`flex min-h-[38px] items-center gap-2.5 rounded-md border px-2.5 py-1.5 ${
      metric.ok
        ? 'border-accent/50 bg-accent/10'
        : 'border-destructive/50 bg-destructive/10'
    }`}
  >
    <span
      className={`font-display text-[12px] font-black uppercase tracking-[0.12em] ${
        metric.ok ? 'text-accent' : 'text-destructive'
      }`}
    >
      {metric.label}
    </span>
    <span className="font-display text-[15px] font-black tabular-nums text-foreground">
      {metric.value}
    </span>
    {metric.note && (
      <span className="ml-auto text-right text-[12px] leading-4 text-muted-foreground">
        {metric.note}
      </span>
    )}
  </div>
);

/**
 * What the road is asking of the driver, in the order a driver needs it.
 *
 * One scenario name, one instruction, one live measurement, one distance. The
 * situation itself is not here: it is read once while the drive is paused, and
 * repeating it beside the road — as a paragraph, in capitals, under the answer
 * — was the single biggest thing between the player and the windscreen.
 *
 * Every slot has a floor height, so a metric arriving or a distance bar leaving
 * never moves the text above it.
 */
const RoadPrompt = ({
  tone,
  label,
  instruction,
  cue,
  metric,
  approach,
  sign,
  marking,
  urgent = false,
  children,
}: {
  tone: PromptTone;
  /** The scenario's own short name. Two to five words, never a sentence. */
  label: string;
  /**
   * The one thing to do about it, in ten words or fewer. Null where the
   * support level withholds the move.
   */
  instruction: string | null;
  /** Where to look, shown in the instruction's place when the support level gives only that. */
  cue?: string | null;
  /** The single live reading this scenario grades, where it has one. */
  metric?: PromptMetric | null;
  /** 1 when the hazard is first announced, 0 when you reach it. */
  approach?: number;
  /** The sign on the road, shown here at a size it can actually be read at. */
  sign?: SignPlate;
  /** The marking under the wheels, shown here for exactly the same reason. */
  marking?: MarkingPlate;
  /** Only the act-now phase draws attention to itself, and only if motion is welcome. */
  urgent?: boolean;
  children?: ReactNode;
}) => {
  const styles = promptTones[tone];
  const reducedMotion = useReducedMotion();
  const { Icon } = styles;

  return (
    <div
      style={
        urgent && !reducedMotion
          ? { animation: 'pulseGlow 1.6s ease-in-out infinite' }
          : undefined
      }
      data-testid="road-prompt"
      data-tone={tone}
    >
      <div className={`overflow-hidden rounded-xl border-2 bg-card/95 shadow-2xl backdrop-blur-md ${styles.frame}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-3.5 py-2 ${styles.header}`}>
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${styles.accent}`} aria-hidden />
            <p className={`truncate font-display text-[13px] font-black uppercase tracking-[0.12em] ${styles.accent}`}>
              {label}
            </p>
          </div>
          <p className="shrink-0 font-display text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            {styles.word}
          </p>
        </div>

        <div className="grid gap-2.5 p-3.5">
          {sign && <SignPlateCard sign={sign} compact />}
          {marking && <MarkingPlateCard marking={marking} compact />}

          {/* The instruction, and the largest text on the card - or, where the
              support level gives only that, where to look, in a quieter voice.
              The slot keeps its height either way, so nothing below it moves. */}
          {instruction ? (
            <p className="min-h-[40px] text-[15px] font-semibold leading-5 text-foreground">
              {instruction}
            </p>
          ) : (
            <p className="min-h-[40px] text-[14px] leading-5 text-muted-foreground" data-testid="road-prompt-cue">
              {cue}
            </p>
          )}

          {/* Exactly one reading, in a slot that is there whether or not this
              scenario has one — so nothing below it moves when it appears. */}
          <div className="min-h-[38px]">{metric && <MetricRow metric={metric} />}</div>

          {approach !== undefined && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-display text-[12px] uppercase tracking-wider text-muted-foreground">
                  Distance
                </span>
                <span className={`font-display text-[12px] uppercase tracking-wider ${styles.accent}`}>
                  {approach > 0.02 ? 'Closing' : 'Here'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    tone === 'react' ? 'bg-road-yellow' : tone === 'checkpoint' ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.round(approach * 100)}%` }}
                />
              </div>
            </div>
          )}

          {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
      </div>
    </div>
  );
};

export default RoadPrompt;
