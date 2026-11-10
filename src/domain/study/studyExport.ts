/**
 * What the export writes of each participant's steps through the study
 *, as `study.csv`: one row per enrolled participant,
 * named by code and cohort.
 *
 * It reads the participant's own study records and their tests' status. It
 * never reads the consent record: no name, exact age, username or email
 * reaches it. The age is the band on the consent marker. The tests' answers
 * go to `pre-test.csv` and `post-test.csv` by the assessment's own CSV
 * (`testResponsesCsv`), unchanged.
 */
import type { BackgroundDoc, ConsentMarker, DeviceCheckDoc, SurveyDoc } from './consentRecords';
import type { StudyCohort } from './participantCode';
import { studyStage, type CourseProgress, type StudyStage, type TestProgress } from './studyStage';

export interface StudyExportSource {
  code: string;
  cohort: StudyCohort;
  enrolledAt: number;
  withdrawnAt: number | null;
  consent: ConsentMarker | null;
  background: BackgroundDoc | null;
  device: DeviceCheckDoc | null;
  survey: SurveyDoc | null;
  preTest: { status: TestProgress; finishedAt: number | null };
  postTest: { status: TestProgress; finishedAt: number | null; block: string | null };
  course: CourseProgress;
}

export interface StudyExportRow {
  code: string;
  cohort: StudyCohort;
  stage: StudyStage;
  enrolledAt: string;
  consentVersion: string | null;
  consentedAt: string | null;
  ageBand: string | null;
  gaming: string | null;
  device: string | null;
  deviceTouch: boolean | null;
  deviceLandscape: boolean | null;
  deviceMedianFps: number | null;
  deviceSlow: boolean | null;
  deviceCheckedAt: string | null;
  preTest: TestProgress;
  preTestFinishedAt: string | null;
  courseEndReason: string | null;
  postTest: TestProgress;
  postTestBlock: string | null;
  postTestFinishedAt: string | null;
  surveyOpenedAt: string | null;
  surveyConfirmedAt: string | null;
  withdrawnAt: string | null;
}

export const STUDY_EXPORT_COLUMNS: ReadonlyArray<keyof StudyExportRow> = [
  'code', 'cohort', 'stage', 'enrolledAt',
  'consentVersion', 'consentedAt', 'ageBand',
  'gaming', 'device',
  'deviceTouch', 'deviceLandscape', 'deviceMedianFps', 'deviceSlow', 'deviceCheckedAt',
  'preTest', 'preTestFinishedAt', 'courseEndReason', 'postTest', 'postTestBlock', 'postTestFinishedAt',
  'surveyOpenedAt', 'surveyConfirmedAt', 'withdrawnAt',
];

const iso = (at: number | null | undefined) => (typeof at === 'number' ? new Date(at).toISOString() : null);

export const studyExportRow = (source: StudyExportSource): StudyExportRow => ({
  code: source.code,
  cohort: source.cohort,
  stage: studyStage({
    withdrawn: source.withdrawnAt !== null,
    consented: source.consent !== null,
    background: source.background !== null,
    deviceChecked: source.device !== null,
    preTest: source.preTest.status,
    course: source.course,
    postTest: source.postTest.status,
    survey: { openedAt: source.survey?.openedAt ?? null, confirmedAt: source.survey?.confirmedAt ?? null },
  }),
  enrolledAt: iso(source.enrolledAt)!,
  consentVersion: source.consent?.consentVersion ?? null,
  consentedAt: iso(source.consent?.agreedAt),
  ageBand: source.consent?.ageBand ?? null,
  gaming: source.background?.gaming ?? null,
  device: source.background?.device ?? null,
  deviceTouch: source.device?.touch ?? null,
  deviceLandscape: source.device?.landscape ?? null,
  deviceMedianFps: source.device?.medianFps ?? null,
  deviceSlow: source.device?.slow ?? null,
  deviceCheckedAt: iso(source.device?.checkedAt),
  preTest: source.preTest.status,
  preTestFinishedAt: iso(source.preTest.finishedAt),
  courseEndReason: source.course.endReason,
  postTest: source.postTest.status,
  postTestBlock: source.postTest.block,
  postTestFinishedAt: iso(source.postTest.finishedAt),
  surveyOpenedAt: iso(source.survey?.openedAt),
  surveyConfirmedAt: iso(source.survey?.confirmedAt),
  withdrawnAt: iso(source.withdrawnAt),
});
