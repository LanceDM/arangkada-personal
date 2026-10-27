// Characterizes `DrivingFSM` as data and prints a structural report.
//
//   npm run fsm:check          compares against the committed golden; writes
//                              nothing, exits non-zero on a difference.
//   npm run fsm:update-golden   accepts the current machine as the baseline.
//
// The workflow this supports:
//   1. Before any FSM change: `fsm:check` should be clean. That golden is the
//      baseline machine, captured as data.
//   2. Make the change.
//   3. `npm run test` - equivalence.test.ts re-derives the characterization and
//      diffs it against the golden. A `core` or `scenarios` diff is a
//      regression and should fail. An `annotations`/`structure` diff is the
//      intended minimization result.
//   4. `fsm:update-golden` to accept the intended diff, and review it in
//      `git diff` - that diff is the before/after evidence for the write-up.
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { characterizeFsm } from '@/features/driving-sim/domain/fsm/characterize';

const write = process.argv.includes('--write');

const characterization = characterizeFsm();
const { structure, core, operations, scenarios } = characterization;

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'features', 'driving-sim', 'domain', 'fsm', 'characterization.golden.json'
);
const serialized = JSON.stringify(characterization, null, 2) + '\n';

console.log('=== DrivingFSM characterization ===\n');
console.log(`Declared states:        ${structure.reachableStates.length + structure.unreachableStates.length}`);
console.log(`Reachable states:       ${structure.reachableStates.length}`);
console.log(`Unreachable states:     ${structure.unreachableStates.length}`+
  (structure.unreachableStates.length ? `  -> ${structure.unreachableStates.join(', ')}` : ''));
console.log(`Declared transitions:   ${structure.transitionCount}`);
console.log(`Shadowed transitions:   ${structure.shadowedTransitions.length}`);
console.log(`Unreachable transitions:${structure.unreachableTransitions.length}`);
console.log(`Core cells probed:      ${core.length}   (reachable states x alphabet)`);
console.log(`Operation cells probed: ${operations.length}`);
console.log(`Scenario runs:          ${scenarios.length}`);

if (structure.shadowedTransitions.length > 0) {
  console.log('\n--- Shadowed transitions (an earlier entry for the same (from, trigger) always wins) ---');
  console.table(structure.shadowedTransitions);
}
if (structure.unreachableTransitions.length > 0) {
  console.log('\n--- Transitions from unreachable states ---');
  console.table(structure.unreachableTransitions);
}
if (structure.triggersWithNoTransitions.length > 0) {
  console.log(`\nTriggers with no transitions at all: ${structure.triggersWithNoTransitions.join(', ')}`);
}
if (structure.triggersNeverFireable.length > 0) {
  console.log(`Triggers only defined from unreachable states: ${structure.triggersNeverFireable.join(', ')}`);
}

const accepted = core.filter(row => row.accepted).length;
console.log(`\nAccepted (state, trigger) pairs: ${accepted} of ${core.length}`);

const shown = relative(process.cwd(), outputPath);

if (write) {
  writeFileSync(outputPath, serialized);
  console.log(`\nWrote golden characterization to ${shown}`);
} else {
  // Read-only by default. A tool that silently rewrites its own baseline
  // cannot be used to check anything.
  // The golden is committed with LF endings; a checkout with core.autocrlf
  // hands it back with CRLF, which is not a change to the machine.
  const committed = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
  if (committed === serialized) {
    console.log(`\nMatches the committed golden (${shown}).`);
  } else {
    console.error(
      `\nThe machine no longer matches ${shown}.\n` +
        'If that was intended, accept it with `npm run fsm:update-golden` and say so in the commit.'
    );
    process.exitCode = 1;
  }
}
