import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { signIn, signInWithGoogle, signUp } from '@/features/auth/application/authActions';
import { AuthFormProps, AuthView } from '@/features/auth/domain/credentials';

const AuthForm = ({ defaultView = 'login', onSuccess, onCancel }: AuthFormProps) => {
  const [view, setView] = useState<AuthView>(defaultView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || (view === 'register' && !username)) {
      setError('Punan ang lahat ng fields.');
      return;
    }

    setLoading(true);
    try {
      if (view === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, username);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'May error. Subukan ulit.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Google Sign-in */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-border bg-background hover:bg-muted/50 transition-all text-sm font-medium"
      >
        {googleLoading ? (
          <span className="w-4 h-4 border-2 border-border border-t-foreground rounded-full animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        {googleLoading ? 'Signing in...' : 'Continue with Google'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => { setView('login'); setError(''); }}
          className={`flex-1 py-2 text-xs font-display font-bold rounded-lg transition-all ${
            view === 'login'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Mag-login
        </button>
        <button
          type="button"
          onClick={() => { setView('register'); setError(''); }}
          className={`flex-1 py-2 text-xs font-display font-bold rounded-lg transition-all ${
            view === 'register'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Mag-sign up
        </button>
      </div>

      {/* Username — register only */}
      {view === 'register' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="JuanDriver"
            className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="juan@example.com"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 pr-11 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full font-display font-bold text-sm glow-yellow"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            {view === 'login' ? 'PAPASOK...' : 'GINAGAWA...'}
          </span>
        ) : (
          view === 'login' ? 'PUMASOK' : 'GUMAWA NG ACCOUNT'
        )}
      </Button>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Ituloy bilang guest
        </button>
      )}
    </form>
  );
};

export default AuthForm;

// Google Icon
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);