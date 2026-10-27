import { level0Module } from './level0Module';
import { level1Module } from './level1Module';
import { level2Module } from './level2Module';
import { level3Module } from './level3Module';
import { level4Module } from './level4Module';
import { level5Module } from './level5Module';
import { level6Module } from './level6Module';
import { level7Module } from './level7Module';
import { level8Module } from './level8Module';
import { level9Module } from './level9Module';
import { level10Module } from './level10Module';
import { level11Module } from './level11Module';
import { level12Module } from './level12Module';
import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

export const LEVEL_MODULE_DATA = [
  level0Module,
  level1Module,
  level2Module,
  level3Module,
  level4Module,
  level5Module,
  level6Module,
  level7Module,
  level8Module,
  level9Module,
  level10Module,
  level11Module,
  level12Module,
];

const createMissingModule = (sourceLevel: number): LevelModule => ({
  id: `lto_level_${sourceLevel}`,
  title: `Level ${sourceLevel} Module Not Found`,
  sourceLevel,
  desc: 'This level does not have a typed learning module yet.',
  lessons: [
    {
      id: `lto_level_${sourceLevel}-lesson-1`,
      title: 'Module Missing',
      text: 'Create a typed module file for this level under domain/scenario/content/lessons.',
      blocks: [
        {
          type: 'paragraph',
          text: 'Create a typed module file for this level under domain/scenario/content/lessons, then register it in lessonCatalog.ts.',
        },
      ],
    },
  ],
  quiz: [
    {
      question: 'Where should new learning module content be added?',
      options: [
        'domain/scenario/content/lessons',
        'The browser console',
        'The score screen only',
        'The settings page only',
      ],
      correct: 0,
      explanation: 'Correct answer: domain/scenario/content/lessons',
    },
  ],
});

export const LEVEL_MODULES: Record<string, LevelModule> = Object.fromEntries(
  LEVEL_MODULE_DATA.map(module => [module.id, module])
);

export const getLevelModule = (sourceLevel: number): LevelModule => {
  const levelModule = LEVEL_MODULE_DATA.find(module => module.sourceLevel === sourceLevel);
  if (!levelModule) {
    console.warn(`Missing typed module content for level ${sourceLevel}. Showing fallback module.`);
    return createMissingModule(sourceLevel);
  }

  return levelModule;
};
