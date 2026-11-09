/**
 * The Filipino for every scenario, one file per level, written by the
 * team's sheet and never by hand. A borrowed Level 12 scenario or a practice
 * item keeps its id, so it is translated once, under the level that owns it.
 */
import type { TranslationCatalogue } from '@/features/driving-sim/domain/scenario/scenarioTexts';
import level0 from './level0.json';
import level1 from './level1.json';
import level2 from './level2.json';
import level3 from './level3.json';
import level4 from './level4.json';
import level5 from './level5.json';
import level6 from './level6.json';
import level7 from './level7.json';
import level8 from './level8.json';
import level9 from './level9.json';
import level10 from './level10.json';
import level11 from './level11.json';
import level12 from './level12.json';

export const FILIPINO_CATALOGUE: TranslationCatalogue = {
  ...(level0 as TranslationCatalogue),
  ...(level1 as TranslationCatalogue),
  ...(level2 as TranslationCatalogue),
  ...(level3 as TranslationCatalogue),
  ...(level4 as TranslationCatalogue),
  ...(level5 as TranslationCatalogue),
  ...(level6 as TranslationCatalogue),
  ...(level7 as TranslationCatalogue),
  ...(level8 as TranslationCatalogue),
  ...(level9 as TranslationCatalogue),
  ...(level10 as TranslationCatalogue),
  ...(level11 as TranslationCatalogue),
  ...(level12 as TranslationCatalogue),
};
