/**
 * Which panel owns the screen.
 *
 * Only one thing may be asking at a time. A checkpoint and a cutscene stop the
 * world behind a question of their own; the scenario briefing stops it to be
 * read. In all three cases the compact cue beside the road would be a second
 * copy of the situation, the plate and the recommended move — which is exactly
 * what made the merge screen unreadable.
 */
export const showsRoadPrompt = (held: {
  inspectionEvent: unknown;
  cutsceneEvent: unknown;
  briefingEvent: unknown;
}): boolean => !held.inspectionEvent && !held.cutsceneEvent && !held.briefingEvent;
