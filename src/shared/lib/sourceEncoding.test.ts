/**
 * No source file carries text that was decoded in the wrong encoding.
 *
 * A UTF-8 emoji or dash read as Windows-1252 and saved again becomes a run of
 * Latin letters (the quiz's book emoji showed as such a run on the results
 * screen). The patterns are written as escapes so this file never matches
 * itself.
 */
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const MOJIBAKE = [
  'ðŸ', // a four-byte emoji's lead bytes
  'â€', // a dash, quote or ellipsis
  'Ã', // an accented Latin letter
];

describe('source encoding', () => {
  it('reads every source file', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
  });

  it('has no mojibake in any source file', () => {
    const hits = Object.entries(sources).flatMap(([path, text]) =>
      MOJIBAKE.filter(pattern => text.includes(pattern)).map(pattern => `${path}: ${JSON.stringify(pattern)}`)
    );
    expect(hits).toEqual([]);
  });
});
