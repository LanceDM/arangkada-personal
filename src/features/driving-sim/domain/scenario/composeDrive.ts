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
import { COMPETENCIES } from '@/domain/learner/profile';
import { DRIVE_ITEMS_PER_COMPETENCY } from '@/domain/learner/stageCompetencies';
import type { GarageHotspot, GarageStage, LevelConfig, ScenarioEvent } from './scenarioDefinition';
import type { SlotVariant } from './pooling';
import { fitsTheRoad, isPortableRemediation, remediationCandidates } from './remediationPool';
import { declaredLineSpans } from './roadLine';
import { stageContent, type StageContent } from './stageContent';
import { withOnePlate } from './garagePlate';
import { cutsFor, safeCuts, withCuts } from './compactRoad';
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';
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
    .filter(variant => variant.competency === competency && isPortableRemediation(variant) && fitsTheRoad(variant, content.base))
    .forEach(variant => own.push({ kind: 'append', variant, sourceLevelId: content.levelId, own: true }));

  // Taught in an earlier stage: portable variants only, from the levels'
  // slots and the scenarios written for earlier stages.
  const borrowed: Candidate[] = [
    ...remediationCandidates(competency, content.levelId - 1)
      .filter(({ variant }) => fitsTheRoad(variant, content.base))
      .map(({ levelId, variant }): Candidate => ({
      kind: 'append', variant, sourceLevelId: levelId, own: false,
    })),
    ...extrasBefore(content.levelId)
      .filter(({ variant }) => variant.competency === competency && isPortableRemediation(variant) && fitsTheRoad(variant, content.base))
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

/** The least gap between two scenarios added after the stage's own road. */
const MIN_APPEND_SPACING = 700;

/**
 * How far past its own point a scenario may still be graded: a prohibition
 * ("do not stop here") is graded to the end of its stretch, and the drives
 * that measure the time limits settle those up to about 320 road units past
 * the point. Measured, not derived (2026-11-16).
 */
const SETTLE_REACH = 340;
/** A stop is graded at or before its point; anything else may run on to `SETTLE_REACH`. */
const settleReach = (event: Pick<ScenarioEvent, 'correctAction'>): number => (event.correctAction === 'stop' ? 0 : SETTLE_REACH);
/**
 * Clear road between one verdict and the next announcement: about three
 * seconds at a stage's cruising speed, the time a verdict stays on screen.
 * Without it an appended scenario could be announced in the same moment the
 * last one was graded, two cards at once (2026-11-16).
 */
const CLEAR_ROAD = 240;
/** The speed `CLEAR_ROAD` was measured at, in km/h. */
const CLEAR_ROAD_SPEED = 30;

/**
 * Appends portable scenarios after the authored road's last slot, at the
 * stage's own spacing, with the authored run-out kept behind the last one. The
 * road grows; every authored slot keeps its distance, geometry and paint. A
 * line a scenario is graded on comes with it, as practice items always did.
 *
 * Each one stands far enough past the one before for that one to be graded and
 * its verdict read before this one is announced: the stage's spacing, or more
 * where a long announcement or a late verdict needs it.
 */
const placeAppended = (level: LevelConfig, content: StageContent, variants: SlotVariant[]): LevelConfig => {
  if (variants.length === 0) return level;
  const lastAuthored = Math.max(...content.distances);
  const runway = Math.max(content.base.roadLength - lastAuthored, 0);
  // The road's last scenario, wherever closing the road up has moved it.
  let previous: Pick<ScenarioEvent, 'triggerAtDistance' | 'correctAction'> =
    level.events.length > 0
      ? level.events.reduce((last, event) => (event.triggerAtDistance >= last.triggerAtDistance ? event : last))
      : { triggerAtDistance: lastAuthored, correctAction: 'stop' };
  // Clear road is time on screen, so it grows with the road's speed.
  const clearRoad = CLEAR_ROAD * Math.max(1, level.speedLimit / CLEAR_ROAD_SPEED);
  const placed: ScenarioEvent[] = variants.map(variant => {
    const announced = variant.warningDistance ?? WARNING_ZONE_ENTER;
    const clear = settleReach(previous) + clearRoad + announced;
    const triggerAtDistance = previous.triggerAtDistance + Math.max(MIN_APPEND_SPACING, clear);
    const event = { ...variant, triggerAtDistance };
    previous = event;
    return event;
  });
  return {
    ...level,
    events: [...level.events, ...placed],
    roadLength: previous.triggerAtDistance + runway,
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
  authored && hotspots.length > 0 ? withOnePlate({ ...authored, hotspots }) : undefined;

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
  const structuralSlots = structuralSlotsOf(content);

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

  const { level, structural } = assembleDrive(content, slotTaken, pointTaken, appended, structuralSlots);
  return { level, items, structural, shortfall };
};

/**
 * The road for the chosen scenarios: each slot's choice at its distance, the
 * points chosen at the garage and the crash scene, portable scenarios appended
 * after the authored road. Unchosen route-bound slots keep their first variant,
 * as the static level has it.
 */
const assembleDrive = (
  content: StageContent,
  slotTaken: Map<number, SlotVariant>,
  pointTaken: { garage: Map<number, GarageHotspot>; aftermath: Map<number, GarageHotspot> },
  appended: SlotVariant[],
  structuralSlots: ReadonlySet<number>
): { level: LevelConfig; structural: string[] } => {
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
  // The drive is decided now, so its road is cut to fit it: no empty stretch
  // where a slot this drive does not use would have stood.
  const used = new Set(slotTaken.keys());
  const fitted = withCuts(placed, safeCuts(placed, cutsFor(content.distances, used)));
  const road: LevelConfig = {
    ...fitted,
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
  return { level, structural };
};

/** Route-bound slots: they shape the road itself, so they stay whatever is chosen. */
const structuralSlotsOf = (content: StageContent): Set<number> => {
  const slots = new Set<number>();
  content.slots.forEach((pool, slot) => {
    if (pool.some(variant => variant.scene === 'route')) slots.add(slot);
  });
  return slots;
};

/**
 * One scenario on its stage's road, alone (Admin > Scenarios > Play,
 * 2026-11-16): at its own slot, its own garage or crash-scene point, or
 * appended after the road as a course drive would place it. Route-bound slots
 * stay, because they shape the road. Null when the stage cannot place it.
 */
export const composeSingleScenario = (levelId: number, scenarioId: string): { level: LevelConfig; placement: Placement } | null => {
  const content = stageContent(levelId);
  if (!content) return null;
  const slotTaken = new Map<number, SlotVariant>();
  const pointTaken = { garage: new Map<number, GarageHotspot>(), aftermath: new Map<number, GarageHotspot>() };
  const appended: SlotVariant[] = [];
  let placement = null as Placement | null;

  content.slots.forEach((pool, slot) => {
    const variant = pool.find(v => v.id === scenarioId);
    if (variant && !placement) {
      slotTaken.set(slot, variant);
      placement = 'slot';
    }
  });
  for (const scene of ['garage', 'aftermath'] as const) {
    content[scene].forEach((point, index) => {
      const hotspot = point.variants.find(h => (h.scenarioId ?? h.id) === scenarioId);
      if (hotspot && !placement) {
        pointTaken[scene].set(index, hotspot);
        placement = scene;
      }
    });
  }
  if (!placement) {
    for (const competency of COMPETENCIES) {
      const candidate = candidatesFor(content, competency).find(c => candidateId(c) === scenarioId);
      if (candidate && candidate.kind === 'append') {
        appended.push(candidate.variant);
        placement = 'appended';
        break;
      }
    }
  }
  if (!placement) return null;
  return { level: assembleDrive(content, slotTaken, pointTaken, appended, structuralSlotsOf(content)).level, placement };
};

/** The scenario ids of one composed drive, per competency: what the verdict is read over. */
export const itemsByCompetency = (drive: Pick<ComposedDrive, 'items'>): Map<DrivingCompetency, string[]> => {
  const out = new Map<DrivingCompetency, string[]>();
  for (const item of drive.items) out.set(item.competency, [...(out.get(item.competency) ?? []), item.scenarioId]);
  return out;
};

/** One scenario a stage can draw for a competency, as the pool report lists it. */
export interface PoolEntry {
  scenarioId: string;
  /** Own slot k, garage or crash-scene point, written for the stage, or borrowed from an earlier stage. */
  source: 'slot' | 'garage' | 'aftermath' | 'stage_extra' | 'borrowed';
  slot: number | null;
  sourceLevelId: number;
  /** Can be appended after the authored road. */
  portable: boolean;
  scenario: SlotVariant | GarageHotspot;
}

/** Every scenario a stage's drive can draw for a competency, own content first. For reports. */
export const poolFor = (levelId: number, competency: DrivingCompetency): PoolEntry[] => {
  const content = stageContent(levelId);
  if (!content) return [];
  const seen = new Set<string>();
  return candidatesFor(content, competency)
    .map((candidate): PoolEntry => ({
      scenarioId: candidateId(candidate),
      source:
        candidate.kind === 'slot' ? 'slot'
        : candidate.kind === 'point' ? candidate.scene
        : candidate.own ? 'stage_extra' : 'borrowed',
      slot: candidate.kind === 'slot' ? candidate.slot : candidate.kind === 'point' ? candidate.point : null,
      sourceLevelId: candidate.kind === 'append' ? candidate.sourceLevelId : levelId,
      portable: candidate.kind !== 'point' && isPortableRemediation(candidate.variant),
      scenario: candidate.kind === 'point' ? candidate.hotspot : candidate.variant,
    }))
    .filter(entry => (seen.has(entry.scenarioId) ? false : (seen.add(entry.scenarioId), true)));
};
