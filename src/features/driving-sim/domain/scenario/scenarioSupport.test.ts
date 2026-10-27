/**
 * The support level changes what a scenario shows, and only that.
 *
 * `full` is the briefing as it always was. `cue` swaps the move for where to
 * look, and `none` leaves the situation alone - which is what makes a correct
 * answer at `none` evidence of knowing the rule rather than of following an
 * instruction.
 *
 * The cue is held to the same rule as the scene: it is read from declared data,
 * so rewriting every sentence and every asset name in the game must not move
 * it, and it must never say what to do.
 */
import { describe, expect, it } from 'vitest';
import type { SupportLevel } from '@/domain/learner/competency';
import type { SlotVariant } from './pooling';
import type { ScenarioEvent } from './scenarioDefinition';
import { scenarioInstruction, scenarioLabel } from './scenarioCopy';
import { scenarioSupport, supportCue } from './scenarioSupport';
import { SLOTS as level0 } from './content/levels/level0';
import { SLOTS as level1 } from './content/levels/level1';
import { SLOTS as level2 } from './content/levels/level2';
import { SLOTS as level3 } from './content/levels/level3/pools';
import { SLOTS as level4 } from './content/levels/level4/pools';
import { SLOTS as level5 } from './content/levels/level5';
import { SLOTS as level6 } from './content/levels/level6';
import { SLOTS as level7 } from './content/levels/level7';
import { SLOTS as level8 } from './content/levels/level8';
import { SLOTS as level9 } from './content/levels/level9';
import { SLOTS as level10 } from './content/levels/level10';
import { SLOTS as level11 } from './content/levels/level11';
import { SLOTS as level12 } from './content/levels/level12';

const LEVEL_SLOTS: SlotVariant[][][] = [
  level0, level1, level2, level3, level4, level5, level6,
  level7, level8, level9, level10, level11, level12,
];

/**
 * Every authored scenario answered with the car - the ones h governs. Not the
 * tutorial, whose instructor panel is its whole content, and not the questions
 * a checkpoint, cutscene or parking decision asks behind a screen of its own.
 */
const answeredByDriving = (): Array<{ levelId: number; event: ScenarioEvent }> => {
  const rows: Array<{ levelId: number; event: ScenarioEvent }> = [];
  LEVEL_SLOTS.forEach((slots, levelId) => {
    if (levelId === 0) return;
    const seen = new Set<string>();
    for (const variant of slots.flat()) {
      if (seen.has(variant.id)) continue;
      seen.add(variant.id);
      const event = { ...variant, triggerAtDistance: 0 } as ScenarioEvent;
      if (event.inspection || event.cutscene || event.parkingCutscene) continue;
      rows.push({ levelId, event });
    }
  });
  return rows;
};

const LEVELS: SupportLevel[] = ['full', 'cue', 'none'];

const stopSign = answeredByDriving().find(row => row.event.id === 'level3.priority-stop.stop-sign')!.event;
const annotated: ScenarioEvent = {
  ...stopSign,
  realWorldNote: 'Also check your mirrors.',
  lawCitation: 'RA 4136, Sec. 42.',
};

describe('what each support level shows', () => {
  it('shows the situation and its sign at every level', () => {
    for (const support of LEVELS) {
      const shown = scenarioSupport(annotated, support);
      expect(shown.situation).toBe(annotated.description);
      expect(shown.sign).toBe(annotated.sign);
    }
  });

  it('gives the move, the note, the rule and the response markers at full only', () => {
    const full = scenarioSupport(annotated, 'full');
    expect(full.instruction).toBe(scenarioInstruction(annotated));
    expect(full.realWorldNote).toBe('Also check your mirrors.');
    expect(full.lawCitation).toBe('RA 4136, Sec. 42.');
    expect(full.showsResponse).toBe(true);
    expect(full.cue).toBeNull();

    for (const support of ['cue', 'none'] as const) {
      const shown = scenarioSupport(annotated, support);
      expect(shown.instruction, support).toBeNull();
      expect(shown.realWorldNote, support).toBeNull();
      expect(shown.lawCitation, support).toBeNull();
      expect(shown.showsResponse, support).toBe(false);
    }
  });

  it('gives where to look at cue only', () => {
    expect(scenarioSupport(annotated, 'cue').cue).toBe(supportCue(annotated));
    expect(scenarioSupport(annotated, 'cue').cue).not.toBeNull();
    expect(scenarioSupport(annotated, 'none').cue).toBeNull();
  });
});

