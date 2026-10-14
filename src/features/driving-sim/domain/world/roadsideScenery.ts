/**
 * The trees, poles, barriers and lamp posts along the verge.
 *
 * World data, not decoration the renderer invents: it is generated once per
 * stretch of road and regenerated when a turn puts the driver on a different
 * street, which is what makes that hand-off read as arriving somewhere else
 * rather than as the world jumping sideways.
 *
 * Every object is placed at a point of the *route*, so the roadside enters and
 * leaves the corridor as the road does. That is what lets one route run from an
 * expressway entrance to a toll plaza without the scenery ever teleporting: the
 * theme changes at a distance, and the objects on either side of it were always
 * going to arrive when the car reached them.
 */
import type { RouteLayout } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { roadsideAt } from './routeGeometry';

export interface EnvObject {
  /** Offset across the verge, for the objects that are scattered along it. */
  x: number;
  /** Point of the route this object stands at. */
  y: number;
  type:
    | 'tree'
    | 'pole'
    | 'building'
    /** A run of crash barrier along the verge. */
    | 'guardrail'
    /** An expressway lighting column. */
    | 'lamp'
    /** A segment of the concrete barrier down the middle of a divided road. */
    | 'median-barrier'
    /** A low house or shopfront built tight to a barangay street. */
    | 'house'
    /** A shop awning over the footpath, angled out from a frontage. */
    | 'awning'
    /** The roofed multi-purpose court every barangay has one of. */
    | 'court'
    /** A run of low seawall between a road and the water beside it. */
    | 'seawall'
    /** The water itself, beyond the wall. */
    | 'water'
    /** A broad street tree, the kind planted along a riverside road. */
    | 'acacia';
  side: 'left' | 'right';
}

const KINDS = ['tree', 'pole', 'building'] as const;

/** One roadside object every this many route units. */
const SPACING = 80;

/**
 * The ordinary street: one object per slot, placed at random along and across
 * the verge.
 *
 * Draws exactly four random numbers per slot, in this order, because every
 * level that declares no roadside generates its verge through this path and a
 * different draw order would be a different world.
 */
const mixedSlot = (index: number, random: () => number): EnvObject => ({
  x: random() * 40 + 10,
  y: index * SPACING + random() * 40,
  type: KINDS[Math.floor(random() * KINDS.length)],
  side: random() > 0.5 ? ('left' as const) : ('right' as const),
});

/**
 * A limited-access facility: a continuous barrier down the median, crash
 * barrier along the outer verge, and lighting columns at regular intervals.
 *
 * Deliberately not random. A median barrier with gaps in it is not a median
 * barrier, and lamp posts at random intervals read as scattered poles — the
 * regularity is the thing that says "expressway" before any sign does.
 */
const expresswaySlot = (index: number, lampEvery: number): EnvObject[] => {
  const y = index * SPACING;
  const objects: EnvObject[] = [
    { x: 0, y, type: 'median-barrier', side: 'left' },
    { x: 0, y, type: 'guardrail', side: 'right' },
  ];
  if (index % lampEvery === 0) {
    objects.push({ x: 0, y, type: 'lamp', side: index % (lampEvery * 2) === 0 ? 'right' : 'left' });
  }
  return objects;
};

/**
 * A residential barangay street: frontage built almost to the curb, awnings
 * over the footpath, and the covered court that every one of them has.
 *
 * Denser than `mixed` and regular rather than scattered, because the thing the
 * verge has to say here is "people live along this road" — a few random trees
 * says the opposite. Draws exactly three random numbers per slot, in this
 * order, so the street is the same street on every run of a seeded drive.
 */
const barangaySlot = (index: number, random: () => number): EnvObject[] => {
  const y = index * SPACING;
  const side = random() > 0.5 ? ('left' as const) : ('right' as const);
  const objects: EnvObject[] = [
    { x: random() * 8, y, type: 'house', side },
    { x: random() * 8, y: y + SPACING / 2, type: 'house', side: side === 'left' ? 'right' : 'left' },
  ];
  // An awning every third frontage, and the court once every eighth slot.
  if (index % 3 === 0) objects.push({ x: 0, y: y + 20, type: 'awning', side });
  if (index % 8 === 4) objects.push({ x: 4, y, type: 'court', side: side === 'left' ? 'right' : 'left' });
  return objects;
};

/**
 * A road with water along one side: a continuous low seawall on the right, the
 * river beyond it, and acacias on the left.
 *
 * Deliberately unbroken, for the reason the expressway's barrier is: a seawall
 * with gaps in it is not a seawall, and the continuity is what makes a bend in
 * this road read as a bend along the water rather than as more street.
 */
const riversideSlot = (index: number): EnvObject[] => {
  const y = index * SPACING;
  const objects: EnvObject[] = [
    { x: 0, y, type: 'water', side: 'right' },
    { x: 0, y, type: 'seawall', side: 'right' },
  ];
  if (index % 2 === 0) objects.push({ x: 6, y: y + 30, type: 'acacia', side: 'left' });
  return objects;
};

/**
 * Every object standing beside a route.
 *
 * With no declared route this is the ordinary street it has always been,
 * generated exactly as before — which is what keeps every level that says
 * nothing about its road looking precisely as it did.
 */
export const generateEnvObjects = (
  roadLength: number,
  random: () => number = Math.random,
  route?: RouteLayout
): EnvObject[] => {
  const slots = Math.floor(roadLength / SPACING);
  if (!route) return Array.from({ length: slots }, (_, i) => mixedSlot(i, random));

  const objects: EnvObject[] = [];
  for (let i = 0; i < slots; i++) {
    switch (roadsideAt(i * SPACING, route)) {
      case 'mixed':
        objects.push(mixedSlot(i, random));
        break;
      case 'expressway':
        objects.push(...expresswaySlot(i, 3));
        break;
      case 'toll_approach':
        // Lit twice as often on the run-in, which is what a plaza approach is.
        objects.push(...expresswaySlot(i, 2));
        break;
      case 'barangay':
        objects.push(...barangaySlot(i, random));
        break;
      case 'riverside':
        objects.push(...riversideSlot(i));
        break;
    }
  }
  return objects;
};
