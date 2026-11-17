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
import { inPlay, type SlotVariant } from './pooling';
import { isPortableRemediation, remediationCandidates } from './remediationPool';
import { declaredLineSpans } from './roadLine';
import { stretchLevel } from './stretchLevel';
import { hotspotScenarioId } from './hotspotScenarioId';
import { stageContent, type StageContent } from './stageContent';
import { STAGE_EXTRAS, extrasBefore } from './content/levels/stageExtras';
import { stageContent as roadOf } from './stageContent';
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';

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
  candidate.kind === 'point' ? hotspotScenarioId(candidate.hotspot) : candidate.variant.id;

const shuffle = <T>(items: T[], rng: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** A scenario that cannot be graded wrong gives no evidence, so it is never counted. */
const countable = (variant: { neutral?: boolean; offRoad?: true }) => !variant.neutral && !variant.offRoad;

/**
 * Whether a scenario borrowed from `sourceLevelId` fits the road it would be
 * placed on, by declared fields alone:
 * - the same kind of road: an expressway borrows only from an expressway, a
 *   surface street (city or through street) only from surface streets. A
 *   city scenario's junction, crossing or curb has no place on an expressway,
 *   and grading it there teaches a rule the road cannot stage;
 * - a speed sign that posts a minimum or a limit above the destination's own
 *   legal limit (Republic Act No. 4136, Section 35) does not fit: it could not be obeyed there.
 */
const isExpressway = (level: LevelConfig): boolean => level.roadClass === 'expressway';
export const fitsRoad = (variant: SlotVariant, sourceLevelId: number, destination: LevelConfig): boolean => {
  const source = roadOf(sourceLevelId)?.base;
  if (!source) return false;
  if (isExpressway(source) !== isExpressway(destination)) return false;
  if (typeof variant.postedSpeed === 'number' && variant.postedSpeed > destination.speedLimit) return false;
  return true;
};

/** From this stage on, a pool borrows from any other stage, not only earlier ones. */
const ANY_LEVEL_BORROWING_FROM = 6;
/** The last stage a scenario may be borrowed from: Level 12 is the final exam, not a stage. */
const LAST_BORROWABLE_STAGE = 11;

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
  // A stage that places its extras on its own road (`stretchAt`) keeps one
  // that could not travel: it never leaves the road it was written for.
  (STAGE_EXTRAS[content.levelId] ?? [])
    .filter(variant => variant.competency === competency && (content.stretchAt !== undefined || isPortableRemediation(variant)))
    .forEach(variant => own.push({ kind: 'append', variant, sourceLevelId: content.levelId, own: true }));

  // Borrowed: portable variants of this competency from the levels' slots and
  // the scenarios written for other stages. Stages 1-5 borrow from earlier
  // stages only. From Level 6 on, a stage borrows from any other stage, earlier
  // or later (2026-11-16, future work): the competency is one this stage
  // teaches, so its module covers the rule, and the id still names the level
  // the scenario was written for.
  const borrowsFromAny = content.levelId >= ANY_LEVEL_BORROWING_FROM;
  const lastSource = borrowsFromAny ? LAST_BORROWABLE_STAGE : content.levelId - 1;
  const borrowed: Candidate[] = [
    ...remediationCandidates(competency, lastSource)
      .filter(({ levelId }) => levelId !== content.levelId)
      .map(({ levelId, variant }): Candidate => ({ kind: 'append', variant, sourceLevelId: levelId, own: false })),
    ...extrasBefore(lastSource + 1)
      .filter(({ levelId }) => levelId !== content.levelId)
      .filter(({ variant }) => variant.competency === competency && isPortableRemediation(variant))
      .map(({ levelId, variant }): Candidate => ({ kind: 'append', variant, sourceLevelId: levelId, own: false })),
  ];
  return [...own, ...borrowed.filter(c => c.kind === 'append' && fitsRoad(c.variant, c.sourceLevelId, content.base))];
};

/**
 * Unseen own content, then unseen borrowed content, then the least recently
 * seen of anything: three tiers, drawn in order. Within a tier the order is
 * random, so a retake is not a password.
 */
