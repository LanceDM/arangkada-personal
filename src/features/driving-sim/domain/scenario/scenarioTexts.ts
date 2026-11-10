/**
 * A scenario's words in the language chosen.
 *
 * The English content is the source and is never edited for a translation: its
 * claims are tied to its source packs. Filipino sits apart, keyed by
 * the scenario's id, and is laid over a rolled level once, when a run starts.
 * The records keep reading the English level. A lesson, a module's heading and
 * a level's name follow the same rules, each as one unit.
 *
 * Only the fields named here are ever replaced. They are the words a player
 * reads, and nothing graded or drawn on the road reads them:
 * `localizeLevel.test.ts` holds the drive and the canvas to their goldens with
 * every one of them rewritten, and fails on a new text field nobody listed.
 *
 * A scenario is all or nothing, so one panel never mixes languages by accident:
 * Filipino shows only when every field has it and the entry is reviewed. An
 * entry carries a fingerprint of the English it was written against, and goes
 * back to being a draft when that English changes.
 */
import type { Language } from '@/shared/lib/localized';
import type { Lesson, LevelModule } from './lessonModule';
import { scenarioLabel } from './scenarioCopy';
import type { GarageHotspot, GarageStage, LevelConfig, ScenarioEvent } from './scenarioDefinition';

const INSPECTION_PATHS = [
  'officerLine',
  'documentType',
  'holder',
  'fields.*.label',
  'fields.*.value',
  'vehicle',
  'tripPurpose',
  'pullOver.missedMessage',
];

export const SCENARIO_TEXT_PATHS: readonly string[] = [
  'description',
  'label',
  'question',
  'choices.*.label',
  'penaltyMessage',
  'rewardMessage',
  'lawCitation',
  'recommendedMove',
  'realWorldNote',
  'sign.name',
  'sign.category',
  'sign.meaning',
  'marking.name',
  'marking.category',
  'marking.meaning',
  'requiredLane.hint',
  'requiredLane.wrongLaneMessage',
  'requiredLane.tooFastMessage',
  'maneuver.hint',
  'maneuver.wrongLaneMessage',
  'maneuver.tooFastMessage',
  'following.tooCloseMessage',
  'lineHold.driftedMessage',
  'coast.hint',
  'coast.brakedMessage',
  'merge.neverMergedMessage',
  'merge.tooSlowMessage',
  'merge.unsafeGapMessage',
  'overtake.neverPassedMessage',
  'overtake.wrongLaneMessage',
  'overtake.neverReturnedMessage',
  'overtake.cutInMessage',
  'bay.hint',
  // Named when the car hits one, and read by nothing else.
  'npc.label',
  'rear.label',
  ...INSPECTION_PATHS.map(path => `inspection.${path}`),
];

export const HOTSPOT_TEXT_PATHS: readonly string[] = [
  'label',
  'objective',
  'observation',
  'question',
  'choices.*.label',
  'penaltyMessage',
  'rewardMessage',
  'lawCitation',
  ...INSPECTION_PATHS.map(path => `document.${path}`),
];

/** An image's `src` and a block's `type` are not text: a lesson keeps its pictures in any language. */
export const LESSON_TEXT_PATHS: readonly string[] = [
  'title',
  'text',
  'blocks.*.text',
  'blocks.*.items.*',
  'blocks.*.headers.*',
  'blocks.*.rows.*.*',
  'blocks.*.alt',
];

export const MODULE_TEXT_PATHS: readonly string[] = ['title', 'desc'];

export const LEVEL_TEXT_PATHS: readonly string[] = ['name', 'description'];

/**
 * A scenario as a translation sees it. One with no authored name, sign or
 * marking is called something derived from its id; that name is written out, so
 * it is translated with the rest instead of staying English on a Filipino panel.
 */
export const scenarioOwner = <T extends { id: string; label?: string; sign?: unknown; marking?: unknown }>(event: T): T =>
  event.label?.trim() || event.sign || event.marking
    ? event
    : { ...event, label: scenarioLabel(event as unknown as ScenarioEvent) };

/** The style guide a review is checked against: its version line. */
export const STYLE_GUIDE_VERSION = 'fil-style-1';

/** One scenario's Filipino, as the team's sheet gives it. */
export interface TranslationEntry {
  /** `scenarioFingerprint` of the English this was written against. */
  source: string;
  status: 'draft' | 'reviewed';
  translatedBy?: string;
  /** Who checked it against its source notes and the style guide, when, and under which version. */
  reviewedBy?: string;
  reviewedOn?: string;
  guide?: string;
  /** The Filipino, by path, as `textsOf` names them. */
  fil: Readonly<Record<string, string>>;
}

export type TranslationCatalogue = Readonly<Record<string, TranslationEntry>>;

export interface LocalizeOptions {
  /** A development build shows a draft, marked, so the team can see it on screen. Production never does. */
  showDrafts: boolean;
}

/** The mark on a draft shown in a development build. */
export const DRAFT_MARK = '[DRAFT] ';

type Node = Record<string, unknown>;

const visitPath = (
  value: unknown,
  [head, ...rest]: string[],
  at: string,
  found: (path: string, text: string) => void
): void => {
  if (value === null || typeof value !== 'object') return;
  const children: Array<[string, unknown]> =
    head === '*' ? (value as unknown[]).map((child, i) => [String(i), child]) : [[head, (value as Node)[head]]];
  for (const [key, child] of children) {
    const path = at ? `${at}.${key}` : key;
    if (rest.length > 0) visitPath(child, rest, path, found);
    else if (typeof child === 'string' && child.trim() !== '') found(path, child);
  }
};

