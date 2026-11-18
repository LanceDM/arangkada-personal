import { describe, expect, it } from 'vitest';
import { inviteGmailUrl, inviteMailto, inviteMessage, parseRecipients } from './inviteShare';

const link = 'https://example.github.io/app/study/join?invite=ABCDEFGHJK';

describe('sending an invite (2026-11-18)', () => {
  it('writes the link and the code, in English and Filipino', () => {
    const { subject, body } = inviteMessage('ABCDEFGHJK', link);
    expect(subject).toContain('Arangkada');
    expect(body.match(new RegExp(link.replace(/[?.]/g, '\\$&'), 'g'))).toHaveLength(2);
    expect(body).toContain('ABCDE-FGHJK');
    expect(body).toContain('Buksan ang link');
  });

  it('reads the addresses typed, and names the ones that are not', () => {
    expect(parseRecipients(' a@x.com, B@x.com;a@x.com  nope ')).toEqual({ valid: ['a@x.com', 'b@x.com'], invalid: ['nope'] });
  });

  it('puts one recipient in To and several in BCC, so nobody sees the others', () => {
    const message = inviteMessage('ABCDEFGHJK', link);
    const one = inviteMailto(['a@x.com'], message);
    expect(one.startsWith('mailto:a%40x.com?')).toBe(true);
    expect(one).not.toContain('bcc=');
    const many = new URL(inviteMailto(['a@x.com', 'b@x.com'], message));
    expect(many.pathname).toBe('');
    expect(many.searchParams.get('bcc')).toBe('a@x.com,b@x.com');
    expect(many.searchParams.get('body')).toContain(link);
    expect(inviteMailto(['a@x.com'], message)).not.toContain('+');
  });

  it("opens Gmail's compose window with the same To / BCC rule", () => {
    const message = inviteMessage('ABCDEFGHJK', link);
    const one = new URL(inviteGmailUrl(['a@x.com'], message));
    expect(one.origin + one.pathname).toBe('https://mail.google.com/mail/');
    expect(one.searchParams.get('view')).toBe('cm');
    expect(one.searchParams.get('to')).toBe('a@x.com');
    expect(one.searchParams.get('bcc')).toBeNull();
    expect(one.searchParams.get('body')).toContain(link);
    const many = new URL(inviteGmailUrl(['a@x.com', 'b@x.com'], message));
    expect(many.searchParams.get('to')).toBeNull();
    expect(many.searchParams.get('bcc')).toBe('a@x.com,b@x.com');
  });
});
