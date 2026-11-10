import { describe, expect, it } from 'vitest';
import { consentRecords } from './consentRecords';
import { STUDY_EXPORT_COLUMNS, studyExportRow, type StudyExportSource } from './studyExport';

const T = Date.UTC(2026, 10, 5, 8);
const { marker } = consentRecords({ participantCode: 'P-0003', fullName: 'Juan dela Cruz', typedSignature: 'Juan dela Cruz', age: 27, language: 'en', at: T });

const source = (over: Partial<StudyExportSource> = {}): StudyExportSource => ({
  code: 'P-0003',
  cohort: 'study',
  enrolledAt: T - 60_000,
  withdrawnAt: null,
  consent: marker,
  background: { schemaVersion: 1, gaming: 'weekly', device: 'phone', answeredAt: T + 1 },
  device: {
    schemaVersion: 1, touch: true, landscape: true, viewport: { width: 915, height: 412 }, medianFps: 58, slow: false,
    controls: { accelerate: true, brake: true, left: true, right: true }, checkedAt: T + 2,
  },
  survey: null,
  preTest: { status: 'finished', finishedAt: T + 3_600_000 },
  postTest: { status: 'none', finishedAt: null, block: null },
  course: { started: true, frontierLevel: 4, endReason: null },
  ...over,
});

describe("the study's export row", () => {
  it("is each participant's steps by code, cohort and stage, with the age band and no exact age", () => {
    const row = studyExportRow(source());
    expect(row).toMatchObject({
      code: 'P-0003', cohort: 'study', stage: 'levels', ageBand: '25-34', gaming: 'weekly', device: 'phone',
      deviceTouch: true, deviceMedianFps: 58, deviceSlow: false, preTest: 'finished', postTest: 'none', withdrawnAt: null,
    });
    expect(row.consentedAt).toBe(new Date(T).toISOString());
    expect(Object.keys(row).sort()).toEqual([...STUDY_EXPORT_COLUMNS].sort());
  });

  it('carries no name, exact age, username or email, by its columns and its values', () => {
    const text = JSON.stringify(studyExportRow(source()));
    expect(text).not.toMatch(/Juan|dela Cruz|"age"|27|@|username|email/i);
  });

  it('names a participant who has not consented, and one who withdrew', () => {
    expect(studyExportRow(source({ consent: null, background: null, device: null, preTest: { status: 'none', finishedAt: null } }))).toMatchObject({
      stage: 'consent', ageBand: null, gaming: null,
    });
    expect(studyExportRow(source({ withdrawnAt: T + 5 })).stage).toBe('withdrawn');
  });
});
