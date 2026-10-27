// Composing a drive from competency pools: 3 scenarios per competency the
// stage teaches (decided 2026-10-28), the same shape as the short quiz.
//
// A stage's road keeps its authored geometry. Each competency's 3 scenarios
// are drawn, unseen first, from three places in order:
//
// 1. the stage's own content: its slots, its garage or crash-scene points, and
//    the scenarios written for the stage (`stageExtras`);
// 2. scenarios taught in earlier stages, where the competency is spread to this
//    stage (portable variants only, as the final exam and practice items use);
// 3. anything already seen, least recently seen first.
//
// A chosen slot variant stands at its slot; a chosen point variant at its
// point. When a slot is already taken, or the scenario has no slot here, a
// portable scenario is appended after the authored road. Slots and points
// nothing was chosen for are dropped, except a route-bound event (`scene:
// 'route'`), which shapes the road itself: it stays, is graded and logged as
// always, and does not count toward any competency's verdict in this drive.
import type { DrivingCompetency } from '@/domain/learner/competency';
import { DRIVE_ITEMS_PER_COMPETENCY } from '@/domain/learner/stageCompetencies';
import type { GarageHotspot, GarageStage, LevelConfig, ScenarioEvent } from './scenarioDefinition';
import type { SlotVariant } from './pooling';
import { isPortableRemediation, remediationCandidates } from './remediationPool';
import { declaredLineSpans } from './roadLine';
import { stageContent, type StageContent } from './stageContent';
import { STAGE_EXTRAS, extrasBefore } from './content/levels/stageExtras';

/** Where a composed scenario stands. */
export type Placement = 'slot' | 'appended' | 'garage' | 'aftermath';

/** One scenario counted toward a competency's verdict in this drive. */
export interface ComposedItem {
  competency: DrivingCompetency;
  scenarioId: string;
  placement: Placement;
  /** The stage the scenario was written for; differs from the drive's own for a borrowed one. */
  sourceLevelId: number;
}

export interface ComposedDrive {
  level: LevelConfig;
  /** The counted scenarios, per competency, in the order they were chosen. */
  items: ComposedItem[];
  /** Route-bound events kept on the road but not counted (`scene: 'route'`). */
  structural: string[];
  /** Competencies that could not be given their full count, and by how many. */
  shortfall: Partial<Record<DrivingCompetency, number>>;
}

export interface ComposeInput {
  levelId: number;
  competencies: readonly DrivingCompetency[];
  /** Scenario id -> when it was last seen (any increasing number). Unseen first, then least recently seen. */
  seen?: ReadonlyMap<string, number>;
  rng?: () => number;
  perCompetency?: number;
}

type Candidate =
  | { kind: 'slot'; slot: number; variant: SlotVariant; own: true }
  | { kind: 'point'; scene: 'garage' | 'aftermath'; point: number; hotspot: GarageHotspot; own: true }
  | { kind: 'append'; variant: SlotVariant; sourceLevelId: number; own: boolean };

const candidateId = (candidate: Candidate): string =>
  candidate.kind === 'point' ? candidate.hotspot.scenarioId ?? candidate.hotspot.id : candidate.variant.id;

