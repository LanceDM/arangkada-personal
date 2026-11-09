import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '@/features/driving-sim/domain/world/InputState';
import { describeUsage, readHeldInput, unusedInput } from './heldInput';
import { readInput } from './keyboardInput';
import { TouchInput } from './touchInput';

describe('the frame input from keyboard and touch together', () => {
  it('is exactly the keyboard reading when no finger is down', () => {
    const keySets = [[], ['ArrowUp'], ['s', 'ArrowLeft'], [' ', 'H'], ['d', 'W']];
    for (const names of keySets) {
      const keys = new Set(names);
      expect(readHeldInput(keys, new TouchInput(), unusedInput())).toEqual(readInput(keys));
      expect(readHeldInput(keys, undefined, unusedInput())).toEqual(readInput(keys));
    }
  });

  it('adds the pads to the keys, input by input', () => {
    const touch = new TouchInput();
    touch.press(1, 'brake');
    expect(readHeldInput(new Set(['ArrowLeft']), touch, unusedInput())).toEqual({
      ...NO_INPUT,
      left: true,
      brake: true,
    });
  });

  it('records which controls the car was driven with', () => {
    const usage = unusedInput();
    const touch = new TouchInput();
    readHeldInput(new Set(), touch, usage);
    expect(describeUsage(usage)).toBe('none');

    readHeldInput(new Set(['ArrowUp']), touch, usage);
    expect(describeUsage(usage)).toBe('keyboard');

    touch.press(1, 'left');
    readHeldInput(new Set(), touch, usage);
    expect(describeUsage(usage)).toBe('both');

    const touchOnly = unusedInput();
    readHeldInput(new Set(), touch, touchOnly);
    expect(describeUsage(touchOnly)).toBe('touch');
  });

  it('does not count a key the car does not read as driving', () => {
    const usage = unusedInput();
    readHeldInput(new Set(['1', 'Enter', 'Tab']), undefined, usage);
    expect(describeUsage(usage)).toBe('none');
  });
});
