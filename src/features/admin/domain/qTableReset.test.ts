import { describe, expect, it } from 'vitest';
import { emptyQTable } from '@/domain/competencyRouting/qLearning';
import { qTableReset, tableIsEmpty } from './qTableReset';

describe('resetting the shared Q-table', () => {
  const learned = { ...emptyQTable(), 'M1-failed': { practice: { q: 0.4, n: 3, visits: 5 } } };
  const admin = { uid: 'lance', email: null };

  it('empties the table and keeps it whole, with the log counter carried on', () => {
    const { resetId, record, table } = qTableReset({ table: learned, updates: 41, configVersion: 'v3' }, admin, '  test play  ', 1700);
    expect(resetId).toBe('reset-1700');
    expect(tableIsEmpty(table)).toBe(true);
    expect(record.tableBefore).toEqual(learned);
    expect(record.updatesBefore).toBe(41);
    expect(record.fromGlobalSeq).toBe(42);
    expect(record.note).toBe('test play');
    expect(record.configVersionBefore).toBe('v3');
  });

  it('knows an empty table from a learned one', () => {
    expect(tableIsEmpty(emptyQTable())).toBe(true);
    expect(tableIsEmpty(null)).toBe(true);
    expect(tableIsEmpty(learned)).toBe(false);
  });
});
