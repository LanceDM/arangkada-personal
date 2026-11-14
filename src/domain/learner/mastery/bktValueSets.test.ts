import { describe, expect, it } from 'vitest';
import { DEFAULT_BKT_MODEL } from './buildBKTProfile';
import { editedStartSetId, setLabel, startProblems, withStart } from './bktValueSets';

describe('an edited start before the pre-test', () => {
  it('changes only P(L0), and drops per-competency starts', () => {
    const calibrated = { ...DEFAULT_BKT_MODEL, pInit: 0.2, pInitBy: { parking: 0.4 } };
    const edited = withStart(calibrated, 0.5);
    expect(edited.pInit).toBe(0.5);
    expect(edited.pInitBy).toBeUndefined();
    expect(edited.drive).toEqual(calibrated.drive);
    expect(edited.quiz).toEqual(calibrated.quiz);
    expect(calibrated.pInitBy).toEqual({ parking: 0.4 });
  });

  it('accepts a start from 0.01 to 0.99 only', () => {
    expect(startProblems(0.3)).toEqual([]);
    expect(startProblems(0.99)).toEqual([]);
    expect(startProblems(0)).toHaveLength(1);
    expect(startProblems(1)).toHaveLength(1);
    expect(startProblems(Number.NaN)).toHaveLength(1);
  });

  it('is named Edited start N, numbered with the calibrations', () => {
    expect(editedStartSetId(2)).toBe('set-2');
    expect(setLabel('set-2')).toBe('Edited start 2');
    expect(setLabel('cal-1')).toBe('Calibration 1');
    expect(setLabel('default')).toBe('Default values');
  });
});
