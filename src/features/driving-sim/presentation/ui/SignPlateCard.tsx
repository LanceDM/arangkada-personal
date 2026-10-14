import type { RoadsideSignArt, SignPlate, SignalAspect } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';

/**
 * The sign on the road is drawn at the scale a sign really is on a narrow
 * carriageway, which is not a size anyone can read a symbol off. This card
 * shows the same sign enlarged beside the road, using the official LTO artwork
 * the level module teaches from, so the question is about recognising the sign
 * rather than squinting at it.
 *
 * Where a level has no artwork for a sign, the card draws the face the scenario
 * declared — the same `art` and `glyph` the canvas paints at the roadside —
 * rather than falling through to something else. It used to fall through to a
 * traffic signal, which meant every glyph board in the game (an expressway
 * MERGE plate, a KEEP RIGHT plate, a TOLL PLAZA plate) was shown to the learner
 * as a red light. A plate that contradicts the road is worse than no plate.
 */

const aspectLamps: Record<SignalAspect, { lit: 'red' | 'yellow' | 'green'; flashing: boolean }> = {
  red: { lit: 'red', flashing: false },
  flashing_red: { lit: 'red', flashing: true },
  yellow: { lit: 'yellow', flashing: false },
  flashing_yellow: { lit: 'yellow', flashing: true },
  green: { lit: 'green', flashing: false },
};

/** Traffic signals have no sign image, so the live aspect is drawn instead. */
const SignalGraphic = ({ aspect }: { aspect: SignalAspect }) => {
  const { lit, flashing } = aspectLamps[aspect];
  // A flashing aspect still has to be tellable from a steady one without the
  // flashing, so a viewer who has asked for less motion gets the lamp lit and
  // the word beside it rather than a blink they did not ask for.
  const reducedMotion = useReducedMotion();
  const blink = flashing && !reducedMotion;
  const lamp = (color: 'red' | 'yellow' | 'green', on: boolean) => {
    const shades = {
      red: on ? 'bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.8)]' : 'bg-red-950',
      yellow: on ? 'bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.8)]' : 'bg-amber-950',
      green: on ? 'bg-green-500' : 'bg-green-950',
    };
    return (
      <span
        className={`h-5 w-5 rounded-full ${shades[color]}`}
        style={on && blink ? { animation: 'signalBlink 0.85s steps(1) infinite' } : undefined}
      />
    );
  };

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2">
      {lamp('red', lit === 'red')}
      {lamp('yellow', lit === 'yellow')}
      {lamp('green', lit === 'green')}
    </div>
  );
};

/**
 * How each sign face is shaped and coloured, keyed by the art the scenario
 * declared. One entry per `RoadsideSignArt`, so a new face cannot be added
 * without deciding what it looks like here.
 */
const FACES: Record<Exclude<RoadsideSignArt, 'signal_head'>, {
  shape?: string;
  background: string;
  border: string;
  text: string;
  /** Pulls the glyph down inside a shape whose visual centre is not its box's. */
  glyphOffset?: string;
}> = {
  octagon: {
    shape: 'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)',
    background: '#b91c1c',
    border: '#f8fafc',
    text: '#ffffff',
  },
  triangle_down: {
    shape: 'polygon(0 0, 100% 0, 50% 100%)',
    background: '#f8fafc',
    border: '#b91c1c',
    text: '#b91c1c',
    glyphOffset: '-18%',
  },
  triangle_up: {
    shape: 'polygon(50% 0, 100% 100%, 0 100%)',
    background: '#fbbf24',
    border: '#111827',
    text: '#111827',
    glyphOffset: '18%',
  },
  circle_bar: { shape: 'circle(50%)', background: '#f8fafc', border: '#b91c1c', text: '#111827' },
  circle_prohibit: { shape: 'circle(50%)', background: '#f8fafc', border: '#b91c1c', text: '#b91c1c' },
  circle_limit: { shape: 'circle(50%)', background: '#f8fafc', border: '#b91c1c', text: '#111827' },
  diamond: {
    shape: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
    background: '#fbbf24',
    border: '#111827',
    text: '#111827',
  },
  chevron: {
    shape: 'polygon(0 0, 100% 50%, 0 100%)',
    background: '#fbbf24',
    border: '#111827',
    text: '#111827',
    glyphOffset: '0',
  },
  obstruction: { background: '#f8fafc', border: '#b91c1c', text: '#b91c1c' },
  crossbuck: { background: '#f8fafc', border: '#111827', text: '#111827' },
  rect_instruction: { background: '#1d4ed8', border: '#f8fafc', text: '#ffffff' },
};

/**
 * The declared face, drawn. Glyph text is sized to fit the plate rather than
 * clipped: an expressway board says OVERTAKING LANE, not a single character.
 */
const SignFace = ({ plate, compact }: { plate: SignPlate; compact: boolean }) => {
  const face = FACES[plate.art as Exclude<RoadsideSignArt, 'signal_head'>] ?? FACES.rect_instruction;
  const glyph = plate.glyph ?? '';
  const size = compact ? 64 : 88;
  // Long legends step down through three sizes so a whole phrase still fits.
  const fontSize = glyph.length > 12 ? 8 : glyph.length > 6 ? 10 : glyph.length > 2 ? 16 : 24;

  return (
    <div
      className="flex items-center justify-center text-center font-display font-black leading-tight"
      style={{
        width: size,
        height: size,
        background: face.background,
        clipPath: face.shape,
        border: face.shape ? undefined : `4px solid ${face.border}`,
        boxShadow: face.shape ? `inset 0 0 0 4px ${face.border}` : undefined,
        borderRadius: face.shape ? undefined : 6,
        color: face.text,
        fontSize,
        padding: 6,
      }}
    >
      <span style={face.glyphOffset ? { transform: `translateY(${face.glyphOffset})` } : undefined}>
        {glyph}
      </span>
    </div>
  );
};

/**
 * `compact` is the driving view: the picture and the name, nothing else. The
 * category and the meaning are revision text, and a paragraph is not something
 * anyone reads while a junction is coming towards them.
 */
const SignPlateCard = ({ sign, compact = false }: { sign: SignPlate; compact?: boolean }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5">
    <style>{`
      @keyframes signalBlink { 0%,49%{opacity:1} 50%,100%{opacity:0.15} }
    `}</style>

    <div
      className={`flex shrink-0 items-center justify-center rounded-md border border-border bg-white p-1.5 ${
        compact ? 'h-[76px] w-[76px]' : 'h-[104px] w-[104px]'
      }`}
    >
      {sign.image ? (
        <img
          src={`/${sign.image}`}
          alt={sign.name}
          className="max-h-full max-w-full object-contain"
        />
      ) : sign.art === 'signal_head' ? (
        <SignalGraphic aspect={sign.aspect ?? 'red'} />
      ) : (
        <SignFace plate={sign} compact={compact} />
      )}
    </div>

    <div className="min-w-0 flex-1">
      {!compact && (
        <p className="font-display text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          {sign.category}
        </p>
      )}
      <p className={`text-sm font-black leading-tight text-foreground ${compact ? '' : 'mt-0.5'}`}>
        {sign.name}
      </p>
      {!compact && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{sign.meaning}</p>}
    </div>
  </div>
);

export default SignPlateCard;
