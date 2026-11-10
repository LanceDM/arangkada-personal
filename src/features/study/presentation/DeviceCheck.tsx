import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, RotateCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ActionBar } from '@/shared/ui/ActionBar';
import { KEEPS_UP_AT_FPS, usePortrait, useTouchDevice } from '@/features/driving-sim';
import type { DeviceCheckDoc } from '@/domain/study/consentRecords';
import { saveDeviceCheck } from '@/features/study/application/studyActions';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote } from './studyFields';
import { studyMessages as m, studyValueMessages as v } from './messages';

/** How long the frame rate is measured. */
const MEASURE_MS = 5_000;

type Control = keyof DeviceCheckDoc['controls'];

const CONTROLS: Array<{ id: Control; label: Localized; keys: Localized; icon: typeof ArrowUp }> = [
  { id: 'accelerate', label: m.accelerate, keys: m.text, icon: ArrowUp },
  { id: 'brake', label: m.brake, keys: m.orSpace, icon: ArrowDown },
  { id: 'left', label: m.left, keys: m.text2, icon: ArrowLeft },
  { id: 'right', label: m.right, keys: m.text3, icon: ArrowRight },
];

const KEY_CONTROL: Record<string, Control> = {
  ArrowUp: 'accelerate',
  ArrowDown: 'brake',
  ' ': 'brake',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
};

/**
 * The device check , before the pre-test, so a
 * device that cannot run the game is found before an hour goes on the test.
 *
 * - A touch device is held landscape: the drive does not advance upright
 *.
 * - The frame rate is measured for five seconds. The world keeps real time
 *   down to `KEEPS_UP_AT_FPS` (60 steps a second, at most four a frame);
 *   below it the device falls behind, which is warned, never excluded: every
 *   drive records the time it lost anyway.
 * - Each control is pressed once, by key or by the on-screen button, so the
 *   participant knows them before the tutorial teaches them.
 */
export const DeviceCheck = ({ uid, onDone }: { uid: string; onDone: () => void }) => {
  const touch = useTouchDevice();
  const portrait = usePortrait();
  const [fps, setFps] = useState<number | null>(null);
  const [pressed, setPressed] = useState<Record<Control, boolean>>({ accelerate: false, brake: false, left: false, right: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const text = useText();

  useEffect(() => {
    let frame = 0;
    let first: number | null = null;
    let last: number | null = null;
    const intervals: number[] = [];
    const tick = (at: number) => {
      if (last !== null) intervals.push(at - last);
      first ??= at;
      last = at;
      if (at - first >= MEASURE_MS) {
        setFps(Math.round(1000 / Math.max(1, median(intervals))));
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const control = KEY_CONTROL[event.key];
      if (!control) return;
      event.preventDefault();
      setPressed(current => ({ ...current, [control]: true }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allPressed = Object.values(pressed).every(Boolean);
  const upright = touch && portrait;
  const ready = fps !== null && allPressed && !upright;

  const save = async () => {
    if (fps === null) return;
    setBusy(true);
    setError(null);
    try {
      await saveDeviceCheck(uid, {
        schemaVersion: 1,
        touch,
        landscape: !upright,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        medianFps: fps,
        slow: fps < KEEPS_UP_AT_FPS,
        controls: pressed,
        checkedAt: Date.now(),
      });
      onDone();
    } catch {
      setError(m.theCheckCouldNot);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-center font-display text-lg font-bold">
        <Say {...m.checkYourDevice} />
      </h1>

      {upright && (
        <p className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm" role="status">
          <RotateCw className="h-5 w-5 shrink-0 text-primary" />
          {text(m.turnYourDeviceSideways)}
        </p>
      )}

      <div className="rounded-lg border border-border p-3 text-sm">
        {fps === null ? (
          <p className="text-muted-foreground">{text(m.measuringHowSmoothlyThis)}</p>
        ) : fps < KEEPS_UP_AT_FPS ? (
          <p className="text-destructive">
            {text(v.deviceSlow(fps))}
          </p>
        ) : (
          <p className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            {text(v.deviceSmooth(fps))}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm">
          {text(v.pressEachControl(touch))}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CONTROLS.map(({ id, label, keys, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onPointerDown={() => setPressed(current => ({ ...current, [id]: true }))}
              className={`flex h-16 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${pressed[id] ? 'border-emerald-500/60 bg-emerald-500/15' : 'border-border bg-muted/40'}`}
              aria-pressed={pressed[id]}
            >
              {pressed[id] ? <Check className="h-5 w-5 text-emerald-500" /> : <Icon className="h-5 w-5" />}
              <span className="flex flex-col leading-tight">
                <span>{text(label)}</span>
                {!touch && <span className="text-xs text-muted-foreground">{text(keys)}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />
      <ActionBar className="-mx-6 px-6 sm:-mx-8 sm:px-8 bg-card">
        <Button size="lg" className="h-14 w-full font-display font-bold" disabled={!ready || busy} onClick={() => void save()}>
          {busy ? text(m.saving) : text(m.done)}
        </Button>
      </ActionBar>
    </div>
  );
};