const tiered = (
  candidates: Candidate[],
  seen: ReadonlyMap<string, number>,
  rng: () => number,
  mixUnseen = false
): Candidate[][] => {
  if (mixUnseen) {
    const unseen = shuffle(candidates.filter(c => !seen.has(candidateId(c))), rng);
    const seenAny = shuffle(candidates.filter(c => seen.has(candidateId(c))), rng).sort(
      (a, b) => seen.get(candidateId(a))! - seen.get(candidateId(b))!
    );
    return [unseen, seenAny];
  }
  const unseenOwn = shuffle(candidates.filter(c => c.own && !seen.has(candidateId(c))), rng);
  const unseenBorrowed = shuffle(candidates.filter(c => !c.own && !seen.has(candidateId(c))), rng);
  const seenAny = shuffle(candidates.filter(c => seen.has(candidateId(c))), rng).sort(
    (a, b) => seen.get(candidateId(a))! - seen.get(candidateId(b))!
  );
  return [unseenOwn, unseenBorrowed, seenAny];
};

/**
 * The gap appended scenarios are placed at: one fixed gap, just over the
 * closest two authored scenarios on any level (590 units, Level 1), so the
 * extras follow each other as closely as authored ones already do. A stage's
 * own median gap reached 1,710 units (Level 7) and left long empty road
 * between them.
 */
const APPEND_SPACING = 600;

/**
 * A scenario that leaves something on the road once it is passed: a
 * rockfall's rocks, an animal crossing, a crash scene's wreck, or a main road's
 * crossing traffic, which keeps moving on its clock. The scenario after one
 * gets a double gap, room to steer back or for the traffic to clear before its
 * own approach opens, and none is lent to a road slot, whose gap is the
 * authored one.
 */
const leavesSolids = (variant: SlotVariant): boolean =>
  variant.scene === 'rockfall' ||
  variant.scene === 'animal' ||
  variant.scenePrefab?.kind === 'road_crash' ||
  variant.scenePrefab?.kind === 'main_road_junction';

/**
 * Appends portable scenarios after the authored road's last slot, at the
 * stage's own spacing, with the authored run-out kept behind the last one. The
 * road grows; every authored slot keeps its distance, geometry and paint. A
 * line a scenario is graded on comes with it, as practice items always did.
 */
const placeAppended = (level: LevelConfig, content: StageContent, variants: SlotVariant[]): LevelConfig => {
  if (variants.length === 0) return level;
  // A stage with no authored road (Level 2, the garage alone) appends from 0.
  const lastAuthored = Math.max(0, ...content.distances);
  const runway = Math.max(content.base.roadLength - lastAuthored, 0);
  const spacing = APPEND_SPACING;
  // After a scenario that leaves solids in the lane, a double gap.
  let at = lastAuthored;
  const placed: ScenarioEvent[] = variants.map((variant, index) => {
    at += index > 0 && leavesSolids(variants[index - 1]) ? 2 * spacing : spacing;
    return { ...variant, triggerAtDistance: at };
  });
  return {
    ...level,
    events: [...level.events, ...placed],
    roadLength: at + runway,
    ...(level.paint ? { paint: { ...level.paint, spans: [...level.paint.spans, ...declaredLineSpans(placed)] } } : {}),
  };
};

/**
 * Places scenarios on road inserted at `at`, at the appended spacing: the
 * first one spacing past `at`, and the road beyond moved on by their total, so
 * what followed `at` keeps its own distance to the last of them.
 */
const placeInStretch = (level: LevelConfig, at: number, variants: SlotVariant[]): LevelConfig => {
  if (variants.length === 0) return level;
  let offset = 0;
  const placed: ScenarioEvent[] = variants.map((variant, index) => {
    offset += index > 0 && leavesSolids(variants[index - 1]) ? 2 * APPEND_SPACING : APPEND_SPACING;
    return { ...variant, triggerAtDistance: at + offset };
  });
  const stretched = stretchLevel(level, at, offset);
  return {
    ...stretched,
    events: [...stretched.events, ...placed].sort((a, b) => a.triggerAtDistance - b.triggerAtDistance),
    ...(stretched.paint ? { paint: { ...stretched.paint, spans: [...stretched.paint.spans, ...declaredLineSpans(placed)] } } : {}),
  };
};

/** The level's pass mark, rescaled to the points actually on this drive (display only). */
// Kept for the results screen only: under the per-competency design the
// verdict is per competency (2 of 3), and this total decides nothing. Stars
// count mistakes (domain/learner/stars).
const rescaleThresholds = (events: ScenarioEvent[], points: GarageHotspot[]): Partial<LevelConfig> => {
  const total = events.reduce((sum, event) => sum + event.points, 0) + points.reduce((sum, point) => sum + point.points, 0);
  return {
    requiredScore: Math.round(total * 0.7),
  };
};

