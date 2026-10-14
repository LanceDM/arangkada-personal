import type { ItemParams } from './irt';
import examItemParamsJson from './examItemParams.json';

/**
 * Bootstrap 2PL item parameters for EXAM_QUESTIONS (domain/questionBank),
 * indexed to match its order. Calibrated on simulated data (no real exam
 * response data exists yet) via
 * calibrateItemParameters. Only valid for that exact static question bank;
 * a Firebase-sourced bank of different content has no calibration here.
 * Recalibrate from real `exam_results` (questionIds/wrongIds) once enough
 * real attempts accumulate.
 */
export const EXAM_ITEM_PARAMS: ItemParams[] = examItemParamsJson;
