/**
 * What one rolled level asks of the player, counted the way the drive counts
 * it, for the screens that describe a level before and during the drive.
 *
 * The briefing and the mission panel used to read `level.events.length` and
 * `level.requiredScore` alone. That left out the decisions that are scored
 * but are not road events (Level 2's and Level 10's garage checks, Level 9's
 * crash scene), so Level 2 claimed three events and a pass mark the road alone
 * could not reach. It also counted a practice item as one of the level's
 * events with nothing to say it scores nothing.
 */
import type { LevelConfig, ScenarioEvent } from './scenarioDefinition';
import { englishText, type TextOf } from '@/shared/lib/localized';

export interface MissionComposition {
  /** The level's own road events: everything on the route but practice. */
  road: number;
  /** Practice items appended to the route. Graded, but never scored (`scoreDecision`'s `neutral` rule). */
  practice: number;
  /** Pre-drive garage checks, each a scored decision. */
  garage: number;
  /** Crash-scene steps after the drive, each a scored decision. Skipped after a crash. */
  aftermath: number;
  /**
   * The score of a run that answers every scored decision correctly: the
   * authored road events, the garage and the aftermath. A practice item adds
   * nothing, as it adds nothing in the game.
   */
  maxScore: number;
}

const sum = (points: number[]): number => points.reduce((total, value) => total + value, 0);

export const missionComposition = (level: LevelConfig): MissionComposition => {
  const authored = level.events.filter(event => !event.remediation);
  const garage = level.garage?.hotspots ?? [];
  const aftermath = level.aftermath?.hotspots ?? [];
  return {
    road: authored.length,
    practice: level.events.length - authored.length,
    garage: garage.length,
    aftermath: aftermath.length,
    maxScore: sum([...authored, ...garage, ...aftermath].map(scored => scored.points)),
  };
};

/**
 * The composition as the screens list it, in the order the player meets it:
 * the garage, the road, the crash scene. A practice item is its own part, so
 * nothing reads it as one of the level's scored events.
 */
export const compositionParts = (composition: MissionComposition, say: TextOf = englishText): string[] => {
  const { garage, road, aftermath, practice } = composition;
  return [
    ...(garage ? [say(garage === 1 ? { en: '1 garage check' } : { en: `${garage} garage checks` })] : []),
    say(road === 1 ? { en: '1 road event' } : { en: `${road} road events` }),
    ...(aftermath ? [say(aftermath === 1 ? { en: '1 crash-scene step' } : { en: `${aftermath} crash-scene steps` })] : []),
    ...(practice ? [say({ en: `+${practice} practice (not scored)` })] : []),
  ];
};

export interface PostedLimit {
  speed: number;
  rule: 'maximum' | 'minimum';
}

const postedOn = (event: ScenarioEvent): PostedLimit[] => [
  ...(event.postedSpeed !== undefined
    ? [{ speed: event.postedSpeed, rule: event.speedRule ?? 'maximum' } as PostedLimit]
    : []),
  ...(event.merge ? [{ speed: event.merge.minSpeed, rule: 'minimum' } as PostedLimit] : []),
];

/**
 * Every speed this route grades against other than the road's own limit, in
 * route order: a scenario's posted speed (`speedFor` judges it, not the
 * road's), and a merge's minimum. A maximum equal to the road's limit says
 * nothing new and is left out.
 */
export const postedLimits = (level: LevelConfig): PostedLimit[] => {
  const seen = new Set<string>();
  return level.events
    .flatMap(postedOn)
    .filter(limit => !(limit.rule === 'maximum' && limit.speed === level.speedLimit))
    .filter(limit => {
      const key = `${limit.rule}:${limit.speed}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/** The posted limits in words, or null when the route posts none. */
export const postedLimitsLine = (limits: PostedLimit[], say: TextOf = englishText): string | null =>
  limits.length
    ? say({
        en: `Other limits on this route: ${limits
          .map(limit => `${limit.rule === 'minimum' ? 'minimum ' : ''}${limit.speed} km/h`)
          .join(', ')}.`,
      })
    : null;
