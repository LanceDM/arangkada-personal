/**
 * The level a player's screens read, in the language their attempt began in
 *. The plan's own level stays English for the records. A development
 * build shows the team's drafts, marked; production shows only what was reviewed.
 */
import type { Language } from '@/shared/lib/localized';
import { FILIPINO_CATALOGUE } from '@/features/driving-sim/domain/scenario/content/fil/filipinoCatalogue';
import { localizeQuizItem, type QuizItemDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  localizeLevel,
  localizeLevelName,
  localizeModule,
} from '@/features/driving-sim/domain/scenario/scenarioTexts';

export const playableQuizItem = (item: QuizItemDoc, language: Language): QuizItemDoc =>
  localizeQuizItem(item, language, { showDrafts: import.meta.env.DEV });

const options = { showDrafts: import.meta.env.DEV };

export const playableLevel = (level: LevelConfig, language: Language): LevelConfig =>
  localizeLevel(level, language, FILIPINO_CATALOGUE, options);

export const playableLevelName = (level: Pick<LevelConfig, 'id' | 'name' | 'description'>, language: Language): string =>
  localizeLevelName(level, language, FILIPINO_CATALOGUE, options);

export const playableModule = (module: LevelModule, language: Language): LevelModule =>
  localizeModule(module, language, FILIPINO_CATALOGUE, options);
