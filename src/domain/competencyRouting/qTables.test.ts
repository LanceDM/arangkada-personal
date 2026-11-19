import { describe, expect, it } from 'vitest';
import { qTableDocId, qTableRoute } from './qTables';

describe('which Q-table a player uses (2026-11-19)', () => {
  it('keeps the study to its own table, and copies its learning to the public one', () => {
    expect(qTableRoute('study')).toEqual({ decides: 'study', teaches: ['study', 'public'] });
  });

  it('keeps the dry run and the test apart', () => {
    expect(qTableRoute('dryrun')).toEqual({ decides: 'dryrun', teaches: ['dryrun'] });
    expect(qTableRoute('test')).toEqual({ decides: 'test', teaches: ['test'] });
  });

  it('puts everyone else on the public table', () => {
    expect(qTableRoute(null)).toEqual({ decides: 'public', teaches: ['public'] });
  });

  it('leaves the study table at the path every table had before', () => {
    expect(qTableDocId('study')).toBe('competencyQ');
    expect(qTableDocId('public')).toBe('competencyQ_public');
  });
});
