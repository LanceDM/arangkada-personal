// Dev-only. Shared lane + speed controls for the Renderer Lab - a controlled
// component so the parent owns the values (it needs them to build the fake
// CarState passed into drawCar/laneCentreX anyway).
import type { LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';

const LANES: LaneIndex[] = [0, 1, 2, 3];
const LANE_LABELS = ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4'];

const CarControls = ({
  lane,
  onLaneChange,
  speed,
  onSpeedChange,
}: {
  lane: LaneIndex;
  onLaneChange: (lane: LaneIndex) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}) => (
  <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-xs">
    <div className="flex items-center gap-1.5">
      <span className="font-semibold">Lane</span>
      {LANES.map(l => (
        <button
          key={l}
          onClick={() => onLaneChange(l)}
          className={`rounded-md px-2 py-1 font-semibold ${lane === l ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
        >
          {LANE_LABELS[l]}
        </button>
      ))}
    </div>
    <label className="flex items-center gap-1.5">
      <span className="font-semibold">Speed</span>
      <input
        type="number"
        value={speed}
        onChange={e => onSpeedChange(Number(e.target.value))}
        className="w-20 rounded-md border border-border bg-background px-2 py-1"
      />
      <span className="text-muted-foreground">km/h</span>
    </label>
  </div>
);

export default CarControls;
