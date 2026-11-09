/**
 * Every context the app runs inside, in the order they have to nest: theme
 * outermost (it writes a class onto <html>), then the query client, then the
 * tooltip layer, then auth - which the router's screens read on their first
 * render, so it has to be above them - then the language the screens are
 * shown in, which follows the account, then where a study
 * participant stands, which needs the signed-in account.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { AuthProvider, useAuthSession, useLanguagePreference } from '@/features/auth';
import { StudyProgressProvider } from '@/features/study';
import { LanguageProvider } from '@/shared/i18n/language';
import { Toaster as Sonner } from '@/shared/ui/sonner';
import { Toaster } from '@/shared/ui/toaster';
import { TooltipProvider } from '@/shared/ui/tooltip';

// Module scope on purpose: a client created inside the component would be
// rebuilt on every render, throwing away the cache it exists to hold.
const queryClient = new QueryClient();

/** Where the signed-in study participant stands; for any other account, nothing is read. */
const StudyProgress = ({ children }: { children: ReactNode }) => {
  const { user, studyAccount } = useAuthSession();
  return <StudyProgressProvider uid={studyAccount && user ? user.uid : null}>{children}</StudyProgressProvider>;
};

/** The chosen language, kept per device and per account by auth. */
const Language = ({ children }: { children: ReactNode }) => (
  <LanguageProvider value={useLanguagePreference()}>{children}</LanguageProvider>
);

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Language>
            <StudyProgress>{children}</StudyProgress>
          </Language>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);
