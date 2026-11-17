import { describe, expect, it } from 'vitest';
import { consentRecords } from './consentRecords';
import { STUDY_EXPORT_COLUMNS, studyExportRow, studySummaryLine, type StudyExportSource } from './studyExport';

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

describe("the export's summary line", () => {
  it("reads the participant's study row and course progress, never a routing frontier or the pilot post-test", () => {
    // T-0001 on 2026-11-17: at the final exam, post-test not yet open. The old
    // line read the frozen routing cursor ("frontier DRIVE(5)") and the pilot's
    // post-test flag ("no-post-test").
    const progress = { started: true, frontierLevel: 12, endReason: null };
    const row = studyExportRow(source({ code: 'T-0001', cohort: 'test', course: progress }));
    const line = studySummaryLine(row, progress, 31, ['timed-out']);
    expect(line).toContain(`stage ${row.stage}`);
    expect(line).toContain('level 12');
    expect(line).toContain(`pre-test ${row.preTest}`);
    expect(line).toContain(`post-test ${row.postTest}`);
    expect(line).toContain('drives  31');
    expect(line).toContain('[timed-out]');
    expect(line).not.toMatch(/frontier|DRIVE\(|no-post-test/);
  });

  it('names a certified course, an unstarted one and a routed post-test', () => {
    const certified = { started: true, frontierLevel: null, endReason: 'certified' as const };
    const done = studyExportRow(source({ course: certified, postTest: { status: 'finished', finishedAt: T + 9, block: 'medium' } }));
    expect(studySummaryLine(done, certified, 40)).toMatch(/certified .*post-test finished \(medium\)$/);
    const fresh = { started: false, frontierLevel: 0, endReason: null };
    expect(studySummaryLine(studyExportRow(source({ course: fresh })), fresh, 0)).toContain('not started');
  });
});