const stageScene = (authored: GarageStage | undefined, hotspots: GarageHotspot[]): GarageStage | undefined =>
  authored && hotspots.length > 0 ? { ...authored, hotspots } : undefined;

/**
 * Where a borrowed or stage-extra scenario may stand in a road slot rather
 * than after the road (2026-11-17, future work). Level 7's slots are the
 * expressway itself, and Level 12 is the final exam: both keep their own.
 */
const lendsSlots = (levelId: number): boolean => levelId !== 7 && levelId !== 12;

const leadOf = (variant: { warningDistance?: number }): number => variant.warningDistance ?? WARNING_ZONE_ENTER;
const forbidsStopping = (variant: SlotVariant): boolean => Boolean(variant.avoid?.includes('stop'));

/**
 * A slot open to a scenario that was not written for it: nothing about its road
 * is built around its own scenario. It is not a route slot, every one of its
 * own versions could stand on any road (portable, so one displaced from it is
 * appended instead), none is a bend, and none brings a vehicle that drives
 * with the car (one it follows, or one closing from behind). Those play out
 * over the gap their own road gives them: appended at the shorter appended
 * spacing, the reference driver met the next scenario before the last had
 * cleared. The level also does not paint a line authored for the slot. A level
 * that paints from its roll (4, 8 and 12) repaints for whatever stands there.
 */
const drivesWithTheCar = (variant: SlotVariant): boolean =>
  Boolean(variant.rear) || variant.npc?.path === 'travelling_ahead';

const isOpenSlot = (content: StageContent, slot: number, structural: ReadonlySet<number>): boolean => {
  if (structural.has(slot)) return false;
  const own = inPlay(content.slots[slot]).filter(countable);
  if (
    own.length === 0 ||
    own.some(variant => !isPortableRemediation(variant) || variant.effect?.curve || drivesWithTheCar(variant))
  ) {
    return false;
  }
  if (content.assemble) return true;
  const at = content.distances[slot];
  return !(content.base.paint?.spans ?? []).some(span => span.from <= at && at <= span.to);
};

/**
 * Whether a scenario fits a slot's spacing as well as the slot's own versions
 * do. Its approach is no longer than theirs, so the room behind the slot that
 * holds them holds it. Its zone is no wider than theirs, so the slot after it
 * keeps its room: no checkpoint unless one stands there already, and no wider
 * no-stopping stretch. A scenario that leaves solids in the lane stays
 * appended, where the scenario after it gets a double gap.
 */
