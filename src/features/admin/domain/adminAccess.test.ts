import { describe, expect, it } from 'vitest';
import { adminRoster, grantRefusal, revokeRefusal, type PageAdminEntry, type RoleGrantRecord } from './adminAccess';

const entry = (uid: string, email: string): PageAdminEntry => ({
  uid, email, name: null, grantedBy: 'boss', grantedByEmail: 'boss@example.com', grantedAt: 10, reason: 'team',
});
const grant = (uid: string, action: 'grant' | 'revoke', at: number, via: string | null = null): RoleGrantRecord => ({
  uid, email: `${uid}@example.com`, action, by: 'lance', at, reason: null, via,
});

describe('who has admin access (2026-11-18)', () => {
  it("lists the page's admins and the script's, each once", () => {
    const roster = adminRoster(
      [entry('b', 'b@example.com')],
      [grant('a', 'grant', 1), grant('b', 'grant', 2), grant('c', 'grant', 3), grant('c', 'revoke', 4), grant('d', 'grant', 5, 'admin-page')]
    );
    expect(roster.map(row => [row.uid, row.source])).toEqual([
      ['a', 'script'],
      ['b', 'page'],
    ]);
  });

  it("follows the script's records in time order, whatever order they arrive in", () => {
    expect(adminRoster([], [grant('a', 'revoke', 5), grant('a', 'grant', 1)])).toEqual([]);
    expect(adminRoster([], [grant('a', 'grant', 5), grant('a', 'revoke', 1)]).map(row => row.uid)).toEqual(['a']);
  });

  it('never makes a study participant an admin, nor an admin twice', () => {
    const roster = adminRoster([entry('b', 'b@example.com')], []);
    expect(grantRefusal({ uid: 'p', email: null, label: 'P-0001', code: 'P-0001' }, roster)).toMatch(/participants/);
    expect(grantRefusal({ uid: 'b', email: 'b@example.com', label: 'b', code: null }, roster)).toMatch(/already/);
    expect(grantRefusal({ uid: 'x', email: 'x@example.com', label: 'x', code: null }, roster)).toBeNull();
  });

  it('removes only a page admin, and never your own access', () => {
    const roster = adminRoster([entry('b', 'b@example.com')], [grant('a', 'grant', 1)]);
    const target = (uid: string) => ({ uid, email: `${uid}@example.com`, label: uid, code: null });
    expect(revokeRefusal(target('b'), roster, 'me')).toBeNull();
    expect(revokeRefusal(target('b'), roster, 'b')).toMatch(/your own/);
    expect(revokeRefusal(target('a'), roster, 'me')).toMatch(/db:role -- revoke a@example.com/);
    expect(revokeRefusal(target('z'), roster, 'me')).toMatch(/not an admin/);
  });
});
