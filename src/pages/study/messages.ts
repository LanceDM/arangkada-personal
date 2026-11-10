/**
 * What these screens say, in one table for the team to fill. A text
 * with no `fil` shows in English until the team writes it, under
 * the team's style guide. A developers' report lists them.
 */
import type { Localized } from '@/shared/lib/localized';

export const studyPageMessages = {
  joinTheArangkadaStudy: { en: 'Join the Arangkada study', fil: 'Sumali sa pag-aaral ng Arangkada' },
  youAreSignedIn: { en: 'You are signed in with another account. Sign out first to join.', fil: 'Naka-sign in ka sa ibang account. Mag-sign out muna para sumali.' },
  signOut: { en: 'Sign out', fil: 'Mag-sign out' },
  alreadyJoined: { en: 'Already joined?', fil: 'Nakasali na?' },
  signIn: { en: 'Sign in', fil: 'Pumasok' },
  participantSignIn: { en: 'Participant sign-in', fil: 'Pag-sign in ng kalahok' },
  youAreSignedIn2: { en: 'You are signed in with another account.', fil: 'Naka-sign in ka sa ibang account.' },
  newToTheStudy: { en: 'New to the study?', fil: 'Bago sa pag-aaral?' },
  join: { en: 'Join', fil: 'Sumali' },
} satisfies Record<string, Localized>;
