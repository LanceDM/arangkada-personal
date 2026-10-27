// Characterizes the routing FSM (`src/domain/routing`) as data and prints a
// structural report. The routing machine's counterpart of `characterizeFsm.ts`.
//
//   npm run routing:check           compares against the committed golden;
//                                   writes nothing, exits non-zero on a
//                                   difference or on any structural defect.
//   npm run routing:update-golden   accepts the current machine as the
//                                   baseline - refused while it has a defect.
//
// A defect is anything the machine's definition of done rules out: a state unreachable from
// the tutorial, a state other than CERTIFIED with no way out, a state from
// which CERTIFIED cannot be reached, a transition with two targets, or `step`
// accepting what `legalTransitions` did not list.
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { characterizeRouting, structuralDefects } from '@/domain/routing/characterizeRouting';

const write = process.argv.includes('--write');

const characterization = characterizeRouting();
const { structure, scenarios } = characterization;
const defects = structuralDefects(structure);

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'domain', 'routing', 'routingCharacterization.golden.json'
);
const serialized = JSON.stringify(characterization, null, 2) + '\n';

console.log('=== Routing FSM characterization ===\n');
console.log(`Control states: ${structure.controlStateCount}`);
console.log(`States (reviews by return point): ${structure.stateCount}`);
console.log(`Reachable from ${structure.initial}: ${structure.reachableStates.length}`);
console.log(`Terminal: ${structure.terminalStates.join(', ') || 'none'}`);
console.log(`Transition labels: ${structure.alphabetSize}`);
console.log(`Table rows: ${structure.tableRows}`);
console.log(`Cells probed: ${structure.cellsProbed}   (states x verdicts x probes)`);
console.log(`Scenario runs: ${scenarios.length}`);
console.log('\nLegal moves offered per row, across all cells:');
console.table(structure.legalMovesPerRow);

if (defects.length > 0) {
  console.error('\n--- Structural defects ---');
  for (const defect of defects) console.error(`- ${defect}`);
  process.exitCode = 1;
} else {
  console.log('\nNo structural defects: every state reachable, no dead cell, no trap, one target per (state, transition), step agrees with legalTransitions.');
}

const shown = relative(process.cwd(), outputPath);

if (write) {
  if (defects.length > 0) {
    console.error(`\nNot writing ${shown}: a golden is not accepted over a defect.`);
  } else {
    writeFileSync(outputPath, serialized);
    console.log(`\nWrote golden characterization to ${shown}`);
  }
} else {
  // Read-only by default. The golden is committed with LF endings; a checkout
  // with core.autocrlf hands it back with CRLF, which is not a change.
  const committed = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
  if (committed === serialized) {
    console.log(`\nMatches the committed golden (${shown}).`);
  } else {
    console.error(
      `\nThe routing machine no longer matches ${shown}.\n` +
        'If that was intended, accept it with `npm run routing:update-golden` and say so in the commit.'
    );
    process.exitCode = 1;
  }
}
