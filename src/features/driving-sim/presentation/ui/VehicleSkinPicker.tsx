/**
 * Choose how your vehicle looks (2026-11-19): the car or the motorcycle, each
 * shown as it is drawn on the road. Looks only: the drive, its rules and its
 * scoring are the same either way.
 */
import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { VEHICLE_SKIN_NAMES, VEHICLE_SKINS, type VehicleSkin } from '@/shared/lib/vehicleSkin';
import { useText } from '@/shared/i18n/useText';
import { drawPlayerVehicle } from '@/features/driving-sim/presentation/canvas/rendering/renderers/roadRenderer';

const PREVIEW_W = 120;
const PREVIEW_H = 110;

const Preview = ({ skin }: { skin: VehicleSkin }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = PREVIEW_W * scale;
    canvas.height = PREVIEW_H * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // A strip of asphalt with a lane line, so the preview reads as the road.
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = -6; y < PREVIEW_H; y += 22) ctx.fillRect(PREVIEW_W - 22, y, 3, 12);
    drawPlayerVehicle(ctx, PREVIEW_W / 2 - 8, PREVIEW_H / 2, skin);
  }, [skin]);
  return <canvas ref={ref} style={{ width: PREVIEW_W, height: PREVIEW_H }} className="rounded-xl" aria-hidden />;
};

export const VehicleSkinPicker = ({
  value,
  onChange,
  disabled = false,
}: {
  value: VehicleSkin;
  onChange: (skin: VehicleSkin) => void;
  disabled?: boolean;
}) => {
  const text = useText();
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {VEHICLE_SKINS.map(skin => {
        const selected = skin === value;
        return (
          <button
            key={skin}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(skin)}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-colors disabled:opacity-60 ${
              selected ? 'border-yellow-400 bg-yellow-400/10' : 'border-border bg-card hover:border-yellow-400/50'
            }`}
          >
            {selected && (
              <span className="absolute right-2 top-2 rounded-full bg-yellow-400 p-0.5 text-black">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
            <Preview skin={skin} />
            <span className="text-sm font-black uppercase italic tracking-tight">{text(VEHICLE_SKIN_NAMES[skin])}</span>
          </button>
        );
      })}
    </div>
  );
};
