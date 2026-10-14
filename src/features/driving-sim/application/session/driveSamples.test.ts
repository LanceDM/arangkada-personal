/**
 * The recorded drives reach the whole level.
 *
 * `drive.golden.json` is only worth what the drives behind it covered, and for
 * a long time that was less than it looked. The harness reported each decision
 * and settled it on the world, but never fired the verdict edges the real host
 * fires — so the machine stayed in the state the event had been graded in, no
 * later event could open an approach, and every recorded drive pinned its
 * level's first scenario and nothing after it.
 *
 * These are the assertions that stop the golden quietly covering an opening.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { driveSamples, runDrive } from './driveSamples';

/** Decisions a recorded drive reported, by the event they were about. */
const decisionsIn = (lines: readonly string[]) =>
  lines
    .map(line => /^\d+ decision (\S+) /.exec(line)?.[1])
    .filter((id): id is string => id !== undefined);

describe('a recorded drive', () => {
  it('reaches every scenario of a level it drives to the end of', () => {
    // Level 7 is the sharpest case: seven scenarios, every one answered with
    // the car, none of them a checkpoint or a frozen prompt. The steady sample
    // drives it end to end, so all seven should have been offered and graded —
    // whatever it made of them.
    const level7 = LEVELS.find(level => level.id === 7)!;
    const sample = driveSamples().find(
      entry => entry.levelId === 7 && entry.style === 'commute'
    )!;
    const { lines } = runDrive(sample);

    expect(lines.some(line => / finished$/.test(line)), 'the drive never reached the end').toBe(true);
    const graded = new Set(decisionsIn(lines));
    expect(level7.events.filter(event => !graded.has(event.id)).map(event => event.id)).toEqual([]);
  });

  it('grades more than the first scenario of every level', () => {
    // The bug this pins: the harness settled each decision on the world but
    // never fired the verdict edges the real host fires, so the machine stayed
    // in the state the event had been graded in and no later event could open
    // an approach. Every recorded drive stopped after one.
    const perLevel = new Map<number, Set<string>>();
    for (const sample of driveSamples()) {
      const graded = perLevel.get(sample.levelId) ?? new Set<string>();
      for (const id of decisionsIn(runDrive(sample).lines)) graded.add(id);
      perLevel.set(sample.levelId, graded);
    }

    const shallow = [...perLevel.entries()]
      .filter(([, graded]) => graded.size < 2)
      .map(([levelId, graded]) => `level ${levelId}: ${graded.size} graded across every sample`);
    expect(shallow).toEqual([]);
    // Every sample in the golden, replayed: minutes of simulated driving.
  }, 60_000);

  it('records one verdict for every decision it reports', () => {
    // Reaction latency — the observable theta is optimised against — is only
    // recorded when a verdict edge fires, so a decision graded without one is a
    // decision the thesis cannot see.
    const sample = driveSamples().find(
      entry => entry.levelId === 7 && entry.style === 'commute'
    )!;
    const { lines } = runDrive(sample);
    expect(decisionsIn(lines).length).toBe(LEVELS.find(level => level.id === 7)!.events.length);
  });
});
