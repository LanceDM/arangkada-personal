/**
 * What one attempt's seed decides, and how each use gets a stream of its own.
 *
 * An attempt has one seed. Everything decided before the drive draws
 * from it: which variant each pooled slot rolls, which practice scenario the
 * adaptive layer picks, and the order every question shows its answers in. Each
 * use mixes the seed with a label of its own, so a draw added to one can never
 * shift what another decides - the roll stays the roll when the practice pick
 * changes how many numbers it takes.
 *
 * Not everything is seeded. The live re-roll mid-drive, the roadside scenery
 * and rough ground's jolt still use `Math.random`, and the drive itself depends
 * on the player's input, which is not stored: the seed reproduces what an
 * attempt contained, never how it was driven.
 */
import { createRng } from '@/shared/lib/rng';

/** FNV-1a over a label, so two uses of one seed draw different numbers. */
const hashLabel = (label: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    hash ^= label.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** The attempt's seed mixed with `label`: the seed one use of it draws from. */
export const mixSeed = (attemptSeed: number, label: string): number =>
  (Math.imul(hashLabel(label), 0x85ebca6b) ^ Math.imul(attemptSeed | 0, 0xc2b2ae35)) >>> 0;

/** The pre-drive decisions that draw from the attempt's seed, besides answer order. */
export type AttemptStream = 'roll' | 'practice';

/** A generator for one of them, reproducible from the seed alone. */
export const attemptStream = (attemptSeed: number, stream: AttemptStream): (() => number) =>
  createRng(mixSeed(attemptSeed, `attempt.${stream}`));
