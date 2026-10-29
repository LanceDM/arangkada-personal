import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/shared/ui/button';
import { useAuthSession } from '@/features/auth';
import { logUiAction } from '@/features/driving-sim';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthSession();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        if (user) void logUiAction(user.uid, 'setting_changed', { setting: 'theme', from: theme ?? null, to: next });
        setTheme(next);
      }}
      className="rounded-full"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};

export default ThemeToggle;
