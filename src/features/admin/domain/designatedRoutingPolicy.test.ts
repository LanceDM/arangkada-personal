/**
 * The Optimized group's table is the designated one, read from its table file
 * exactly as recorded, and nothing else is accepted.
 */
import { describe, expect, it } from 'vitest';
import designated from './designatedRoutingTable.json';
import { designatedRoutingPolicyOf, routingTableId } from './designatedRoutingPolicy';

describe('the designated routing table', () => {
  it('is seed 11\'s table, 553a49a0, as the table file records it, at the 336 decisions it was trained at', () => {
    const policy = designatedRoutingPolicyOf(designated);
    const recorded = designated.tables.find(table => table.seed === 11)!;
    expect(policy.tableId).toBe('553a49a0');
    expect(designated.designatedTable).toMatchObject({ seed: 11, tableId: '553a49a0' });
    expect(policy.seed).toBe(11);
    expect(policy.table).toEqual(recorded.table);
    expect(routingTableId(policy.table)).toBe('553a49a0');
    expect(policy.budgetSize).toBe(336);
  });

  it('refuses a table that does not hash to the id the file records', () => {
    const tampered = structuredClone(designated);
    const table = tampered.tables.find(entry => entry.seed === 11)!.table as Record<string, string[]>;
    table['middle:critical:passed:more'] = ['none'];
    expect(() => designatedRoutingPolicyOf(tampered)).toThrow(/hashes to/);
  });

  it('refuses a budget in any unit but graded decisions, and a seed with no table', () => {
    const entries = structuredClone(designated);
    entries.parameters.budget.unit = 'entries';
    expect(() => designatedRoutingPolicyOf(entries)).toThrow(/graded decisions/);
    expect(() => designatedRoutingPolicyOf({ ...designated, designatedTable: { seed: 99, tableId: '553a49a0' } })).toThrow(/no table/);
  });
});
