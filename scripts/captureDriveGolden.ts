/**
 * Records what a drive does, frame by frame, as an order-sensitive digest, and
 * writes the golden `DrivingSession.golden.test.ts` asserts against.
 *
 * Run it only when a change to the simulation is intended, and say so in the
 * commit: the point of the golden is that an unintended change to how the world
 * advances fails a test.
 *
 * Run: `npx tsx scripts/captureDriveGolden.ts`
 */
import { writeFileSync } from 'fs';
import { driveSamples, runDrive } from '../src/features/driving-sim/application/session/driveSamples';

const golden = driveSamples().map(sample => {
  const { lines, digest } = runDrive(sample);
  return { levelId: sample.levelId, seed: sample.seed, frames: sample.frames, lines: lines.length, digest };
});

const target = 'src/features/driving-sim/application/session/drive.golden.json';
writeFileSync(target, `${JSON.stringify(golden, null, 1)}\n`);

const totalLines = golden.reduce((sum, row) => sum + row.lines, 0);
console.log(`Wrote ${golden.length} drive samples (${totalLines} recorded lines) to ${target}`);
