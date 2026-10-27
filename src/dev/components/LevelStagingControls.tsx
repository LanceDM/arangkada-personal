// Dev-only. The "pick a level, then force its content" control block shared
// between ScenarioLab and RendererLab's Scrub tab - level dropdown, plus for
// whichever levels currently roll from a pool, a seeded/exact-variant toggle
// and the per-slot pickers.
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { garageHotspotSlots, labelForEvent, POOLED_LEVEL_IDS } from '@/dev/fixtures/scenarioCatalog';
import type { StagedLevel } from '@/dev/fixtures/useStagedLevel';

const MODE_BUTTONS: { key: StagedLevel['mode']; label: string }[] = [
  { key: 'seeded',  label: 'Seeded' },
  { key: 'single',  label: 'Single event' },
  { key: 'exact',   label: 'All slots' },
];

const LevelStagingControls = ({ staged }: { staged: StagedLevel }) => {
  const {
    levelId, setLevelId, mode, setMode, seed, setSeed,
    exactIndices, setExactIndices, exactHotspotIndices, setExactHotspotIndices,
    singlePick, setSinglePick,
    isPooled, pooled,
  } = staged;

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">Level</span>
        <select
          value={levelId}
          onChange={e => setLevelId(Number(e.target.value))}
          className="w-full min-w-0 rounded-md border border-border bg-card px-3 py-2"
        >
          {LEVELS.map(l => (
            <option key={l.id} value={l.id}>
              {l.id} — {l.name}{POOLED_LEVEL_IDS.includes(l.id) ? ' (pooled)' : ''}
            </option>
          ))}
        </select>
      </label>

      {isPooled && (
        <div className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
          <div className="flex flex-wrap gap-2">
            {MODE_BUTTONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === key ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'seeded' && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Seed</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={seed}
                  onChange={e => setSeed(Number(e.target.value))}
                  className="w-32 rounded-md border border-border bg-background px-3 py-2"
                />
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
                  className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Reroll seed
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                Same seed always rolls the same content - use it to reproduce a specific run.
              </span>
            </label>
          )}

          {mode === 'single' && pooled && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Event</span>
              <select
                value={`${singlePick.slotIndex}-${singlePick.variantIndex}`}
                onChange={e => {
                  const [si, vi] = e.target.value.split('-').map(Number);
                  setSinglePick({ slotIndex: si, variantIndex: vi });
                }}
                className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5"
              >
                {pooled.slots.flatMap((pool, si) =>
                  pool.map((variant, vi) => (
                    <option key={`${si}-${vi}`} value={`${si}-${vi}`}>
                      {labelForEvent({ ...variant, triggerAtDistance: pooled.distances[si] })}
                    </option>
                  ))
                )}
              </select>
              <span className="text-xs text-muted-foreground">
                Only this event is forced — the other slots fill in randomly (seed {seed}).
              </span>
            </label>
          )}

          {mode === 'exact' && pooled && (
            <div className="grid gap-3">
              {pooled.slots.map((pool, i) => (
                <label key={i} className="grid gap-1 text-xs">
                  <span className="font-semibold">Slot {i + 1} (distance {pooled.distances[i]})</span>
                  <select
                    value={exactIndices[i] ?? 0}
                    onChange={e => setExactIndices(prev => prev.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                    className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5"
                  >
                    {pool.map((variant, vi) => (
                      <option key={vi} value={vi}>
                        {labelForEvent({ ...variant, triggerAtDistance: 0 })}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              {levelId === 2 &&
                garageHotspotSlots.map(({ shell, pool }, i) => (
                  <label key={shell.id} className="grid gap-1 text-xs">
                    <span className="font-semibold">Garage — {shell.label}</span>
                    <select
                      value={exactHotspotIndices[i] ?? 0}
                      onChange={e =>
                        setExactHotspotIndices(prev => prev.map((v, j) => (j === i ? Number(e.target.value) : v)))
                      }
                      className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5"
                    >
                      {pool.map((variant, vi) => (
                        <option key={vi} value={vi}>{variant.question}</option>
                      ))}
                    </select>
                  </label>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LevelStagingControls;
