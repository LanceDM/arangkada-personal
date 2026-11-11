/**
 * The admin area's frame: one header, and the sections grouped in a sidebar,
 * or in a row of tabs above the section on a narrow screen or a tablet held
 * upright. Each section is its own route under `/admin`.
 */
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Activity,
  BrainCircuit,
  ClipboardList,
  FlaskConical,
  Gamepad2,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Route,
  Shield,
  Sigma,
  Users,
  LineChart,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active only on this exact path, not on the paths below it. */
  end?: boolean;
}

/** The sections, grouped as the sidebar shows them. */
const ADMIN_SECTIONS: ReadonlyArray<{ heading: string; items: readonly NavItem[] }> = [
  {
    heading: 'Pilot',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/pilot', label: 'Participants', icon: ClipboardList },
    ],
  },
  {
    heading: 'Reports',
    items: [
      { to: '/admin/replay', label: 'Replay', icon: History },
      { to: '/admin/routing', label: 'Course flow', icon: Route },
      { to: '/admin/q-learning', label: 'Q-learning', icon: BrainCircuit },
      { to: '/admin/course', label: 'BKT & export', icon: Activity },
      { to: '/admin/evaluation', label: 'Model evaluation', icon: LineChart },
      { to: '/admin/irt', label: 'IRT', icon: Sigma },
      { to: '/admin/report', label: 'Player report', icon: Users },
    ],
  },
  {
    heading: 'Content',
    items: [
      { to: '/admin/quiz', label: 'Quiz items', icon: ListChecks },
      { to: '/admin/scenarios', label: 'Scenarios', icon: Route },
    ],
  },
  {
    heading: 'Tools',
    items: [{ to: '/admin/test-mode', label: 'Test mode', icon: FlaskConical }],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
    isActive ? 'bg-primary/15 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  );

interface AdminShellProps {
  userEmail?: string | null;
  onSignOut: () => void;
  children: ReactNode;
}

export const AdminShell = ({ userEmail, onSignOut, children }: AdminShellProps) => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 lg:px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-display text-xs tracking-widest text-primary">ARANGKADA</div>
          <div className="text-sm font-medium text-foreground">Admin</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {userEmail && <span className="mr-2 hidden max-w-[16rem] truncate text-xs text-muted-foreground sm:inline">{userEmail}</span>}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/play">
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden sm:inline">Game</span>
            </Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>

    <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
      <nav aria-label="Admin sections" className="border-b border-border lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex gap-1 overflow-x-auto px-3 py-2 lg:sticky lg:top-14 lg:flex-col lg:gap-5 lg:px-3 lg:py-5">
          {ADMIN_SECTIONS.map(section => (
            <div key={section.heading} className="flex gap-1 lg:flex-col">
              <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
                {section.heading}
              </p>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <main className="min-w-0 flex-1 space-y-6 px-4 py-5 lg:px-8 lg:py-6">{children}</main>
    </div>
  </div>
);
