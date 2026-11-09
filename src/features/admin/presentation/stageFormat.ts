/** A study stage in the admin's words: the study's own labels. */
import type { StudyStage } from '@/domain/study/studyStage';
import { STAGE_LABELS } from '@/features/study';

export const stageLabel = (stage: StudyStage): string => (stage === 'withdrawn' ? 'Withdrawn' : STAGE_LABELS[stage].en);
