// The pilot's common post-test.
//
// Conventional and Optimized play different content by design: the Optimized
// group's routing adds practice items and reviews. So the groups are compared
// on one thing both take the same way: the final exam, driven once by every
// participant at the end of their play time, whatever level they reached.
//
// It is played outside the routing FSM, like a free replay: it moves no
// cursor and spends nothing of the learned policy's budget. It is driven at the final
// exam's own support level (`none`) and θ = 1, with nothing added.
import { FINAL_EXAM_LEVEL_ID } from './practiceSelection';
import type { CourseNote } from './routingBriefing';

export const POST_TEST_LEVEL_ID = FINAL_EXAM_LEVEL_ID;

/**
 * The post-test's attempt seed, the same for every participant.
 *
 * The final exam rolls from its seed and nothing else, and the seed
 * also orders every question's answers, so one seed is one test: the same
 * eight scenarios in the same order, for everyone. Changing it changes the
 * instrument, so it is fixed for the whole pilot.
 */
export const POST_TEST_SEED = 20261017;

/** The briefing's note on the post-test. Like every course note, it never names the group. */
export const postTestNote = (): CourseNote => ({
  heading: 'Post-test: the final exam',
  lines: [
    'Every participant drives this same final exam once, at the end of the session, with no hints.',
    'It does not change your course, and nothing is added to it. When it ends, tell the facilitator.',
  ],
});
