import type { ActionLog } from '@/domain/learner/attempt';

/**
 * How many recent observations the latency bucket reads. Wider than the
 * recent-form window because response speed is a trait rather than a streak:
 * it is read across competencies, not just the weakest one, and a slightly
 * longer window makes the median steadier without making it stale.
 */
export const LATENCY_WINDOW = 5;

/**
 * The learner's most recent evidence about how quickly they respond, oldest
 * first, across every competency - what `latencyBucket` reads.
 *
 * A timed response is its milliseconds. A scenario that asked for a response
 * and got none before its window closed (`ActionLog.reactionCensored`) is
 * `Infinity`: the response took at least the whole window and no time was
 * observed, so it counts as slow. A decision that says nothing about response
 * speed is skipped, not counted. Shared by the game and the offline trainer so
 * both read the same evidence the same way.
 */
export const recentLatencies = (logs: readonly ActionLog[]): number[] =>
  logs
    .filter(log => log.reactionCensored || typeof log.reactionTime === 'number')
    .slice(-LATENCY_WINDOW)
    .map(log => (log.reactionCensored ? Number.POSITIVE_INFINITY : (log.reactionTime as number)));
