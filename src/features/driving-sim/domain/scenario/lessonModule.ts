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

export interface LevelModule {
  id: string;
  title: string;
  desc: string;
  lessons: Lesson[];
  sourceLevel?: number;
}

/**
 * The Short Quiz's pace: one countdown per sitting, this many seconds per item.
 * Its basis is fidelity to the LTO written exam, which is timed; the LTO's own
 * per-item pace is not confirmed by an official source, so 60 s is an
 * assumption until it is. No study shows a timer
 * helps a low-stakes quiz teach, so the allowance stays generous.
 */
export const QUIZ_SECONDS_PER_ITEM = 60;

export const quizTimeLimitSeconds = (itemCount: number): number =>
  itemCount * QUIZ_SECONDS_PER_ITEM;

const READING_WORDS_PER_MINUTE = 180;

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

const blockWords = (block: LessonBlock): number => {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return words(block.text);
    case 'list':
      return words(block.items.join(' '));
    case 'table':
      return words([...block.headers, ...block.rows.flat()].join(' '));
    case 'image':
      return 0;
  }
};

/**
 * How long the module takes to read, from the words the reader actually
 * shows: every block, not `lesson.text` (a short summary) or `desc`. The
 * briefing and the reader both show this one figure.
 */
export const moduleReadMinutes = (module: LevelModule): number => {
  const total = module.lessons.reduce(
    (sum, lesson) => sum + lesson.blocks.reduce((inLesson, block) => inLesson + blockWords(block), 0),
    0
  );
  return Math.max(1, Math.ceil(total / READING_WORDS_PER_MINUTE));
};

/** The mark a lesson's title opens with ("1." or "A."), if it numbers itself. */
export const lessonTitleParts = (title: string): { mark: string | null; text: string } => {
  const match = title.match(/^(\d+|[A-Z])\.\s+(.*)$/);
  return match ? { mark: match[1], text: match[2] } : { mark: null, text: title };
};
