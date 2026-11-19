/**
 * The admin area's building blocks, so every section reads the same way: a
 * header that says what the section is for, figures as tiles, content in
 * panels, and one shape for notices and empty states.
 */
import type { ReactNode } from 'react';
import { CircleAlert, Info, type LucideIcon } from 'lucide-react';

import { cn } from '@/shared/ui/cn';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export const SectionHeader = ({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description: ReactNode;
  /** A quiet line under the description: when it was read, how many there are. */
  meta?: ReactNode;
  actions?: ReactNode;
}) => (
  <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end">
    <div className="min-w-0 space-y-1">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">{actions}</div>}
  </header>
);

export const StatTile = ({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
}) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" />}
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
  </div>
);

export const Panel = ({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => (
  <section className={cn('min-w-0 rounded-xl border border-border bg-card', className)}>
    {(title || actions) && (
      <div className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={cn('p-4', bodyClassName)}>{children}</div>
  </section>
);

export const Notice = ({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) => {
  const Icon = tone === 'error' ? CircleAlert : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'error' ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-border bg-muted/40 text-muted-foreground'
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
    {Icon && <Icon className="h-6 w-6 text-muted-foreground" />}
    <p className="text-sm font-medium text-foreground">{title}</p>
    {children && <p className="max-w-sm text-xs text-muted-foreground">{children}</p>}
  </div>
);

/** A search box: an input with its own clear label. */
export const SearchField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <input
    type="search"
    aria-label={label}
    value={value}
    placeholder={placeholder ?? label}
    onChange={event => onChange(event.target.value)}
    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-72"
  />
);

const tabClass =
  'rounded-none border-b-2 border-transparent px-1 pb-2 pt-1 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

/** A section's own tabs: a row of views under its header. */
export const SectionTabs = <V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<{ value: V; label: string }>;
}) => (
  <Tabs value={value} onValueChange={next => onChange(next as V)}>
    <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
      {options.map(option => (
        <TabsTrigger key={option.value} value={option.value} className={tabClass}>
          {option.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);

/**
 * A legend: what a table's codes, colours and columns mean, beside the table.
 * Open by default; one click folds it away.
 */
export const Legend = ({
  title = 'Legend',
  items,
}: {
  title?: string;
  items: ReadonlyArray<{ term: ReactNode; meaning: ReactNode }>;
}) => (
  <details open className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
    <summary className="cursor-pointer select-none font-semibold text-foreground">{title}</summary>
    <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <dt className="shrink-0 font-medium text-foreground">{item.term}</dt>
          <dd className="text-muted-foreground">{item.meaning}</dd>
        </div>
      ))}
    </dl>
  </details>
);
