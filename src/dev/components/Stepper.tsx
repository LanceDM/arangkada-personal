// Dev-only. Prev/Next buttons plus a dropdown that jumps straight to any
// item by name - shared by the Component Gallery and Renderer Lab so
// browsing a long catalog (hundreds of scenario events) doesn't mean
// clicking Next over and over to reach the one you actually want.
const Stepper = ({
  index,
  count,
  onChange,
  labels,
  wrapperClassName = 'rounded-lg border border-border bg-card/60 px-3 py-2 text-xs',
}: {
  index: number;
  count: number;
  onChange: (next: number) => void;
  labels: string[];
  wrapperClassName?: string;
}) => (
  <div className={wrapperClassName}>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange((index - 1 + count) % count)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold hover:bg-secondary"
      >
        ← Prev
      </button>
      <span className="font-display text-xs text-muted-foreground">{index + 1} / {count}</span>
      <button
        onClick={() => onChange((index + 1) % count)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold hover:bg-secondary"
      >
        Next →
      </button>
    </div>
    <select
      value={index}
      onChange={e => onChange(Number(e.target.value))}
      className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
    >
      {labels.map((label, i) => (
        <option key={i} value={i}>{i + 1}. {label}</option>
      ))}
    </select>
  </div>
);

export default Stepper;
