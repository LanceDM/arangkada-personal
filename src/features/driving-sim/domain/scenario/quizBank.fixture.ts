/**
 * Made-up quiz items for tests and the dev gallery. The real bank is in
 * Firestore; nothing here is shown to a player.
 */
import type { LevelQuiz, QuizItemDoc } from './quizBank';

export const fixtureQuizItem = (moduleId: string, n: number, overrides: Partial<QuizItemDoc> = {}): QuizItemDoc => ({
  schemaVersion: 1,
  id: `L1-GR-${String(n).padStart(2, '0')}`,
  moduleId,
  question: `Sample question ${n}: which choice is the right one?`,
  // The answer written first, as an author writes it.
  options: [`Right answer ${n}`, `Wrong answer ${n}a`, `Wrong answer ${n}b`, `Wrong answer ${n}c`],
  correctIndex: 0,
  explanation: `Sample explanation ${n}.`,
  image: '',
  competency: 'general_rules',
  source: 'Fixture',
  use: 'quiz',
  isActive: true,
  order: n,
  revision: 1,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'fixture',
  ...overrides,
});

export const fixtureLevelQuiz = (
  count: number,
  { itemsPerSitting = count, passingScore = Math.ceil(itemsPerSitting * 0.6), moduleId = 'lto_level_1' } = {}
): LevelQuiz => ({
  moduleId,
  items: Array.from({ length: count }, (_, i) => fixtureQuizItem(moduleId, i + 1)),
  itemsPerSitting,
  passingScore,
});
