/**
 * What these screens say, in one table for the team to fill. A text
 * with no `fil` shows in English until the team writes it, under
 * the team's style guide. A developers' report lists them.
 */
import type { Localized } from '@/shared/lib/localized';

export const headerMessages = {
  driver: { en: 'Driver' },
  signOut: { en: 'Sign out', fil: 'Mag-sign out' },
  logIn: { en: 'Log in' },
  signUp: { en: 'Sign up' },
} satisfies Record<string, Localized>;