describe('the cue', () => {
  it('reads like this for each kind of scenario', () => {
    const cueOf = (id: string) => supportCue(answeredByDriving().find(row => row.event.id === id)!.event);
    expect(cueOf('level3.bend-warning.sharp-turn')).toBe(
      'Watch the sign (Warning Sign — Horizontal). Check which lane you are in.'
    );
    expect(cueOf('level3.signal.red')).toBe('Watch the traffic light.');
    expect(cueOf('level4.longitudinal.double-solid-yellow')).toBe(
      'Watch the marking on the road (Longitudinal Line — Barrier Line). Check which lane you are in.'
    );
    expect(cueOf('level5.uncontrolled-crossroads.car-from-right')).toBe('Watch the car coming from your right.');
    expect(cueOf('level5.crossing-yield.elderly')).toBe('Watch the elderly pedestrian.');
    expect(cueOf('level7.following-distance-lead-van')).toBe(
      'Watch the van ahead of you. Check the gap to the vehicle ahead.'
    );
    expect(cueOf('level8.hold-your-line')).toBe(
      'Watch the motorcycle coming up beside you. Check your position in the lane.'
    );
    expect(cueOf('level2.drive-out.neighbour')).toBe('Watch the footpath across the driveway.');
    expect(cueOf('level6.hydrant-at-the-curb')).toBe('Watch the fire hydrant.');
    expect(cueOf('level6.tow-away-zone')).toBe('Watch the sign (Regulatory Sign — Parking And Stopping).');
  });

  it('never says what to do', () => {
    const RESPONSE =
      /\b(stop|brake|slow|accelerate|speed up|turn|honk|yield|give way|overtake|pull|move|keep|stay|hold|ease|let|wait)\b/i;
    for (const { event } of answeredByDriving()) {
      const cue = supportCue(event);
      if (!cue) continue;
      expect(cue, event.id).not.toMatch(RESPONSE);
      expect(cue, event.id).not.toContain(scenarioInstruction(event));
    }
  });

  it('is read from declared data: rewriting every sentence and asset name moves no cue', () => {
    const rewrite = (event: ScenarioEvent): ScenarioEvent => ({
      ...event,
      description: 'REWRITTEN',
      label: 'REWRITTEN',
      recommendedMove: 'REWRITTEN',
      realWorldNote: 'REWRITTEN',
      lawCitation: 'REWRITTEN',
      penaltyMessage: 'REWRITTEN',
      rewardMessage: 'REWRITTEN',
      ...(event.sign ? { sign: { ...event.sign, name: 'REWRITTEN', meaning: 'REWRITTEN', image: 'x/renamed.png' } } : {}),
      ...(event.marking ? { marking: { ...event.marking, name: 'REWRITTEN', meaning: 'REWRITTEN', image: 'x/renamed.png' } } : {}),
      ...(event.requiredLane ? { requiredLane: { ...event.requiredLane, hint: 'REWRITTEN' } } : {}),
      ...(event.maneuver ? { maneuver: { ...event.maneuver, hint: 'REWRITTEN' } } : {}),
      ...(event.bay ? { bay: { ...event.bay, hint: 'REWRITTEN' } } : {}),
      ...(event.coast ? { coast: { ...event.coast, hint: 'REWRITTEN' } } : {}),
    });
    for (const { event } of answeredByDriving()) {
      expect(supportCue(rewrite(event)), event.id).toBe(supportCue(event));
    }
  });

  it('does not depend on the answer: the correct action, what to avoid, or which lane', () => {
    for (const { event } of answeredByDriving()) {
      const other: ScenarioEvent = {
        ...event,
        correctAction: event.correctAction === 'stop' ? 'accelerate' : 'stop',
        avoid: undefined,
        ...(event.requiredLane ? { requiredLane: { ...event.requiredLane, lane: event.requiredLane.lane === 'curb' ? 'inner' : 'curb' } } : {}),
        ...(event.maneuver ? { maneuver: { ...event.maneuver, direction: event.maneuver.direction === 'left' ? 'right' : 'left' } } : {}),
        ...(event.bay ? { bay: { ...event.bay, mayStop: !event.bay.mayStop } } : {}),
        ...(event.speedRule ? { speedRule: event.speedRule === 'maximum' ? 'minimum' : 'maximum' } : {}),
      };
      expect(supportCue(other), event.id).toBe(supportCue(event));
    }
  });

  /**
   * Where a scenario declares nothing on the road and grades no requirement
   * that could be pointed at, the cue level shows what none does, and the
   * policy can pitch it at `cue` to no effect. Level 2's four `settle.*` items
   * were the last: they now declare the maximum they are graded
   * against, so the cue points at the speed. Level 12 has none: its
   * own half is asked at a stop or in a frozen prompt, and its borrowed half
   * declares what its source levels declare.
   */
  it('is never missing for a scenario answered with the car', () => {
    const missing = answeredByDriving()
      .filter(({ event }) => supportCue(event) === null)
      .map(({ event }) => event.id)
      .sort();
    expect(missing).toEqual([]);
  });
});

