import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';

/**
 * A frozen question-and-answer version of a slot, kept out of play (2026-11-16, future work,
 * draft for the team's source check): the same competency, points, severity
 * and approach as the slot's first variant, so it fits the slot's spacing
 * (`thetaRoom.test.ts`), but a different rule, asked rather than driven. Used
 * where the scene vocabulary has no second driven form for the competency.
 *
 * The correct answer is `accelerate` and the two wrong ones `brake` and
 * `turn_right`: three distinct acts, so no wrong answer can satisfy the right
 * one (a stop satisfies a brake). The drive shuffles their order by its seed.
 */
export interface QaSpec {
  id: string;
  label: string;
  /** The situation, in one or two sentences. Promises nothing drawn on the road. */
  description: string;
  question: string;
  correct: string;
  wrong: readonly [string, string];
  penaltyMessage: string;
  rewardMessage: string;
  /** A shorter approach where the slot's own is a stop the world never narrows (a checkpoint), so the frozen prompt still fits the slot's room. */
  warningDistance?: number;
  /** The module section or pack quote the answer rests on. */
  lawCitation: string;
}

export const qaVariant = (base: SlotVariant, spec: QaSpec): SlotVariant => ({
  id: spec.id,
  label: spec.label,
  type: 'scenario_trigger',
  cutscene: true,
  // Out of play: the road draws none of the situation, so it is a question,
  // not a driving decision, and never feeds BKT (scenarioDefinition `offRoad`).
  offRoad: true,
  description: spec.description,
  question: spec.question,
  choices: [
    { label: spec.correct, action: 'accelerate' },
    { label: spec.wrong[0], action: 'brake' },
    { label: spec.wrong[1], action: 'turn_right' },
  ],
  correctAction: 'accelerate',
  points: base.points,
  ...((spec.warningDistance ?? base.warningDistance) !== undefined
    ? { warningDistance: spec.warningDistance ?? base.warningDistance }
    : {}),
  penaltyMessage: spec.penaltyMessage,
  rewardMessage: spec.rewardMessage,
  duration: 220,
  lawCitation: spec.lawCitation,
  competency: base.competency,
  severity: base.severity,
});
