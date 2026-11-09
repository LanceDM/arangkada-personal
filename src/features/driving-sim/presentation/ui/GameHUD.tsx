import { Gauge, Timer, Zap } from 'lucide-react';
import { useInputMode } from '@/features/driving-sim/presentation/input/inputMode';
import { LANE_COUNT } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { RoadPosition } from '@/features/driving-sim/domain/world/routeGeometry';
import type { RoadPositionCue } from './roadPositionLabel';
import { useText } from '@/shared/i18n/useText';
import { hudMessages as m } from './messages';

interface GameHUDProps {
  score: number;
  speed: number;
  levelName: string;
  levelId: number;
  onExit: () => void;
  /** Lane the car is in, 0 = left. */
  position: RoadPosition;
  cue: RoadPositionCue;
  /** Lanes the sign ahead accepts. A road that ends accepts two, one per turn. */
  requiredLanes?: number[];
  /** How many lanes at the left belong to opposing traffic, so the strip can show the centre line. */
  oncomingLanes?: number;
  /** Speed the driver has set, which the car holds. */
  targetSpeed?: number;
  /** The maximum in force where the car is; omitted, nothing is shown. */
  speedLimit?: number;
  /** Whole seconds of driving left before time's up, or null where the level has no limit. */
  secondsLeft?: number | null;
}

/** The last stretch of a level's driving time, when the clock turns amber. */
const TIME_RUNNING_OUT_SECONDS = 30;

const clockLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Strip of the carriageway showing where the car is and, when a sign assigns a
 * lane, where it needs to be. This replaces arrows painted on the road, which
 * buried the carriageway under markings.
 *
 * The lanes carrying opposing traffic are dimmed and split off by a yellow
 * rule, so the readout answers "which side am I on" as directly as it answers
 * "which lane am I in" — on a four-lane two-way road those are two different
 * questions, and the second one only matters once you have the first right.
 */
const LaneStrip = ({
  position,
  cue,
  requiredLanes = [],
  oncomingLanes = 0,
}: {
  position: RoadPosition;
  cue: RoadPositionCue;
  requiredLanes?: number[];
  oncomingLanes?: number;
}) => (
  <div className="text-center">
    {/* Named, not numbered: a car on the acceleration lane is not in Lane 4,
        and the strip says which of the two it is in words as well as in which
        pip is lit. */}
    <p className="whitespace-nowrap text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
      {cue.place}
    </p>
    <div className="mt-1 flex items-center gap-1">
      {Array.from({ length: LANE_COUNT }, (_, index) => {
        const lane = position.place === 'through-lane' || position.place === 'toll-approach'
          ? position.lane
          : -1;
        const here = index === lane;
        const wanted = requiredLanes.includes(index);
        const opposing = index < oncomingLanes;
        return (
          <span
            key={index}
            // The centre line, drawn where it actually is.
            style={
              index === oncomingLanes && oncomingLanes > 0
                ? { marginLeft: 4, borderLeftWidth: 2, borderLeftColor: 'rgb(240 201 41)' }
                : undefined
            }
            className={`flex h-6 w-5 items-center justify-center rounded-sm border text-[10px] font-black ${
              here && opposing ? 'border-destructive bg-destructive/30 text-destructive'
                : here && wanted ? 'border-accent bg-accent/30 text-accent'
                : here ? 'border-primary bg-primary/25 text-primary'
                : wanted ? 'border-road-yellow border-dashed bg-road-yellow/15 text-road-yellow'
                : opposing ? 'border-border/40 bg-background/30 text-muted-foreground/40'
                : 'border-border bg-background/60 text-muted-foreground'
            }`}
          >
            {here ? '▲' : wanted ? '◦' : ''}
          </span>
        );
      })}
      {/* The auxiliary lane, set apart from the carriageway by a gap and its own
          rule, because it is a different road. It only appears where the route
          has one. */}
      {position.auxiliary && (
        <span
          style={{ marginLeft: 5, borderLeftWidth: 2, borderLeftColor: 'rgb(148 163 184)' }}
          className={`flex h-6 w-5 items-center justify-center rounded-sm border text-[10px] font-black ${
            position.place === 'acceleration-lane' || position.place === 'deceleration-lane'
              ? 'border-road-yellow bg-road-yellow/25 text-road-yellow'
              : 'border-border bg-background/60 text-muted-foreground'
          }`}
        >
          {position.place === 'acceleration-lane' || position.place === 'deceleration-lane' ? '▲' : ''}
        </span>
      )}
    </div>
  </div>
);

