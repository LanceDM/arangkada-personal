import { useNavigate } from 'react-router-dom';
import { Gauge, LogOut, User } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import ThemeToggle from './ThemeToggle';
import { signOut, useAuthModal, useAuthSession } from '@/features/auth';

const Header = () => {
  const navigate = useNavigate();
  const { isLoggedIn, profile, loading } = useAuthSession();
  const { open } = useAuthModal();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-16 bg-background/80 backdrop-blur border-b border-border">

      {/* Logo */}
      <button onClick={() => navigate('/')} className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-primary" />
        <span className="font-display text-lg font-bold tracking-wider">
          ARANG<span className="text-primary">KADA</span>
        </span>
      </button>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* Show skeleton while Firebase resolves auth state */}
        {loading ? (
          <div className="w-24 h-8 rounded-lg bg-muted animate-pulse" />

        ) : isLoggedIn ? (
          /* ── LOGGED IN STATE ── */
          <div className="flex items-center gap-2">
            {/* USER + SETTINGS BUTTON */}
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border hover:border-primary/40 hover:bg-muted/70 transition"
            >
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium max-w-[120px] truncate">
                {profile?.username ?? 'Driver'}
              </span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sign out
            </Button>
          </div>

        ) : (
          /* ── LOGGED OUT STATE ── */
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => open({ defaultView: 'login' })}
            >
              Log in
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground font-bold"
              onClick={() => open({ defaultView: 'register' })}
            >
              Sign up
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;