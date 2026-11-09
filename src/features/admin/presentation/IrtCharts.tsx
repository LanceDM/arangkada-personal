/**
 * The IRT section's figures, drawn from the published report alone.
 *
 * - **The Wright map** puts people (θ_pre) and items (b) on one logit axis,
 *   so how well the 60 items target the participants can be seen at once
 *   (Wright & Stone, 1979, foundation; Boone & Staver, 2020).
 * - **The information curves** show where each block measures most precisely,
 *   with the routing block's cut points marked at the θ̂ of their scores: the
 *   picture `raschAssemble.ts`'s approximate-maximum-information rule reads
 *   (Luecht & Luo, 2024).
 *
 * The four blocks keep one hue each, in the reference palette's fixed order,
 * validated in both modes; every curve is labelled at its end, and the
 * routing table beside it is the table view.
 */
import { useState } from 'react';
import type { IrtInformationCurves, IrtRoutingRow } from '@/domain/assessment/irtReport';
import type { RoutingCuts, TestBlock } from '@/domain/assessment/twoStageDesign';
import { LOGIT_RANGE, linePath, nearestIndex, scale, spreadLabels, wrightBins } from './irtChartGeometry';
import { BLOCK_COLOR, BLOCK_LABEL } from './irtPalette';

const BLOCKS: readonly TestBlock[] = ['routing', 'easy', 'medium', 'hard'];

const AXIS = 'stroke-border';
const INK = 'fill-muted-foreground';

const f = (x: number, d = 2) => x.toFixed(d);

/** People to the left of the axis, items to the right, in half-logit rows, hardest and ablest at the top. */
export const WrightMap = ({ thetas, items }: { thetas: readonly number[]; items: readonly { id: string; b: number }[] }) => {
  const bins = wrightBins(thetas, items).reverse();
  const row = 22;
  const height = bins.length * row + 24;
  const maxPersons = Math.max(1, ...bins.map(b => b.persons));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 640 ${height}`} className="w-full" role="img" aria-label="Wright map: persons and items on one logit scale">
        <text x={140} y={12} textAnchor="middle" className={`${INK} text-[11px]`}>Persons (θ pre-test)</text>
        <text x={420} y={12} textAnchor="middle" className={`${INK} text-[11px]`}>Items (b)</text>
        <line x1={290} x2={290} y1={20} y2={height - 4} className={AXIS} strokeWidth={1} />
        {bins.map((bin, i) => {
          const y = 20 + i * row;
          const w = (bin.persons / maxPersons) * 220;
          const label = `${f(bin.from, 1)} to ${f(bin.to, 1)} logits: ${bin.persons} person(s), ${bin.items.length} item(s)`;
          return (
            <g key={bin.from} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={y} width={640} height={row} className={hover === i ? 'fill-muted/60' : 'fill-transparent'} />
              <title>{label}</title>
              <text x={286} y={y + 15} textAnchor="end" className={`${INK} text-[10px] tabular-nums`}>{f(bin.from, 1)}</text>
              {bin.persons > 0 && (
                <rect x={256 - w} y={y + 4} width={w} height={row - 8} rx={4} className={`fill-current ${BLOCK_COLOR.routing}`} />
              )}
              {bin.persons > 0 && (
                <text x={252 - w} y={y + 15} textAnchor="end" className="fill-foreground text-[10px] tabular-nums">{bin.persons}</text>
              )}
              {bin.items.map((item, k) => (
                <circle key={item.id} cx={302 + k * 11} cy={y + row / 2} r={4.5} className="fill-foreground/70">
                  <title>{`${item.id}: b = ${f(item.b)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {hover !== null
          ? `${f(bins[hover].from, 1)} to ${f(bins[hover].to, 1)} logits: ${bins[hover].persons} person(s); ${bins[hover].items.map(i => i.id).join(', ') || 'no items'}.`
          : 'Bars: persons per half logit. Dots: one per item at its frozen difficulty. Values beyond ±4 sit in the end row. Hover a row for its contents.'}
      </figcaption>
    </figure>
  );
};

