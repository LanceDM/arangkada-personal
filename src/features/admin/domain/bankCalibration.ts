/**
 * The question bank's calibration from the mock exam (2026-11-13).
 *
 * The 60 test items are calibrated on the pre-test, which everyone takes. The
 * rest of the bank is not: with about 20 participants, an item seen by only a
 * few of them has no stable difficulty. The mock exam is optional and draws
 * from the whole bank, so its answers build up per item over time; an item's
 * difficulty is reported once enough different players have answered it.
 *
 * Each player counts once per item, on their first answer to it (a later
 * sitting may repeat an item they have already seen and been corrected on).
 * The difficulty is the same first estimate the test items use,
 * b = ln((1 − p) / p). Exploratory: mock exam takers choose to take it.
 */
import { difficultyFromProportion } from '@/domain/assessment/rasch';

/**
 * TENTATIVE: different players an item needs before its difficulty is
 * reported, the figure the team was given for a stable item estimate.
 */
export const BANK_CALIBRATION_MIN_PLAYERS = 80;

export interface ExamSittingResponses {
  uid: string;
  timestamp: number;
  responses: unknown;
}

export interface BankItemCalibration {
  itemId: string;
  level: number | null;
  /** Different players who have answered it (first answers only). */
  players: number;
  correct: number;
  /** Share right, of those first answers. */
  p: number | null;
  /** Rasch difficulty, once `players` reaches the minimum; null before. */
  b: number | null;
  calibrated: boolean;
}

export interface BankCalibration {
  items: BankItemCalibration[];
  /** Sittings that carried per-item answers. */
  sittings: number;
  players: number;
  calibrated: number;
  minPlayers: number;
}

interface Response {
  itemId: string;
  level: number | null;
  correct: boolean;
}

const readResponses = (value: unknown): Response[] =>
  Array.isArray(value)
    ? value.flatMap(r => {
        if (typeof r !== 'object' || r === null) return [];
        const { itemId, level, correct } = r as Record<string, unknown>;
        if (typeof itemId !== 'string' || typeof correct !== 'boolean') return [];
        return [{ itemId, level: typeof level === 'number' ? level : null, correct }];
      })
    : [];

export const bankCalibration = (
  sittings: readonly ExamSittingResponses[],
  minPlayers = BANK_CALIBRATION_MIN_PLAYERS
): BankCalibration => {
  const ordered = [...sittings].sort((a, b) => a.timestamp - b.timestamp);
  const first = new Map<string, Map<string, Response>>(); // item -> player -> first answer
  let counted = 0;
  const players = new Set<string>();
  for (const sitting of ordered) {
    const responses = readResponses(sitting.responses);
    if (responses.length === 0) continue;
    counted += 1;
    players.add(sitting.uid);
    for (const response of responses) {
      const byPlayer = first.get(response.itemId) ?? new Map<string, Response>();
      if (!byPlayer.has(sitting.uid)) byPlayer.set(sitting.uid, response);
      first.set(response.itemId, byPlayer);
    }
  }
  const items = [...first.entries()]
    .map(([itemId, byPlayer]): BankItemCalibration => {
      const answers = [...byPlayer.values()];
      const correct = answers.filter(a => a.correct).length;
      const n = answers.length;
      const calibrated = n >= minPlayers;
      return {
        itemId,
        level: answers.find(a => a.level !== null)?.level ?? null,
        players: n,
        correct,
        p: n > 0 ? correct / n : null,
        b: calibrated ? difficultyFromProportion(correct, n) : null,
        calibrated,
      };
    })
    .sort((a, b) => b.players - a.players || a.itemId.localeCompare(b.itemId, 'en', { numeric: true }));
  return { items, sittings: counted, players: players.size, calibrated: items.filter(i => i.calibrated).length, minPlayers };
};
