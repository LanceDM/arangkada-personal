/**
 * What these screens say, in one table for the team to fill. A text
 * with no `fil` shows in English until the team writes it, under
 * the team's style guide. A developers' report lists them.
 */
import type { Localized } from '@/shared/lib/localized';

export const passwordMessages = {
  theTwoNewPasswords: { en: 'The two new passwords differ.', fil: 'Magkaiba ang dalawang bagong password.' },
  yourPasswordIsChanged: { en: 'Your password is changed.', fil: 'Napalitan na ang iyong password.' },
  couldNotChangeIt: { en: 'Could not change it. Try again.', fil: 'Hindi mapalitan. Subukan ulit.' },
  changePassword: { en: 'Change password', fil: 'Palitan ang password' },
} satisfies Record<string, Localized>;
