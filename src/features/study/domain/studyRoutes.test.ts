import { describe, expect, it } from 'vitest';
import { STUDY_STAGES } from '@/domain/study/studyStage';
import { surveyConfigured, surveyLink } from './studyConfig';
import { nextStepOf, studyAccountMayVisit } from './studyRoutes';

describe("a participant's paths", () => {
  it('always include the study pages, Settings and the auth links', () => {
    for (const stage of [...STUDY_STAGES, 'withdrawn', null] as const) {
      for (const path of ['/study', '/study/consent', '/settings', '/auth/reset-password']) {
        expect(studyAccountMayVisit(stage, path), `${stage} ${path}`).toBe(true);
      }
    }
  });

  it('open each test and Story Mode only at its own stage', () => {
    expect(studyAccountMayVisit('pre-test', '/play/pre-test')).toBe(true);
    expect(studyAccountMayVisit('tutorial', '/play/pre-test')).toBe(false);
    expect(studyAccountMayVisit('post-test', '/play/post-test')).toBe(true);
    expect(studyAccountMayVisit('levels', '/play/post-test')).toBe(false);
    for (const stage of ['tutorial', 'levels', 'final'] as const) {
      expect(studyAccountMayVisit(stage, '/play/story')).toBe(true);
      expect(studyAccountMayVisit(stage, '/play/story/3/briefing')).toBe(true);
    }
    for (const stage of ['consent', 'device', 'pre-test', 'post-test', 'done', 'withdrawn'] as const) {
      expect(studyAccountMayVisit(stage, '/play/story')).toBe(false);
    }
  });

  it('never include the Mock Exam, the Daily Challenge, the lesson reader, the mode menu or the admin area', () => {
    for (const path of ['/', '/play', '/play/eksamen', '/play/daily', '/learn/3', '/admin', '/admin/pilot', '/play/storyline']) {
      for (const stage of STUDY_STAGES) expect(studyAccountMayVisit(stage, path), `${stage} ${path}`).toBe(false);
    }
  });

  it('give every stage but a withdrawal one next step, the course entered by Continue', () => {
    for (const stage of STUDY_STAGES) expect(nextStepOf(stage)).not.toBeNull();
    expect(nextStepOf('withdrawn')).toBeNull();
    expect(nextStepOf('levels')).toMatchObject({ to: '/play/story', continueCourse: true });
    expect(nextStepOf('pre-test')).toMatchObject({ to: '/play/pre-test', continueCourse: false });
  });
});

describe('the survey link', () => {
  it('carries the code alone, and is not ready until the team supplies the form', () => {
    expect(surveyConfigured()).toBe(false);
    const link = new URL(surveyLink('P-0007', 'https://docs.google.com/forms/d/e/abc/viewform', 'entry.123'));
    expect(link.searchParams.get('entry.123')).toBe('P-0007');
    expect(link.searchParams.get('usp')).toBe('pp_url');
    expect([...link.searchParams.keys()].sort()).toEqual(['entry.123', 'usp']);
  });
});