/** Every text an object holds at these paths, by its concrete path (`choices.0.label`). */
export const textsOf = (owner: object, paths: readonly string[]): Record<string, string> => {
  const texts: Record<string, string> = {};
  for (const path of paths) visitPath(owner, path.split('.'), '', (at, text) => void (texts[at] = text));
  return texts;
};

const withText = (value: unknown, [head, ...rest]: string[], text: string): unknown => {
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[Number(head)] = rest.length ? withText(copy[Number(head)], rest, text) : text;
    return copy;
  }
  const node = value as Node;
  return { ...node, [head]: rest.length ? withText(node[head], rest, text) : text };
};

/**
 * A plate's name is also what sign coverage files it under, so a translated
 * plate keeps its English name as its `key`, and progress does not split when
 * a player changes language.
 */
const keepPlateKey = (owner: Node, plate: 'sign' | 'marking'): Node => {
  const value = owner[plate] as { name: string } | undefined;
  return value ? { ...owner, [plate]: { ...value, key: value.name } } : owner;
};

/** FNV-1a: a stable tag on a piece of English, not a security measure. */
const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/** What an entry was written against: every text and its path, in a fixed order. */
export const scenarioFingerprint = (texts: Readonly<Record<string, string>>): string =>
  fnv1a(JSON.stringify(Object.keys(texts).sort().map(path => [path, texts[path]])));

/** Why an entry would not show as finished, or null when it may. */
export const entryProblem = (
  texts: Readonly<Record<string, string>>,
  entry: TranslationEntry | undefined
): 'none' | 'incomplete' | 'stale' | 'draft' | null => {
  if (!entry) return 'none';
  if (Object.keys(texts).some(path => !entry.fil[path]?.trim())) return 'incomplete';
  if (entry.source !== scenarioFingerprint(texts)) return 'stale';
  return entry.status === 'reviewed' ? null : 'draft';
};

export const applyEntry = <T extends object>(
  owner: T,
  paths: readonly string[],
  entry: TranslationEntry | undefined,
  { showDrafts }: LocalizeOptions
): T => {
  const texts = textsOf(owner, paths);
  const problem = entryProblem(texts, entry);
  // An incomplete scenario stays whole in English, in every build. A stale or
  // unreviewed one shows only where a person can see it is not final.
  if (problem === 'none' || problem === 'incomplete') return owner;
  if (problem !== null && !showDrafts) return owner;
  const mark = problem === null ? '' : DRAFT_MARK;
  let result: unknown = owner;
  if (texts['sign.name']) result = keepPlateKey(result as Node, 'sign');
  if (texts['marking.name']) result = keepPlateKey(result as Node, 'marking');
  for (const path of Object.keys(texts)) result = withText(result, path.split('.'), `${mark}${entry!.fil[path]}`);
  return result as T;
};

/** What a level's own name and description are filed under. */
export const levelKey = (levelId: number): string => `level${levelId}`;

export const hotspotKey = (levelId: number, stage: 'garage' | 'aftermath', hotspot: GarageHotspot): string =>
  `level${levelId}.${stage}.${hotspot.id}`;

const localizeStage = (
  levelId: number,
  name: 'garage' | 'aftermath',
  stage: GarageStage,
  catalogue: TranslationCatalogue,
  options: LocalizeOptions
): GarageStage => ({
  ...stage,
  hotspots: stage.hotspots.map(hotspot =>
    applyEntry(hotspot, HOTSPOT_TEXT_PATHS, catalogue[hotspotKey(levelId, name, hotspot)], options)
  ),
});

/**
 * The level as this language shows it. English is the level itself, the same
 * object, so an English run is what it always was.
 */
export const localizeLevel = (
  level: LevelConfig,
  language: Language,
  catalogue: TranslationCatalogue,
  options: LocalizeOptions
): LevelConfig => {
  if (language === 'en') return level;
  return {
    ...applyEntry(level, LEVEL_TEXT_PATHS, catalogue[levelKey(level.id)], options),
    language,
    events: level.events.map((event: ScenarioEvent) =>
      applyEntry(scenarioOwner(event), SCENARIO_TEXT_PATHS, catalogue[event.id], options)
    ),
    ...(level.garage ? { garage: localizeStage(level.id, 'garage', level.garage, catalogue, options) } : {}),
    ...(level.aftermath ? { aftermath: localizeStage(level.id, 'aftermath', level.aftermath, catalogue, options) } : {}),
  };
};

/** The name a level is shown under, where the whole level is not being played (the map). */
export const localizeLevelName = (
  level: Pick<LevelConfig, 'id' | 'name' | 'description'>,
  language: Language,
  catalogue: TranslationCatalogue,
  options: LocalizeOptions
): string =>
  language === 'en'
    ? level.name
    : applyEntry({ name: level.name, description: level.description }, LEVEL_TEXT_PATHS, catalogue[levelKey(level.id)], options).name;

/**
 * A module as this language shows it. Each lesson is all or nothing on its own,
 * so a reader meets a whole lesson in one language. English is the module itself.
 */
export const localizeModule = (
  module: LevelModule,
  language: Language,
  catalogue: TranslationCatalogue,
  options: LocalizeOptions
): LevelModule =>
  language === 'en'
    ? module
    : {
        ...applyEntry(module, MODULE_TEXT_PATHS, catalogue[module.id], options),
        lessons: module.lessons.map((lesson: Lesson) => applyEntry(lesson, LESSON_TEXT_PATHS, catalogue[lesson.id], options)),
      };

/** What sign coverage files a plate under, whatever language it is shown in. */
export const plateKey = (plate: { name: string; key?: string }): string => plate.key ?? plate.name;
