import { describe, expect, it } from 'vitest';
import { answerHint, shownKeys } from './inputMode';

describe('the keys the screen names', () => {
  it('are unchanged for a keyboard', () => {
    expect(shownKeys(['↓', 'S', 'Space'], 'keys')).toEqual(['↓', 'S', 'Space']);
    expect(shownKeys(['H'], 'keys')).toEqual(['H']);
  });

  it('are the touch controls, once each, on a touch screen', () => {
    expect(shownKeys(['↓', 'S', 'Space'], 'touch')).toEqual(['↓']);
    expect(shownKeys(['↑', 'W'], 'touch')).toEqual(['↑']);
    expect(shownKeys(['←', 'A'], 'touch')).toEqual(['←']);
    expect(shownKeys(['→', 'D'], 'touch')).toEqual(['→']);
  });

  it('drop the horn on a touch screen, which has no button for it', () => {
    expect(shownKeys(['H'], 'touch')).toEqual([]);
  });

  it('tell a touch player to tap, and a keyboard player about the number keys', () => {
    expect(answerHint('touch')).toBe('Tap an answer');
    expect(answerHint('keys')).toMatch(/number key/);
  });
});
