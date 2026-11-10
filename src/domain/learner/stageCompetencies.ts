/**
 * Which competencies each stage teaches and grades, decided 2026-10-28.
 *
 * Every drive gives each listed competency 3 scenarios (`DRIVE_ITEMS_PER_COMPETENCY`)
 * and every short quiz 3 items, and the routing FSM makes one decision per
 * listed competency after each drive.
 *
 * The lists come from two rules:
 *
 * 1. The competencies the stage's own content is tagged with (after the
 *    catalogue review's retags).
 * 2. The spread rule: every competency appears in at least 3 stages of L1-L11
 *    (preferably 4), never before the stage that introduces it, and only in a
 *    stage whose module, or an earlier one, teaches it. Spacing a competency
 *    over stages supports retention (Carpenter, Pan & Butler, 2022) and every
 *    stage adds graded opportunities (Koedinger et al., 2023).
 *
 * The final exam (L12) is not counted and is not in this table; the tutorial
 * (L0) teaches the controls and grades no competency.
 */
import type { DrivingCompetency } from './competency';
import { COMPETENCIES } from './profile';

/** The stages that make per-competency decisions, in course order. */
export const COMPETENCY_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type CompetencyStage = (typeof COMPETENCY_STAGES)[number];

export const isCompetencyStage = (levelId: number): levelId is CompetencyStage =>
  (COMPETENCY_STAGES as readonly number[]).includes(levelId);

/** Scenarios per competency in every drive and repeat drive. */
export const DRIVE_ITEMS_PER_COMPETENCY = 3;

/**
 * Correct scenarios a competency needs in one drive to pass it: 2 of 3.
 * TENTATIVE (decided 2026-10-28, replacing the proposed 75% cutoff, which with
 * 3 scenarios could only mean 3 of 3). The same rule as the short quiz.
 */
export const DRIVE_PASS_CORRECT = 2;

/** Short-quiz items per competency per attempt, and the pass rule: 2 of 3. */
export const QUIZ_ITEMS_PER_COMPETENCY = 3;
export const QUIZ_PASS_CORRECT = 2;
/** Short-quiz attempts before the learner is sent to review the module. */
export const QUIZ_ATTEMPT_CAP = 3;

/**
 * TENTATIVE: seconds to answer an in-drive question (checkpoint, right-of-way,
 * emergency, parking). Running out fails the scenario without updating BKT.
 * The garage (pre-drive) and aftermath (post-drive) questions are untimed.
 */
export const IN_DRIVE_QUESTION_LIMIT_SEC = 30;

/** Diagnostic pre-test items per competency (55 for the 11). */
export const DIAGNOSTIC_ITEMS_PER_COMPETENCY = 5;

export const STAGE_COMPETENCIES: Readonly<Record<CompetencyStage, readonly DrivingCompetency[]>> = {
  1: ['driver_legality', 'document_awareness'],
  2: ['document_awareness', 'right_of_way', 'pedestrians', 'speed_control', 'hazard_awareness', 'general_rules'],
  3: ['traffic_signals', 'road_signs', 'pedestrians', 'lane_discipline', 'speed_control'],
  4: ['lane_discipline', 'pedestrians', 'speed_control'],
  5: ['traffic_signals', 'right_of_way', 'pedestrians', 'lane_discipline', 'road_signs'],
  6: ['lane_discipline', 'parking', 'road_signs', 'traffic_signals', 'right_of_way'],
  7: ['speed_control', 'lane_discipline', 'hazard_awareness', 'road_signs', 'right_of_way', 'parking'],
  8: ['pedestrians', 'lane_discipline', 'hazard_awareness', 'general_rules', 'right_of_way', 'traffic_signals'],
  9: ['hazard_awareness', 'general_rules', 'parking'],
  10: ['speed_control', 'hazard_awareness', 'general_rules', 'driver_legality', 'document_awareness', 'traffic_signals'],
  11: ['pedestrians', 'lane_discipline', 'hazard_awareness', 'general_rules', 'driver_legality', 'document_awareness', 'parking'],
};

/** The stage that introduces a competency: the first stage that lists it. */
export const introStageOf = (competency: DrivingCompetency): CompetencyStage =>
  COMPETENCY_STAGES.find(stage => STAGE_COMPETENCIES[stage].includes(competency))!;

/** The stages a competency appears in, in course order. */
export const stagesOf = (competency: DrivingCompetency): CompetencyStage[] =>
  COMPETENCY_STAGES.filter(stage => STAGE_COMPETENCIES[stage].includes(competency));

/** The minimum and preferred number of stages per competency (L1-L11). */
export const MIN_STAGES_PER_COMPETENCY = 3;
export const PREFERRED_STAGES_PER_COMPETENCY = 4;

/** Every competency, for completeness checks. */
export const ALL_COMPETENCIES: readonly DrivingCompetency[] = COMPETENCIES;