/**
 * Plan 3e: the scenarios whose situation or name told the driver the
 * move. At `none` the description and the label are all that is shown, so
 * neither may say what to do, what another road user means to do, or which
 * lane the scenario grades. Where the driver is going and what stands on the
 * road are the situation; the lane, the speed, the timing and the act are the
 * move.
 */
describe('the items rewritten to set up the situation', () => {
  const SITUATIONS = [
    'level3.priority-yield.left-turner-give-way',
    'level3.priority-yield.approach-intersection',
    'level3.route-restriction.turn-if-clear',
    'level3.lane-guidance.advance-direction',
    'level3.lane-guidance.interchange-lane',
    'level3.lane-guidance.hospital-service',
    'level4.lane-change.chevron',
    'level4.lane-change.pavement-arrows',
    'level5.emergency-yield.not-in-the-junction',
    'level5.yellow-box.already-committed',
    'level5.yellow-box.exit-blocked',
    'level6.right-turn-curb-lane',
    'level6.left-turn-centre-lane',
    'level7.check-brakes-reduce-speed',
    // Borderline: these stated the other driver's intent.
    'level5.uncontrolled-crossroads.waiting-on-the-left',
    'level5.driveway-join.waiting-van',
    // Written after 3e and held to its rule: where the
    // driver is going, never the move.
    'level6.hydrant-at-the-curb',
    'level6.tow-away-zone',
    // Only its label was on the rewrite list; its description named the curb
    // lane it grades until the first play-test.
    'level6.lane-change-slow-bus',
  ];
  const NAMES = [
    'level6.right-turn-curb-lane',
    'level6.left-turn-centre-lane',
    'level6.lane-change-slow-bus',
    'level6.no-overtake-double-yellow',
    'level7.lane1-yield-to-faster-traffic',
    'level5.emergency-yield.not-in-the-junction',
    'level8.hold-your-line',
    'level8.let-them-out',
    'level8.two-seconds',
    'level7.following-distance-lead-van',
    'level5.uncontrolled-crossroads.waiting-on-the-left',
    'level5.driveway-join.waiting-van',
    // The yellow-box plate, which is the label where none is authored.
    'level4.junction-space.yellow-box',
    'level11.tricycle-in-the-box',
    // Step 3h: an authored label, and a plate's own wording.
    'level6.hydrant-at-the-curb',
    'level6.tow-away-zone',
  ];
  const GONE = ['level11.puv-loading-bay-correct', 'level12.rolling-stop-temptation'];

  /** An instruction, or another road user's intent, in a sentence. */
  const TELLS =
    /\b(?:stay (?:in|on)|move (?:into|over|across|right|left)|keep (?:right|left|to)|take the (?:speed|lane)|turn onto|slow (?:down|to)|ease off|stop now|give way|yield|let (?:it|them|you)|hold (?:back|your)|pull (?:in|out|over|up)|(?:complete|full) stop|permitted turn|is served by|reached from|taken from|turning lane|matters|strand|nowhere to|waiting for|start reading|goes your way|folding traffic|tells you)\b/i;
  /** The same in a name, which has no sentence to hide it in. */
  const NAME_TELLS =
    /\b(?:hold|let|yield|give way|stop|slow (?:down|to)|keep|stay|move|change|overtake?|do not|not in|following distance|seconds?|waiting)\b/i;
  /** How each graded lane is named, so a scenario cannot name its own. */
  const LANE_WORDS: Record<string, RegExp> = {
    inner: /\b(?:lane nearest the cent(?:er|re) line|cent(?:er|re) lane|inner lane|left lane|lane ?1)\b/i,
    curb: /\b(?:curb(?:-side)? lane|right lane|outer lane|lane ?4)\b|furthest from the cent(?:er|re) line/i,
    middle: /\b(?:middle lane|lane ?2)\b/i,
  };
  /** A plate's own wording, in capitals, is the sign the driver can see. */
  const withoutPlates = (text: string) => text.replace(/\b[A-Z][A-Z',]*(?:\s+[A-Z][A-Z',]*)+\b/g, '');

  const byId = new Map<string, ScenarioEvent>();
  for (const { event } of answeredByDriving()) if (!byId.has(event.id)) byId.set(event.id, event);
  const gradedLane = (event: ScenarioEvent) => LANE_WORDS[(event.maneuver ?? event.requiredLane)?.lane ?? ''];

  it('sets up the situation and names it without the move, at none', () => {
    const telling: string[] = [];
    for (const id of SITUATIONS) {
      const event = byId.get(id);
      if (!event) {
        telling.push(`${id}: not found`);
        continue;
      }
      const shown = withoutPlates(scenarioSupport(event, 'none').situation);
      if (TELLS.test(shown)) telling.push(`${id}: "${shown.match(TELLS)![0]}"`);
      if (gradedLane(event)?.test(shown)) telling.push(`${id}: names the lane it grades`);
    }
    for (const id of NAMES) {
      const event = byId.get(id);
      if (!event) {
        telling.push(`${id}: not found`);
        continue;
      }
      const label = scenarioLabel(event);
      if (NAME_TELLS.test(label)) telling.push(`${id} label "${label}"`);
      if (gradedLane(event)?.test(label)) telling.push(`${id} label "${label}" names the lane it grades`);
    }
    const everywhere = LEVEL_SLOTS.flat(2).map(variant => variant.id);
    for (const id of GONE) if (everywhere.includes(id)) telling.push(`${id}: back`);
    expect(telling).toEqual([]);
  });

  it('sets up the parking bay without the move, though a question of its own follows', () => {
    // A parking decision is answered at a prompt, so `answeredByDriving` passes
    // it over; but its situation is on the road prompt while the car is still
    // driving, and the stop alongside the space is the first step of the
    // technique it asks about. It said "Pull up alongside the space and bring
    // the vehicle to a complete stop" until the first play-test.
    const bay = LEVEL_SLOTS.flat(2).find(variant => variant.id === 'level6.parallel-parking-bay')!;
    const shown = withoutPlates(scenarioSupport({ ...bay, triggerAtDistance: 0 } as ScenarioEvent, 'none').situation);
    expect(shown).not.toMatch(TELLS);
  });
});
