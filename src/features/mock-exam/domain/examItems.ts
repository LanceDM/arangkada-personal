/**
 * The mock exam's items (2026-11-13): drawn from the same question bank as the
 * short quizzes, so every answer given here is one more response to a bank
 * item. Those responses are what the bank's wider IRT calibration is built
 * from as they accumulate (the admin's IRT page, "Item bank"); the 60 test
 * items stay calibrated on the pre-test alone.
 *
 * The test items (pre-test and post-test) are never drawn, so the mock exam
 * cannot show a participant a test item early.
 */
import { QUESTION_BANK, RESERVED_FOR_POST_EXAM, type BankItem } from '@/domain/assessment/questionBank';

export interface ExamQuestion {
  /** The bank's item id, e.g. L5-RW-01. */
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  /** The level (module) that teaches it, 1 to 11. */
  level: number;
  /** The law the item rests on, shown with a wrong answer; empty for a technique item. */
  lawCitation: string;
  image?: string;
}

/** A sitting's length: the written exam's 40 items. */
export const EXAM_SIZE = 40;

/** The topic each level teaches, as the weak-area list names it. */
export const LEVEL_TOPICS: Readonly<Record<number, string>> = {
  1: 'Authority to drive',
  2: 'Vehicle readiness',
  3: 'Signs and signals',
  4: 'Pavement markings',
  5: 'Intersections and right of way',
  6: 'Turning, lanes and parking',
  7: 'Speed, following and expressways',
  8: 'Defensive driving',
  9: 'Emergencies and crashes',
  10: 'Safety laws',
  11: 'Motorcycles, tricycles and PUVs',
};

export const levelTopic = (level: number): string => LEVEL_TOPICS[level] ?? `Level ${level}`;

/**
 * The law part of an item's source: what comes before "; ref.". A technique
 * item cites only the reference ("Ref. …") and shows no law.
 */
export const lawPartOf = (source: string): string => (/^ref\./i.test(source.trim()) ? '' : source.split(/;\s*ref\./i)[0].trim());

export const fromBankItem = (item: BankItem): ExamQuestion => ({
  id: item.id,
  question: item.question,
  choices: item.choices,
  correctIndex: item.answer,
  level: item.stage,
  lawCitation: lawPartOf(item.source),
  ...(item.image ? { image: item.image } : {}),
});

/** The bundled bank's quiz items: the fallback when the served bank cannot be read. */
export const BUNDLED_EXAM_POOL: readonly ExamQuestion[] = QUESTION_BANK.filter(item => !RESERVED_FOR_POST_EXAM.has(item.id)).map(fromBankItem);

const shuffled = <T>(items: readonly T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * A sitting of `size` items spread over the levels: each level's items are
 * shuffled, then the levels give one item each in turn until the sitting is
 * full, so every level is asked about 3 or 4 times in 40. The order is then
 * shuffled again. A level that runs out simply stops giving.
 */
export const drawExam = (pool: readonly ExamQuestion[], random: () => number, size = EXAM_SIZE): ExamQuestion[] => {
  const byLevel = new Map<number, ExamQuestion[]>();
  for (const item of pool) byLevel.set(item.level, [...(byLevel.get(item.level) ?? []), item]);
  const queues = [...byLevel.keys()].sort((a, b) => a - b).map(level => shuffled(byLevel.get(level)!, random));
  // Which levels give first rotates with the draw, so the levels left a fourth
  // item are not always the same ones.
  const start = queues.length ? Math.floor(random() * queues.length) : 0;
  const picked: ExamQuestion[] = [];
  for (let round = 0; picked.length < size && queues.some(q => q.length > round); round += 1) {
    for (let k = 0; k < queues.length && picked.length < size; k += 1) {
      const queue = queues[(start + k) % queues.length];
      if (queue.length > round) picked.push(queue[round]);
    }
  }
  return shuffled(picked, random);
};
