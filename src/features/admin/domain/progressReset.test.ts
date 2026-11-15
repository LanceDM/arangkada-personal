import { describe, expect, it } from 'vitest';
import { RESET_DOCUMENTS, RESET_SITTING_KINDS, resetIdAt, resetRefusal, totalArchived } from './progressReset';

describe('a course reset', () => {
  it('refuses a study participant, by code or by enrolment', () => {
    expect(resetRefusal({ uid: 'u1', label: 'Tester', code: null }, false)).toBeNull();
    expect(resetRefusal({ uid: 'u2', label: 'P-0001', code: 'P-0001' }, false)).toMatch(/participant/);
    expect(resetRefusal({ uid: 'u3', label: 'enrolled', code: null }, true)).toMatch(/participant/);
  });

  it('clears the course but keeps the pre-test, post-test and the pilot group', () => {
    expect(RESET_SITTING_KINDS).toEqual(['quiz']);
    const docs = RESET_DOCUMENTS.map(([c, id]) => `${c}/${id}`);
    expect(docs).toContain('routing/competencyCourse');
    expect(docs).not.toContain('routing/assignment');
    expect(docs).not.toContain('state/evidence');
  });

  it('names a reset by when it began, and counts what it archived', () => {
    expect(resetIdAt(1700)).toBe('reset-1700');
    expect(totalArchived({ attempts: 3, courseLog: 2 })).toBe(5);
  });
});
