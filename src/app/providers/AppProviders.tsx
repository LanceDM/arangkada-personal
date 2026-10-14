/**
 * Every context the app runs inside, in the order they have to nest: theme
 * outermost (it writes a class onto <html>), then the query client, then the
 * tooltip layer, then auth - which the router's screens read on their first
 * render, so it has to be above them.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth';
import { Toaster as Sonner } from '@/shared/ui/sonner';
import { Toaster } from '@/shared/ui/toaster';
import { TooltipProvider } from '@/shared/ui/tooltip';

// Module scope on purpose: a client created inside the component would be
// rebuilt on every render, throwing away the cache it exists to hold.
const queryClient = new QueryClient();

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          {children}
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);
