// The designated routing table, read from its table file exactly as recorded.
//
// The game's Optimized group plays the learned policy with this table, and
// nothing else: seed 11's table, `553a49a0`, chosen in simulation and never
// retrained. The file is admin's because admin reports the evidence; the game
// reaches the table only through the composition root, which hands it to
// Driving Sim.
import type { RoutingTable } from '@/domain/learner/adaptive/routingQPolicy';

/** The parts of `designatedRoutingTable.json` the table is read from. */
export interface RoutingResultsFile {
  parameters: { budget: { unit: string; size: number } };
  tables: ReadonlyArray<{ seed: number; tableId: string; table: unknown }>;
  designatedTable: { seed: number; tableId: string };
}

export interface DesignatedRoutingPolicy {
  table: RoutingTable;
  tableId: string;
  seed: number;
  /** The budget the table was trained under, in graded decisions. */
  budgetSize: number;
}

/** FNV-1a over a table's JSON, as eight hex digits: the hash every trained table is named by. */
export const routingTableId = (table: unknown): string => {
  const text = JSON.stringify(table);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * The designated table, checked against the id the file records for it.
 * Anything else - a table that hashes differently, a budget in another unit -
 * is refused rather than played, because it would not be the policy the
 * simulation evaluated.
 */
export const designatedRoutingPolicyOf = (results: RoutingResultsFile): DesignatedRoutingPolicy => {
  const { seed, tableId } = results.designatedTable;
  const entry = results.tables.find(candidate => candidate.seed === seed);
  if (!entry) throw new Error(`the table file holds no table for the designated seed ${seed}`);
  const hashed = routingTableId(entry.table);
  if (entry.tableId !== tableId || hashed !== tableId) {
    throw new Error(`the designated table is ${tableId}, but seed ${seed}'s table hashes to ${hashed}`);
  }
  if (results.parameters.budget.unit !== 'decisions') {
    throw new Error(`the table's budget is in ${results.parameters.budget.unit}, not graded decisions`);
  }
  return { table: entry.table as RoutingTable, tableId, seed, budgetSize: results.parameters.budget.size };
};
