export interface Lesson {
  id: string;
  title: string;
  text: string;
  blocks: LessonBlock[];
}

export type LessonBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; alt: string; src: string; size?: 'normal' | 'large' };

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface LevelModule {
  id: string;
  title: string;
  desc: string;
  lessons: Lesson[];
  quiz: QuizQuestion[];
  passingScore?: number;
  sourceLevel?: number;
}
