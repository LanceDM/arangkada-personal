/**
 * Who is signed in, and the account record behind them.
 *
 * `AuthUser` is deliberately not Firebase's `User`: only auth's infrastructure
 * should name the SDK, and these fields are all anything else reads.
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /**
   * The `admin` custom claim on the sign-in token: the only source of admin,
   * and the one `firestore.rules` checks. The developers set it with their
   * service account, and it reaches the app on the next sign-in.
   */
  isAdmin: boolean;
}

/**
 * The account record at `users/{uid}` — the Firestore document auth creates on
 * sign-up.
 *
 * `longestStreak`, `bestExamScore` and `totalScore` are denormalized copies of
 * numbers owned elsewhere (daily challenge, mock exam, progression). They live
 * here so the admin report can list every player without fanning out into
 * per-user subcollections; each owning feature writes its own field through its
 * own repository.
 *
 * It carries no role. Admin is a claim on the sign-in token, never a field a
 * player can write; an older account may still hold a `role`, which nothing
 * reads and the rules pin where it is.
 */
export interface UserProfile {
  email: string;
  username: string;
  createdAt: number;
  totalScore: number;
  longestStreak: number;
  bestExamScore: number;
}
