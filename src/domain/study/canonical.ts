/**
 * A stable text form of plain data: keys sorted at every level, `undefined`
 * dropped (as Firestore and JSON drop it), so two copies of the same record
 * compare equal however they were built or stored.
 */
export const canonicalJSON = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(item => (item === undefined ? 'null' : canonicalJSON(item))).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