/** Each block's test information over θ, with the two cut points at their routing scores' θ̂. */
export const InformationCurves = ({
  curves,
  cuts,
  table,
}: {
  curves: IrtInformationCurves;
  cuts: RoutingCuts;
  table: readonly IrtRoutingRow[];
}) => {
  const W = 640;
  const H = 280;
  const pad = { left: 40, right: 70, top: 36, bottom: 30 };
  const top = Math.max(...BLOCKS.flatMap(b => curves[b])) * 1.08;
  const x = (theta: number) => scale(theta, LOGIT_RANGE, [pad.left, W - pad.right]);
  const y = (info: number) => scale(info, [0, top], [H - pad.bottom, pad.top]);
  const [at, setAt] = useState<number | null>(null);
  const cutTheta = cuts.map(c => table.find(r => r.score === c)?.theta ?? null);
  const ticks = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  const yTicks = [0, top / 2, top].map(v => Math.round(v * 10) / 10);
  const labelY = spreadLabels(BLOCKS.map(b => y(curves[b][curves[b].length - 1]) + 3), 12);

  return (
    <figure className="space-y-2">
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Blocks">
        {BLOCKS.map(block => (
          <li key={block} className="flex items-center gap-1.5">
            <span className={`h-0.5 w-4 rounded bg-current ${BLOCK_COLOR[block]}`} />
            {BLOCK_LABEL[block]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-foreground/60" />
          Cut point
        </li>
      </ul>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Information curves of the four blocks, with the cut points"
        onMouseMove={event => {
          const box = event.currentTarget.getBoundingClientRect();
          const theta = LOGIT_RANGE[0] + (((event.clientX - box.left) / box.width) * W - pad.left) / (W - pad.left - pad.right) * 8;
          setAt(nearestIndex(curves.theta, theta));
        }}
        onMouseLeave={() => setAt(null)}
      >
        {yTicks.map(v => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} className="stroke-border/60" strokeWidth={1} />
            <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" className={`${INK} text-[10px] tabular-nums`}>{f(v, 1)}</text>
          </g>
        ))}
        {ticks.map(t => (
          <text key={t} x={x(t)} y={H - 12} textAnchor="middle" className={`${INK} text-[10px] tabular-nums`}>{t}</text>
        ))}
        <text x={(pad.left + W - pad.right) / 2} y={H - 1} textAnchor="middle" className={`${INK} text-[10px]`}>θ (logits)</text>
        {cutTheta.map((theta, i) =>
          theta === null ? null : (
            <g key={i}>
              <line x1={x(theta)} x2={x(theta)} y1={6 + i * 13} y2={H - pad.bottom} className="stroke-foreground/50" strokeWidth={1} strokeDasharray="4 3" />
              <text x={x(theta) + 4} y={14 + i * 13} className="fill-foreground text-[10px]">
                {`cut ${i + 1}: score ${cuts[i]} (θ̂ ${f(theta)})`}
              </text>
            </g>
          )
        )}
        {BLOCKS.map((block, b) => {
          const points = curves.theta.map((t, i) => [x(t), y(curves[block][i])] as const);
          const last = points[points.length - 1];
          const peak = curves[block].indexOf(Math.max(...curves[block]));
          return (
            <g key={block} className={BLOCK_COLOR[block]}>
              <path d={linePath(points)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
              <circle cx={points[peak][0]} cy={points[peak][1]} r={4} fill="currentColor" className="stroke-card" strokeWidth={2} />
              <text x={last[0] + 6} y={labelY[b]} className="fill-foreground text-[10px]">{BLOCK_LABEL[block]}</text>
            </g>
          );
        })}
        {at !== null && (
          <line x1={x(curves.theta[at])} x2={x(curves.theta[at])} y1={pad.top} y2={H - pad.bottom} className="stroke-muted-foreground" strokeWidth={1} />
        )}
      </svg>
      <figcaption className="text-xs tabular-nums text-muted-foreground">
        {at !== null
          ? `θ = ${f(curves.theta[at], 1)}: ${BLOCKS.map(b => `${BLOCK_LABEL[b]} ${f(curves[b][at])}`).join(' · ')}`
          : 'Test information I(θ) = Σ P(1 − P) per block, from the frozen difficulties. A dot marks each peak. Hover for the values at a θ.'}
      </figcaption>
    </figure>
  );
};
