/**
 * The main sign-in panel (2026-11-18).
 *
 * - Log in: one field for a username or an email, and the password. No
 *   agreement to tick: the account agreed when it was made.
 * - Sign up: a username, an optional email, a password, and the Terms and
 *   Data Use, which must be agreed to before the account is made.
 * - Google works from either tab. When a Google sign-in has just made the
 *   account, the agreement is asked for there and then; declining signs the
 *   new account straight back out.
 *
 * Study participants have their own pages (/study/join, /study/sign-in), but a
 * participant who signs in here with their username gets in too.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import {
  AccountAuthError,
  createAccount,
  needsTermsAcceptance,
  recordTermsAcceptance,
  requestPasswordReset,
  signInWithGoogle,
  signInWithLogin,
  signOut,
} from '@/features/auth/application/authActions';
import { TERMS_AGREEMENT, TERMS_REQUIRED, TERMS_SECTIONS, TERMS_TITLE } from '@/features/auth/domain/terms';
import { ACCOUNT_PASSWORD_MIN, looksLikeEmail } from '@/features/auth/domain/accountIdentity';
import { USERNAME_MAX, USERNAME_RULE } from '@/features/auth/domain/studyIdentity';
import type { AuthFormProps, AuthView } from '@/features/auth/domain/credentials';

const INPUT =
  'w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all';

const FAILED: Localized = { en: 'Something went wrong. Try again.', fil: 'May error. Subukan ulit.' };
const AGREE_FIRST: Localized = { en: TERMS_REQUIRED, fil: TERMS_REQUIRED };

const Field = ({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

/** The agreement box: the tick, and the full text on request. */
const TermsBox = ({ agreed, onChange }: { agreed: boolean; onChange: (agreed: boolean) => void }) => {
  const [showTerms, setShowTerms] = useState(false);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <label className="flex items-start gap-2 text-xs text-foreground">
        <input type="checkbox" aria-label={TERMS_AGREEMENT} checked={agreed} onChange={e => onChange(e.target.checked)} className="mt-0.5" />
        <span>{TERMS_AGREEMENT}</span>
      </label>
      <button
        type="button"
        onClick={() => setShowTerms(v => !v)}
        aria-expanded={showTerms}
        className="text-xs font-medium text-primary underline underline-offset-2"
      >
        {showTerms ? `Hide the ${TERMS_TITLE}` : `Read the ${TERMS_TITLE}`}
      </button>
      {showTerms && (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3 text-xs">
          {TERMS_SECTIONS.map(section => (
            <section key={section.title}>
              <h3 className="font-semibold text-foreground">{section.title}</h3>
              <p className="text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const Spinner = ({ dark = false }: { dark?: boolean }) => (
  <span
    className={`w-4 h-4 border-2 rounded-full animate-spin ${
      dark ? 'border-border border-t-foreground' : 'border-primary-foreground/40 border-t-primary-foreground'
    }`}
  />
);

const AuthForm = ({ defaultView = 'login', onSuccess, onCancel }: AuthFormProps) => {
  const text = useText();
  const [view, setView] = useState<AuthView>(defaultView);
  const [login, setLogin] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<'submit' | 'google' | 'reset' | 'consent' | null>(null);
  const [error, setError] = useState<Localized | null>(null);
  const [notice, setNotice] = useState<Localized | null>(null);
  // A Google sign-in that has just made the account, waiting for the agreement.
  const [pendingConsent, setPendingConsent] = useState<string | null>(null);

  const switchTo = (next: AuthView) => {
    setView(next);
    setError(null);
    setNotice(null);
  };

  const fail = (failure: unknown) => setError(failure instanceof AccountAuthError ? failure.text : FAILED);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (view === 'register' && !agreed) {
      setError(AGREE_FIRST);
      return;
    }
    setBusy('submit');
    try {
      if (view === 'login') {
        await signInWithLogin(login, password);
      } else {
        const user = await createAccount({ username, email, password });
        await recordTermsAcceptance(user.uid);
      }
      onSuccess();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setNotice(null);
    // Signing up with Google needs the same agreement first; logging in does not.
    if (view === 'register' && !agreed) {
      setError(AGREE_FIRST);
      return;
    }
    setBusy('google');
    try {
      const user = await signInWithGoogle();
      if (!user) return; // The page is leaving for Google's own sign-in.
      if (view === 'register') {
        await recordTermsAcceptance(user.uid);
        onSuccess();
      } else if (await needsTermsAcceptance(user.uid)) {
        setPendingConsent(user.uid);
        setAgreed(false);
      } else {
        onSuccess();
      }
    } catch (failure) {
      setError(failure instanceof Error && /popup-closed|cancelled-popup/.test(failure.message) ? null : { en: 'Google sign-in failed.', fil: 'Hindi nakapasok gamit ang Google.' });
    } finally {
      setBusy(null);
    }
  };

  const acceptPending = async () => {
    if (!pendingConsent) return;
    if (!agreed) {
      setError(AGREE_FIRST);
      return;
    }
    setBusy('consent');
    await recordTermsAcceptance(pendingConsent);
    setBusy(null);
    setPendingConsent(null);
    onSuccess();
  };

  const declinePending = async () => {
    setPendingConsent(null);
    setAgreed(false);
    await signOut().catch(() => {});
  };

  const forgot = async () => {
    setError(null);
    setNotice(null);
    const value = login.trim();
    if (!looksLikeEmail(value)) {
      setNotice({
        en: 'Type the email you signed up with above, then press this again. An account made with a username only cannot get a reset email: ask an admin.',
        fil: 'I-type sa itaas ang email na ginamit mo sa pag-sign up, saka pindutin ulit ito. Walang reset email ang account na username lang: magtanong sa admin.',
      });
      return;
    }
    setBusy('reset');
    try {
      await requestPasswordReset(value);
    } catch {
      // Said the same either way, so the form never reveals which emails have accounts.
    }
    setBusy(null);
    setNotice({ en: `If ${value} has an account, a reset link is on its way.`, fil: `Kung may account ang ${value}, papunta na ang reset link.` });
  };

  if (pendingConsent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          <Say en="Welcome! One step before your new account is ready:" fil="Maligayang pagdating! Isang hakbang bago maging handa ang bago mong account:" />
        </p>
        <TermsBox agreed={agreed} onChange={value => { setAgreed(value); setError(null); }} />
        {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{text(error)}</p>}
        <Button type="button" size="lg" className="w-full font-display font-bold text-sm glow-yellow" disabled={busy !== null} onClick={() => void acceptPending()}>
          {busy === 'consent' ? <Spinner /> : <Say en="AGREE AND CONTINUE" fil="SUMANG-AYON AT MAGPATULOY" />}
        </Button>
        <button type="button" onClick={() => void declinePending()} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <Say en="Don't agree: sign out" fil="Hindi sumasang-ayon: mag-sign out" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {/* View toggle */}
      <div className="flex gap-2">
        {(['login', 'register'] as const).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => switchTo(option)}
            aria-pressed={view === option}
            className={`flex-1 py-2 text-xs font-display font-bold rounded-lg transition-all ${
              view === option ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {option === 'login' ? <Say en="Log in" fil="Mag-login" /> : <Say en="Sign up" fil="Mag-sign up" />}
          </button>
        ))}
      </div>

      {view === 'login' ? (
        <Field id="auth-login" label={<Say en="Username or email" fil="Username o email" />}>
          <input
            id="auth-login"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="juandriver / juan@example.com"
            className={INPUT}
          />
        </Field>
      ) : (
        <>
          <Field id="auth-username" label="Username" hint={text(USERNAME_RULE)}>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={USERNAME_MAX}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="juandriver"
              className={INPUT}
            />
          </Field>
          <Field
            id="auth-email"
            label={<Say en="Email (optional)" fil="Email (opsyonal)" />}
            hint={
              <Say
                en="With an email you log in with it and can reset a forgotten password. Without one, you log in with your username."
                fil="Kapag may email, iyon ang gagamitin sa pag-login at puwedeng mag-reset ng password. Kung wala, ang username ang gagamitin."
              />
            }
          >
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="juan@example.com"
              className={INPUT}
            />
          </Field>
        </>
      )}

      <Field
        id="auth-password"
        label="Password"
        hint={view === 'register' ? <Say en={`At least ${ACCOUNT_PASSWORD_MIN} characters.`} fil={`Hindi bababa sa ${ACCOUNT_PASSWORD_MIN} na character.`} /> : undefined}
      >
        <div className="relative">
          <input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={view === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${INPUT} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Field>

      {view === 'login' && (
        <button type="button" onClick={() => void forgot()} disabled={busy !== null} className="text-xs text-primary underline underline-offset-2">
          {busy === 'reset' ? <Say en="Sending…" fil="Ipinapadala…" /> : <Say en="Forgot your password?" fil="Nakalimutan ang password?" />}
        </button>
      )}

      {/* The agreement: only to make an account. */}
      {view === 'register' && <TermsBox agreed={agreed} onChange={value => { setAgreed(value); setError(null); }} />}

      {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{text(error)}</p>}
      {notice && <p className="text-xs text-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">{text(notice)}</p>}

      <Button type="submit" size="lg" className="w-full font-display font-bold text-sm glow-yellow" disabled={busy !== null}>
        {busy === 'submit' ? (
          <span className="flex items-center gap-2">
            <Spinner />
            {view === 'login' ? <Say en="LOGGING IN…" fil="PAPASOK…" /> : <Say en="CREATING…" fil="GINAGAWA…" />}
          </span>
        ) : view === 'login' ? (
          <Say en="LOG IN" fil="PUMASOK" />
        ) : (
          <Say en="CREATE ACCOUNT" fil="GUMAWA NG ACCOUNT" />
        )}
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">
          <Say en="or" fil="o" />
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <button
        type="button"
        onClick={() => void google()}
        disabled={busy !== null}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-border bg-background hover:bg-muted/50 transition-all text-sm font-medium"
      >
        {busy === 'google' ? <Spinner dark /> : <GoogleIcon />}
        {busy === 'google' ? <Say en="Signing in…" fil="Pumapasok…" /> : <Say en="Continue with Google" fil="Magpatuloy gamit ang Google" />}
      </button>

      {onCancel && (
        <button type="button" onClick={onCancel} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          <Say en="Continue as guest" fil="Ituloy bilang guest" />
        </button>
      )}
    </form>
  );
};

export default AuthForm;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);
