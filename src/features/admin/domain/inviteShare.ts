/**
 * The message an invite is sent with, by email or pasted into a chat
 * (2026-11-18). There is no mail server: the admin's own email app sends it,
 * opened with everything filled in. Several recipients go in BCC, so nobody
 * sees who else was invited.
 */
import { formatInviteCode } from '@/domain/study/participantCode';

export interface InviteMessage {
  subject: string;
  body: string;
}

/** The invite in English and Filipino, with its link and code. */
export const inviteMessage = (code: string, link: string): InviteMessage => {
  const shown = formatInviteCode(code);
  return {
    subject: 'Invitation: the Arangkada driving study / Imbitasyon sa pag-aaral ng Arangkada',
    body: [
      'Hello!',
      '',
      "You're invited to take part in the Arangkada study: a driving simulation that helps you prepare for the LTO license exam.",
      '',
      `1. Open this link: ${link}`,
      `2. Choose your language and make your account with a username and password. The invite code is filled in; if it is not, enter: ${shown}`,
      '3. Read the consent form, then follow the steps on the screen.',
      '',
      'Please keep the link to yourself: it is for invited participants only.',
      '',
      '---',
      '',
      'Kumusta!',
      '',
      'Inaanyayahan ka naming sumali sa pag-aaral ng Arangkada: isang driving simulation na tutulong sa iyong maghanda para sa LTO license exam.',
      '',
      `1. Buksan ang link na ito: ${link}`,
      `2. Piliin ang wika at gumawa ng account gamit ang username at password. Nakalagay na ang invite code; kung wala, ilagay ito: ${shown}`,
      '3. Basahin ang consent form, saka sundan ang mga hakbang sa screen.',
      '',
      'Pakiusap, huwag ibahagi ang link: para lamang ito sa mga inimbitahan.',
      '',
      '— The Arangkada team',
    ].join('\n'),
  };
};

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** The addresses typed into the recipients box, split on commas, semicolons or spaces. */
export const parseRecipients = (typed: string): { valid: string[]; invalid: string[] } => {
  const parts = typed.split(/[\s,;]+/).map(part => part.trim()).filter(Boolean);
  const valid = [...new Set(parts.filter(part => EMAIL.test(part)).map(part => part.toLowerCase()))];
  return { valid, invalid: parts.filter(part => !EMAIL.test(part)) };
};

/**
 * A mailto: link that opens the admin's email app with the invite written. One
 * recipient goes in To; several go in BCC.
 */
export const inviteMailto = (recipients: string[], message: InviteMessage): string => {
  const params = new URLSearchParams();
  if (recipients.length > 1) params.set('bcc', recipients.join(','));
  params.set('subject', message.subject);
  params.set('body', message.body);
  // mailto wants %20 for spaces, not URLSearchParams' "+".
  const query = params.toString().replace(/\+/g, '%20');
  return `mailto:${recipients.length === 1 ? encodeURIComponent(recipients[0]) : ''}?${query}`;
};

/**
 * Gmail's compose window in the browser, with the invite written: for admins
 * whose computer has no email app set up for mailto: links (most Windows PCs
 * that use Gmail on the web). Same To / BCC rule as above.
 */
export const inviteGmailUrl = (recipients: string[], message: InviteMessage): string => {
  const params = new URLSearchParams({ view: 'cm', fs: '1' });
  if (recipients.length === 1) params.set('to', recipients[0]);
  else if (recipients.length > 1) params.set('bcc', recipients.join(','));
  params.set('su', message.subject);
  params.set('body', message.body);
  return `https://mail.google.com/mail/?${params.toString()}`;
};