const admits = (content: StageContent, slot: number, variant: SlotVariant): boolean => {
  const own = inPlay(content.slots[slot]).filter(countable);
  if (own.length === 0 || leavesSolids(variant)) return false;
  if (leadOf(variant) > Math.min(...own.map(leadOf))) return false;
  if (variant.inspection && !own.some(entry => entry.inspection)) return false;
  if (forbidsStopping(variant)) {
    const ownStops = own.filter(forbidsStopping);
    if (ownStops.length === 0) return false;
    if ((variant.noStandingWithin ?? 0) > Math.max(...ownStops.map(entry => entry.noStandingWithin ?? 0))) return false;
  }
  return true;
};

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
      return { competency, size: all.length, tiers: tiered(all, seen, rng, lendsSlots(levelId)) };
    })
    .sort((a, b) => a.size - b.size);

  const openSlots = lendsSlots(levelId)
    ? content.slots.map((_, slot) => slot).filter(slot => isOpenSlot(content, slot, structuralSlots))
    : [];
  const lentSlots = (candidate: Candidate): number[] =>
    candidate.kind === 'append'
      ? openSlots.filter(slot => !slotTaken.has(slot) && admits(content, slot, candidate.variant))
      : [];

  /** Whether a candidate can stand on the authored road right now: its own free slot or point. */
  const fitsInPlace = (candidate: Candidate): boolean =>
    candidate.kind === 'point'
      ? !pointTaken[candidate.scene].has(candidate.point)
      : candidate.kind === 'slot' && !slotTaken.has(candidate.slot);

  /** Whether a borrowed or stage-extra candidate has a free slot that admits it. */
  const fitsALentSlot = (candidate: Candidate): boolean => lentSlots(candidate).length > 0;

  const canAppend = (candidate: Candidate): boolean =>
    candidate.kind !== 'point' &&
    (isPortableRemediation(candidate.variant) || (content.stretchAt !== undefined && candidate.kind === 'append' && candidate.own));

  const take = (competency: DrivingCompetency, candidate: Candidate) => {
    const id = candidateId(candidate);
    // A borrowed or stage-extra scenario stands in a free slot that admits it,
    // drawn by the seed, and is appended only where none does.
    const lendable = lentSlots(candidate);
    if (lendable.length > 0 && candidate.kind === 'append') {
      const slot = lendable[Math.floor(rng() * lendable.length)];
      slotTaken.set(slot, candidate.variant);
      items.push({ competency, scenarioId: id, placement: 'slot', sourceLevelId: candidate.sourceLevelId });
    } else if (candidate.kind === 'point') {
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

  // First, every competency's unseen own scenarios take the slots and points
  // that are theirs alone (a slot whose road is built around its own scenario,
  // a garage or crash-scene point), so nothing borrowed ever stands where an
  // own scenario had to.
  const ownsItsPlace = (candidate: Candidate): boolean =>
    candidate.own &&
    !seen.has(candidateId(candidate)) &&
    fitsInPlace(candidate) &&
    !(candidate.kind === 'slot' && openSlots.includes(candidate.slot));
  const counts = new Map<DrivingCompetency, number>();
  for (const { competency, tiers } of pools) {
    let count = 0;
    while (count < perCompetency) {
      const next = tiers[0].find(candidate => !chosenIds.has(candidateId(candidate)) && ownsItsPlace(candidate));
      if (!next) break;
      take(competency, next);
      count += 1;
    }
    counts.set(competency, count);
  }

  for (const { competency, tiers } of pools) {
    let count = counts.get(competency) ?? 0;
    // Tier by tier. Within a tier, whatever fits the road first: its own free
    // slot or point, then a free slot that admits it. Re-checked after every
    // pick, so the authored road is used before anything is appended to it.
    for (const tier of tiers) {
      while (count < perCompetency) {
        const open = tier.filter(candidate => !chosenIds.has(candidateId(candidate)));
        const next = open.find(fitsInPlace) ?? open.find(fitsALentSlot) ?? open.find(canAppend);
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

/** Route-bound slots: they shape the road itself, so they stay whatever is chosen. */
const structuralSlotsOf = (content: StageContent): Set<number> => {
  const slots = new Set<number>();
  content.slots.forEach((pool, slot) => {
    if (pool.some(variant => variant.scene === 'route')) slots.add(slot);
  });
  return slots;
};

/**
 * The road for the chosen scenarios: each slot's choice at its distance, the
 * points chosen at the garage and the crash scene, portable scenarios appended
 * after the authored road. Unchosen route-bound slots keep their first
 * variant, as the static level has it.
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
  const road: LevelConfig = {
    ...placed,
    garage: stageScene(authored.garage, garageHotspots),
    aftermath: stageScene(authored.aftermath, aftermathHotspots),
  };
  const withAppended = content.stretchAt !== undefined ? placeInStretch(road, content.stretchAt, appended) : placeAppended(road, content, appended);
  const level: LevelConfig = {
    ...withAppended,
    ...rescaleThresholds(withAppended.events, [...garageHotspots, ...aftermathHotspots]),
  };
  if (!level.garage) delete level.garage;
  if (!level.aftermath) delete level.aftermath;
  return { level, structural };
};

/**
 * One scenario on its stage's road, alone, for the admin's scenario check
 * (Admin > Scenarios > Play, ported from the groupmate's repository): at its
 * own slot, its own garage or crash-scene point, or appended after the road
 * as a course drive would place it. Route-bound slots stay, because they
 * shape the road. Null when the stage cannot place it. Nothing calls it in a
 * course drive.
 */
export const composeSingleScenario = (levelId: number, scenarioId: string): { level: LevelConfig; placement: Placement } | null => {
  const content = stageContent(levelId);
  if (!content) return null;
  const slotTaken = new Map<number, SlotVariant>();
  const pointTaken = { garage: new Map<number, GarageHotspot>(), aftermath: new Map<number, GarageHotspot>() };
  const appended: SlotVariant[] = [];
  let placement: Placement | null = null;

  content.slots.forEach((pool, slot) => {
    const variant = pool.find(v => v.id === scenarioId);
    if (variant && !placement) {
      slotTaken.set(slot, variant);
      placement = 'slot';
    }
  });
  for (const scene of ['garage', 'aftermath'] as const) {
    content[scene].forEach((point, index) => {
      const hotspot = point.variants.find(h => hotspotScenarioId(h) === scenarioId);
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