const shuffle = <T>(items: T[], rng: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** A scenario that cannot be graded wrong gives no evidence, so it is never counted. */
const countable = (variant: { neutral?: boolean }) => !variant.neutral;

const candidatesFor = (content: StageContent, competency: DrivingCompetency): Candidate[] => {
  const own: Candidate[] = [];
  content.slots.forEach((pool, slot) =>
    pool
      .filter(variant => variant.competency === competency && countable(variant))
      .forEach(variant => own.push({ kind: 'slot', slot, variant, own: true }))
  );
  (['garage', 'aftermath'] as const).forEach(scene =>
    content[scene].forEach((point, index) =>
      point.variants
        .filter(hotspot => hotspot.competency === competency)
        .forEach(hotspot => own.push({ kind: 'point', scene, point: index, hotspot, own: true }))
    )
  );
  (STAGE_EXTRAS[content.levelId] ?? [])
    .filter(variant => variant.competency === competency && isPortableRemediation(variant))
    .forEach(variant => own.push({ kind: 'append', variant, sourceLevelId: content.levelId, own: true }));

  // Taught in an earlier stage: portable variants only, from the levels'
  // slots and the scenarios written for earlier stages.
  const borrowed: Candidate[] = [
    ...remediationCandidates(competency, content.levelId - 1).map(({ levelId, variant }): Candidate => ({
      kind: 'append', variant, sourceLevelId: levelId, own: false,
    })),
    ...extrasBefore(content.levelId)
      .filter(({ variant }) => variant.competency === competency && isPortableRemediation(variant))
      .map(({ levelId, variant }): Candidate => ({ kind: 'append', variant, sourceLevelId: levelId, own: false })),
  ];
  return [...own, ...borrowed];
};

/**
 * Unseen own content, then unseen borrowed content, then the least recently
 * seen of anything: three tiers, drawn in order. Within a tier the order is
 * random, so a retake is not a password.
 */
const tiered = (candidates: Candidate[], seen: ReadonlyMap<string, number>, rng: () => number): Candidate[][] => {
  const unseenOwn = shuffle(candidates.filter(c => c.own && !seen.has(candidateId(c))), rng);
  const unseenBorrowed = shuffle(candidates.filter(c => !c.own && !seen.has(candidateId(c))), rng);
  const seenAny = shuffle(candidates.filter(c => seen.has(candidateId(c))), rng).sort(
    (a, b) => seen.get(candidateId(a))! - seen.get(candidateId(b))!
  );
  return [unseenOwn, unseenBorrowed, seenAny];
};

/** The gap the stage's own slots are spaced at (their median), never under 700 units. */
const stageSpacing = (distances: number[]): number => {
  const sorted = [...distances].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((d, i) => d - sorted[i]).sort((a, b) => a - b);
  const median = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;
  return Math.max(median, MIN_APPEND_SPACING);
};
const MIN_APPEND_SPACING = 700;

/**
 * Appends portable scenarios after the authored road's last slot, at the
 * stage's own spacing, with the authored run-out kept behind the last one. The
 * road grows; every authored slot keeps its distance, geometry and paint. A
 * line a scenario is graded on comes with it, as practice items always did.
 */
const placeAppended = (level: LevelConfig, content: StageContent, variants: SlotVariant[]): LevelConfig => {
  if (variants.length === 0) return level;
  const lastAuthored = Math.max(...content.distances);
  const runway = Math.max(content.base.roadLength - lastAuthored, 0);
  const spacing = stageSpacing(content.distances);
  const placed: ScenarioEvent[] = variants.map((variant, index) => ({
    ...variant,
    triggerAtDistance: lastAuthored + spacing * (index + 1),
  }));
  return {
    ...level,
    events: [...level.events, ...placed],
    roadLength: lastAuthored + spacing * variants.length + runway,
    ...(level.paint ? { paint: { ...level.paint, spans: [...level.paint.spans, ...declaredLineSpans(placed)] } } : {}),
  };
};

/** The level's pass and star thresholds, rescaled to the points actually on this drive (display only). */
// Kept for the results screen only: under the per-competency design the
// verdict is per competency (2 of 3), and these totals decide nothing.
const rescaleThresholds = (events: ScenarioEvent[], points: GarageHotspot[]): Partial<LevelConfig> => {
  const total = events.reduce((sum, event) => sum + event.points, 0) + points.reduce((sum, point) => sum + point.points, 0);
  return {
    requiredScore: Math.round(total * 0.7),
    stars2: Math.round(total * 0.85),
    stars3: Math.round(total * 0.95),
  };
};

const stageScene = (authored: GarageStage | undefined, hotspots: GarageHotspot[]): GarageStage | undefined =>
  authored && hotspots.length > 0 ? { ...authored, hotspots } : undefined;

/**
 * The drive for these competencies: `perCompetency` scenarios each (3), drawn
 * unseen first. A repeat drive is the same call with only the competencies
 * that are not done, and the scenarios seen so far in `seen`.
 */
export const composeDrive = ({
  levelId,
  competencies,
  seen = new Map(),
  rng = Math.random,
  perCompetency = DRIVE_ITEMS_PER_COMPETENCY,
}: ComposeInput): ComposedDrive => {
  const content = stageContent(levelId);
  if (!content) throw new Error(`level ${levelId} has no stage content to compose from`);

  const slotTaken = new Map<number, SlotVariant>();
  const pointTaken = { garage: new Map<number, GarageHotspot>(), aftermath: new Map<number, GarageHotspot>() };
  const appended: SlotVariant[] = [];
  const chosenIds = new Set<string>();
  const items: ComposedItem[] = [];
  const shortfall: ComposedDrive['shortfall'] = {};

  // Route-bound events shape the road, so they stay whatever is chosen.
  const structuralSlots = new Set<number>();
  content.slots.forEach((pool, slot) => {
    if (pool.some(variant => variant.scene === 'route')) structuralSlots.add(slot);
  });

  // The competency with the fewest candidates picks first, so a contested
  // slot goes to whoever has nowhere else to stand.
  const pools = competencies
    .map(competency => {
      const all = candidatesFor(content, competency);
      return { competency, size: all.length, tiers: tiered(all, seen, rng) };
    })
    .sort((a, b) => a.size - b.size);

  /** Whether a candidate can stand on the authored road right now: a free slot or point. */
  const fitsInPlace = (candidate: Candidate): boolean =>
    candidate.kind === 'point'
      ? !pointTaken[candidate.scene].has(candidate.point)
      : candidate.kind === 'slot' && !slotTaken.has(candidate.slot);

  const canAppend = (candidate: Candidate): boolean =>
    candidate.kind !== 'point' && isPortableRemediation(candidate.variant);

  const take = (competency: DrivingCompetency, candidate: Candidate) => {
    const id = candidateId(candidate);
    if (candidate.kind === 'point') {
      pointTaken[candidate.scene].set(candidate.point, candidate.hotspot);
      items.push({ competency, scenarioId: id, placement: candidate.scene, sourceLevelId: levelId });
    } else if (candidate.kind === 'slot' && !slotTaken.has(candidate.slot)) {
      slotTaken.set(candidate.slot, candidate.variant);
      items.push({ competency, scenarioId: id, placement: 'slot', sourceLevelId: levelId });
    } else {
      appended.push(candidate.variant);
      items.push({
        competency,
        scenarioId: id,
        placement: 'appended',
        sourceLevelId: candidate.kind === 'append' ? candidate.sourceLevelId : levelId,
      });
    }
    chosenIds.add(id);
  };

  for (const { competency, tiers } of pools) {
    let count = 0;
    // Tier by tier; within a tier, whatever fits a free slot or point first,
    // re-checked after every pick, so the authored road is used before
    // anything is appended to it.
    for (const tier of tiers) {
      while (count < perCompetency) {
        const open = tier.filter(candidate => !chosenIds.has(candidateId(candidate)));
        const next = open.find(fitsInPlace) ?? open.find(canAppend);
        if (!next) break;
        take(competency, next);
        count += 1;
      }
    }
    if (count < perCompetency) shortfall[competency] = perCompetency - count;
  }

  // Unchosen route-bound slots keep their first variant, as the static level has it.
  const structural: string[] = [];
  for (const slot of structuralSlots) {
    if (!slotTaken.has(slot)) {
      const variant = content.slots[slot][0];
      slotTaken.set(slot, variant);
      structural.push(variant.id);
    }
  }

  const events: ScenarioEvent[] = [...slotTaken.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slot, variant]) => ({ ...variant, triggerAtDistance: content.distances[slot] }));

  const garageHotspots = [...pointTaken.garage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([point, hotspot]) => ({ ...content.garage[point].shell, ...hotspot }));
  const aftermathHotspots = [...pointTaken.aftermath.entries()]
    .sort(([a], [b]) => a - b)
    .map(([point, hotspot]) => ({ ...content.aftermath[point].shell, ...hotspot }));

  const authored = content.base;
  const placed: LevelConfig = content.assemble ? content.assemble(events) : { ...authored, events };
  const road: LevelConfig = {
    ...placed,
    garage: stageScene(authored.garage, garageHotspots),
    aftermath: stageScene(authored.aftermath, aftermathHotspots),
  };
  const withAppended = placeAppended(road, content, appended);
  const level: LevelConfig = {
    ...withAppended,
    ...rescaleThresholds(withAppended.events, [...garageHotspots, ...aftermathHotspots]),
  };
  if (!level.garage) delete level.garage;
  if (!level.aftermath) delete level.aftermath;

  return { level, items, structural, shortfall };
};

/** The scenario ids of one composed drive, per competency: what the verdict is read over. */
export const itemsByCompetency = (drive: Pick<ComposedDrive, 'items'>): Map<DrivingCompetency, string[]> => {
  const out = new Map<DrivingCompetency, string[]>();
  for (const item of drive.items) out.set(item.competency, [...(out.get(item.competency) ?? []), item.scenarioId]);
  return out;
};
