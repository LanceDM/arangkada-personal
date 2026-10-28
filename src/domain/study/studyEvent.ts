/**
 * The participant's event stream (`users/{uid}/events/{eventId}`): one
 * append-only record per thing that happened, all in one envelope.
 *
 * Raw inputs come first in every payload (what was done, what was expected,
 * how long it took), so the panel can change a grading rule, a BKT value, the
 * reward or the policy and the logs can be replayed under the new rule.
 *
 * Two kinds of record have their own, more detailed logs instead of an event
 * each: every BKT update (`users/{uid}/bktUpdates`) and every Q-table change
 * (`policy/competencyQ/updates`). Both carry the same envelope fields.
 */

/** Fields every logged record carries. */
export interface StudyEnvelope {
  schemaVersion: 1;
  /** Made on the device and time-ordered, so a retried write lands on the same document. */
  eventId: string;
  uid: string;
  /** Device time, ms. */
  at: number;
  /** One sitting of the app, from load to close. */
  sessionId: string;
  /** The git commit the app was built from. */
  appBuild: string;
  /** RUN_CONFIG_VERSION in force. */
  configVersion: string;
}

export type StudyEventType =
  | 'session_started'
  | 'page_viewed'
  | 'course_transition'
  | 'sitting_submitted'
  | 'item_answered'
  | 'background_submitted'
  | 'drive_planned'
  | 'decision_made'
  | 'drive_ended'
  | 'verdict_computed'
  | 'policy_decision'
  | 'reward_computed'
  | 'app_error';

/** What a caller hands the recorder; the envelope and `seq` are added for it. */
export interface StudyEventDraft {
  type: StudyEventType;
  /** Device time; the recorder fills it with now when absent. */
  at?: number;
  levelId?: number | null;
  /** The course phase, e.g. `DRIVE(3)`. */
  phase?: string | null;
  attemptId?: string | null;
  payload: Record<string, unknown>;
}

export interface StudyEvent extends StudyEnvelope {
  type: StudyEventType;
  /** Per-participant order 1, 2, 3...; null only if the counter could not be reached (offline). */
  seq: number | null;
  levelId: number | null;
  phase: string | null;
  attemptId: string | null;
  payload: Record<string, unknown>;
}

/** A time-ordered id: base-36 time, then random characters. */
export const newEventId = (at: number, random: () => number = Math.random): string =>
  `${at.toString(36).padStart(9, '0')}-${Array.from({ length: 10 }, () => Math.floor(random() * 36).toString(36)).join('')}`;