const HudKey = ({ children }: { children: string }) => (
  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-[11px] font-black text-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]">
    {children}
  </span>
);

/**
 * Every element here is positioned against the driving stage, never the
 * viewport, so the HUD stays locked to the canvas at any window size.
 *
 * Route progress is deliberately absent. The mission panel beside the board
 * already reports it, with a percentage beside the bar; a second, unlabelled
 * copy laid across the top of the canvas said the same thing twice and read as
 * a loading bar over the road.
 */
const GameHUD = ({ score, speed, levelName, levelId, onExit, position, cue, requiredLanes = [], oncomingLanes = 0, targetSpeed = 0, speedLimit, secondsLeft = null }: GameHUDProps) => {
  const say = useText();
  // Shown speed against the limit, so the colour never disagrees with the digits.
  const over = speedLimit !== undefined && Math.round(speed) > speedLimit;
  const mode = useInputMode();
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
      <div className="pointer-events-auto flex items-center justify-between gap-2 px-3 pt-3">
        <button
          onClick={onExit}
          className="rounded-lg border border-border bg-card/85 px-3 py-1.5 font-display text-[11px] tracking-wider text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
        >
          {say(m.exit)}
        </button>

        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card/85 px-3 py-1.5 backdrop-blur">
          <span className="font-display text-[11px] text-muted-foreground">{say(m.level(levelId))}</span>
          <span className="h-3 w-px bg-border" />
          <span className="truncate font-body text-[11px] text-foreground">{levelName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Driving time left. It stands still while a panel is open, because
              reading is never counted, and turns amber for the last half minute. */}
          {secondsLeft !== null && (
            <div
              aria-label={say(m.timeLeft(clockLabel(secondsLeft)))}
              className={`flex items-center gap-1 rounded-lg border bg-card/85 px-2 py-1.5 backdrop-blur ${
                secondsLeft <= TIME_RUNNING_OUT_SECONDS ? 'border-road-yellow/60 text-road-yellow' : 'border-border text-muted-foreground'
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              <span className="font-display text-[11px] tabular-nums">{clockLabel(secondsLeft)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/85 px-3 py-1.5 backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="font-display text-sm text-primary">{score}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex justify-center px-3 pb-3">
        <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-border bg-card/90 px-5 py-2.5 backdrop-blur">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            {/* One line, and it must stay one line. The setting used to wrap
                under "km/h" the moment the bar ran short of room, which put the
                number the player is steering by on a line of its own with no
                label beside it. */}
            <div className="flex items-baseline gap-1 whitespace-nowrap leading-none">
              <span
                className={`font-display text-lg ${over ? 'text-destructive' : 'text-foreground'}`}
                aria-label={over ? say(m.overLimit(Math.round(speed), speedLimit)) : undefined}
              >
                {Math.round(speed)}
              </span>
              <span className="text-xs text-muted-foreground">km/h</span>
              {/* The speed you asked for, so a setting that has not been
                  reached yet is visible rather than guessed at. */}
              <span className="ml-1 font-display text-[10px] uppercase tracking-wider text-primary">
                {say(m.speedSet(Math.round(targetSpeed)))}
              </span>
            </div>
            {/* The limit in force here, drawn as the round sign that posts one:
                the road's, or a scenario's posting inside its zone.
                A fact about the road, so it shows at every support level. */}
            {speedLimit !== undefined && (
              <div
                aria-label={say(m.speedLimit(speedLimit))}
                className="ml-1 flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-destructive bg-white leading-none"
              >
                <span className="font-display text-[11px] font-black text-black">{speedLimit}</span>
              </div>
            )}
          </div>
          <div className="h-8 w-px bg-border" />
          <LaneStrip
            position={position}
            cue={cue}
            requiredLanes={requiredLanes}
            oncomingLanes={oncomingLanes}
          />
          {/* The keyboard's legend. A touch screen has its controls beside the
              board, labelled, so naming keys there would name nothing. */}
          {mode === 'keys' && (
            <>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{say(m.controls)}</p>
                <div className="mt-1 flex items-center gap-1">
                  <HudKey>↑</HudKey>
                  <HudKey>↓</HudKey>
                  <HudKey>←</HudKey>
                  <HudKey>→</HudKey>
                  {/* No H: the horn is never an answer, and is graded only on
                      Level 8, where sounding it is the mistake. The key still works. */}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHUD;
