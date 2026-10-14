// The routing FSM against its committed golden, section by section, and
// against its definition of done. Regenerate the golden only
// for an intended change, with `npm run routing:update-golden`, and say so in
// the commit.
import { describe, it, expect } from 'vitest';
import { characterizeRouting, structuralDefects, OUTCOMES, PROBE_NAMES } from './characterizeRouting';
import type { RoutingCharacterization } from './characterizeRouting';
import { ROUTING_STATES } from './routingTypes';
// Imported rather than read from disk: this file is compiled by
// tsconfig.app.json, which has no node types.
import goldenJson from './routingCharacterization.golden.json';

const golden = goldenJson as unknown as RoutingCharacterization;
const current = characterizeRouting();

describe('the routing FSM matches its golden', () => {
  it('has the same course, states and alphabet', () => {
    expect(current.course).toEqual(golden.course);
  });

  it('has the same table and probes', () => {
    expect(current.table).toEqual(golden.table);
    expect(JSON.parse(JSON.stringify(current.probes))).toEqual(golden.probes);
  });

  it('lists the same legal moves in every cell', () => {
    expect(current.core).toEqual(golden.core);
  });

  it('walks the same scripted courses to the same logs', () => {
    expect(current.scenarios).toEqual(golden.scenarios);
  });

  it('has the same structure', () => {
    expect(current.structure).toEqual(golden.structure);
  });
});

describe("the machine's definition of done", () => {
  it('has every state reachable, no dead or trap state, one target per transition, and step agreeing with the list', () => {
    expect(structuralDefects(current.structure)).toEqual([]);
  });

  it('probes every state under both verdicts and every probe', () => {
    expect(Object.keys(current.core)).toHaveLength(ROUTING_STATES.length * OUTCOMES.length * PROBE_NAMES.length);
  });

  it('is deterministic across runs', () => {
    expect(characterizeRouting()).toEqual(current);
  });
});
