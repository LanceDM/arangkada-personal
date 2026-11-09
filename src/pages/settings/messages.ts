/**
 * What these screens say, in one table for the team to fill. A text
 * with no `fil` shows in English until the team writes it, under
 * the team's style guide. A developers' report lists them.
 */
import type { Localized } from '@/shared/lib/localized';

export const settingsMessages = {
  back: { en: 'Back' },
  title: { en: 'Settings' },
  experience: { en: 'Experience' },
  language: { en: 'Language', fil: 'Wika' },
  languageHint: { en: 'English or Filipino' },
  showFsm: { en: 'Show FSM Diagram' },
  showFsmHint: { en: 'Live state overlay during game' },
  theme: { en: 'Theme' },
  themeHint: { en: 'Switch light / dark mode' },
  account: { en: 'Account' },
  signOutTitle: { en: 'Sign Out', fil: 'Mag-sign out' },
  signOutHint: { en: 'Log out of your account' },
  signOut: { en: 'Sign out', fil: 'Mag-sign out' },
} satisfies Record<string, Localized>;
