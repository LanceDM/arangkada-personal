/**
 * Drive parity.
 *
 * `drive.golden.json` is an order-sensitive digest of what the world does over
 * every scripted drive in `driveSamples` — one line per frame, covering the
 * car's motion, the active event and its phase, the
 * standing-penalty banners, the size of the composed scene and its solids, and
 * every `GameEvent` reported.
 *
 * The eight tests in `DrivingSession.test.ts` state the invariants a frame must
 * hold. This states something different and blunter: that a frame still does
 * exactly what it did. It is what makes `update` safe to take apart — a
 * reordering that no invariant happens to name still fails here.
 *
 * A failure means the simulation changed. Regenerate deliberately with
 * `npx tsx scripts/captureDriveGolden.ts` only when that was the intent, and
 * say so in the commit.
 */
import { describe, expect, it } from 'vitest';
import { driveSamples, runDrive } from './driveSamples';
import golden from './drive.golden.json';

describe('the drive', () => {
  it('advances exactly as it did, frame for frame', () => {
    const samples = driveSamples();
    expect(samples).toHaveLength(golden.length);

    const mismatches: string[] = [];

    samples.forEach((sample, index) => {
      const expected = golden[index];
      const { lines, digest } = runDrive(sample);
      if (digest === expected.digest && lines.length === expected.lines) return;

      // Name the first frame that diverged: a digest alone says only that
      // something moved, which is no help at all when something has.
      const rerun = runDrive(sample).lines;
      const firstDiff = rerun.findIndex((line, i) => line !== rerun[i]);
      mismatches.push(
        `level ${expected.levelId} seed ${expected.seed}: ` +
          `${lines.length} lines / ${digest} vs expected ${expected.lines} / ${expected.digest}` +
          (firstDiff >= 0 ? ` (first difference at line ${firstDiff})` : '')
      );
    });

    expect(mismatches.join('\n')).toBe('');
    // Ninety-five drives, some of them the length of a level: minutes of
    // simulated driving, and slower still with the whole suite competing for
    // the machine.
  }, 60_000);

  it('is reproducible: the same sample twice is the same drive', () => {
    const sample = driveSamples()[0];
    expect(runDrive(sample).digest).toBe(runDrive(sample).digest);
  });

  it('is the same drive at h = none, with only the road’s markers of the answer left out', () => {
    // A frame line has twenty fields, the sixteenth the number of nodes
    // composed. Support decides what the road marks and nothing else, so with
    // that one field set aside every frame - pose, speed, lane, active event
    // and phase, penalties, solids - and every reported decision is the same.
    const SCENE_SIZE = 15;
    const sceneSize = (line: string) => {
      const fields = line.split(' ');
      return fields.length === 20 ? Number(fields[SCENE_SIZE]) : null;
    };
    const withoutSceneSize = (line: string) => {
      const fields = line.split(' ');
      if (fields.length === 20) fields.splice(SCENE_SIZE, 1);
      return fields.join(' ');
    };

    const moved: string[] = [];
    let withheld = 0;
    for (const sample of driveSamples()) {
      const full = runDrive(sample).lines;
      const none = runDrive(sample, 'none').lines;
      const firstDiff = full.findIndex((line, i) => withoutSceneSize(line) !== withoutSceneSize(none[i] ?? ''));
      if (full.length !== none.length || firstDiff >= 0) {
        moved.push(`level ${sample.levelId} seed ${sample.seed}: first difference at line ${firstDiff}`);
        continue;
      }
      full.forEach((line, i) => {
        const [atFull, atNone] = [sceneSize(line), sceneSize(none[i])];
        if (atFull === null || atNone === null) return;
        if (atNone > atFull) moved.push(`level ${sample.levelId} seed ${sample.seed}: more drawn at none, line ${i}`);
        if (atNone < atFull) withheld++;
      });
    }

    expect(moved.join('\n')).toBe('');
    // And something was actually left out: the gantries over Levels 3 and 4's
    // graded lanes are nodes of their own.
    expect(withheld).toBeGreaterThan(0);
  }, 60_000);
});
