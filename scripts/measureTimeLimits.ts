/**
 * Measures every level's time limit again and writes the table
 * (`levelTimeLimits.json`) that `timeLimit.test.ts` holds to the content.
 * Run it after a change to a level's road, a scenario or a speed, and say so
 * in the commit.
 *
 * Run: `npm run time-limits:update`
 *
 * It refuses to write when the reference driver gets a roll wrong: a wrong
 * drive measures nothing.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { LEVELS } from '../src/features/driving-sim/domain/scenario/levelCatalog';
import { measureLevelTimeLimit, ROLL_SEEDS, whyNotCorrect } from '../src/features/driving-sim/application/session/timeLimitMeasurement';

const target = 'src/features/driving-sim/domain/scenario/levelTimeLimits.json';
const previous = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>;

const commit = (() => {
  try {
    const head = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain').toString().trim().length > 0;
    return `${head}${dirty ? '+dirty' : ''}`;
  } catch {
    return 'unknown';
  }
})();

const rows = [];
let failed = false;
for (const { id } of LEVELS) {
  const { row, failures } = measureLevelTimeLimit(id);
  for (const failure of failures) {
    failed = true;
    console.error(`Level ${id}, roll ${failure.roll ?? '-'}${failure.item ? `, ${failure.item}` : ''}: ${whyNotCorrect(failure.result)}`);
  }
  console.log(`Level ${id}: ${row.limitSeconds} s (longest ${row.longestSteps} steps, ${row.drives} drives${row.unpassed.length ? `, ${row.unpassed.length} unpassed items` : ''})`);
  rows.push(row);
}
if (failed) {
  console.error('Not written: the reference driver got a roll wrong.');
  process.exit(1);
}

const record = {
  ...previous,
  method:
    'Twice the longest correct reference drive (application/session/referenceDrive.ts), rounded up to the next 30 s; driving steps at 60 a second, held steps not counted; over every roll seed of a pooled level, every practice item the level can take on its longest roll, and every whole-stage course drive (composeDrive) over the roll seeds.',
  measuredOn: new Date().toISOString().slice(0, 10),
  commit,
  rollSeeds: [...ROLL_SEEDS],
  levels: rows,
};
writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Wrote ${rows.length} levels to ${target}`);
