import { describe, expect, it } from 'vitest';
import { createInputRecorder, inputTelemetryDoc, summarizeInputs } from './controlInputs';

describe('the drive input log', () => {
  it('records each press and release once, with its time, and ignores auto-repeat', () => {
    let now = 1_000;
    const recorder = createInputRecorder(() => now);
    now = 1_250;
    recorder.press('ArrowUp');
    now = 1_300;
    recorder.press('ArrowUp'); // auto-repeat of a held key
    now = 1_900;
    recorder.release('ArrowUp');
    recorder.release('ArrowUp'); // a release with nothing held
    now = 2_000;
    recorder.press(' ');
    expect(recorder.snapshot()).toEqual([
      { t: 250, key: 'ArrowUp', down: true },
      { t: 900, key: 'ArrowUp', down: false },
      { t: 1_000, key: ' ', down: true },
    ]);
    expect(summarizeInputs(recorder.snapshot())).toEqual({ presses: { ArrowUp: 1, ' ': 1 }, total: 2 });
  });

  it('keeps the earliest inputs and says so when a drive is longer than one document holds', () => {
    const inputs = Array.from({ length: 5 }, (_, i) => ({ t: i, key: 'w', down: i % 2 === 0 }));
    expect(inputTelemetryDoc(inputs, 3)).toEqual({ schemaVersion: 1, inputs: inputs.slice(0, 3), truncated: true, totalCount: 5 });
    expect(inputTelemetryDoc(inputs).truncated).toBe(false);
  });
});
