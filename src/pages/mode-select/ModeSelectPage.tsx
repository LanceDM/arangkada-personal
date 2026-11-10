import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Car, FileText, CalendarDays, Lock, Flame, Star, ChevronRight, Trophy, ShieldAlert, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { useProgressStore } from '@/features/progression';
import { getDailyKey } from '@/features/daily-challenge';
import { getDailyStreak, loadGuestStreak, type StreakData } from '@/features/daily-challenge';
import { LEVELS, logUiAction } from '@/features/driving-sim';
import { useInitialExam } from '@/app/initialExam/useInitialExam';
import AppLayout from '@/app/layout/AppLayout';
import { useAuthSession } from '@/features/auth';

const EMPTY_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  completedDates: [],
};

const ModeSelect = () => {
  const navigate = useNavigate();
  const { levelResults } = useProgressStore();
  const [streak, setStreak] = useState<StreakData>(EMPTY_STREAK);
  const [todayDone, setTodayDone] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(true);
  const todayKey = getDailyKey();

  // Eksamen unlocks after Level 3 completion
  const level3Result = levelResults[3];
  const eksamenUnlocked = level3Result && level3Result.completed;

  // for testing unlock conditions
  // const eksamenUnlocked = true;

  // Calculate story progress
  const totalLevels = LEVELS.length;
  const completedLevels = Object.values(levelResults).filter(r => r.completed).length;
  const totalStars = Object.values(levelResults).reduce((sum, r) => sum + r.stars, 0);

  const { user, isLoggedIn, profile } = useAuthSession();
  const exam = useInitialExam();
  const lockedFrom = (useLocation().state as { lockedFrom?: string } | null)?.lockedFrom ?? null;
  // The initial exam gates every mode while the study course is on.
  const examLock = exam.required && (exam.locked || exam.loading);
  const examDone = exam.status !== null && exam.status.done && (!exam.status.backgroundRequired || exam.status.backgroundDone);

  useEffect(() => {
    let cancelled = false;

    const loadDailyStatus = async () => {
      setDailyLoading(true);

      if (!isLoggedIn || !user) {
        const localStreak = loadGuestStreak();
        if (!cancelled) {
          setStreak(localStreak);
          setTodayDone(localStreak.completedDates.includes(todayKey));
          setDailyLoading(false);
        }
        return;
      }

      try {
        // Reads the live `dailyStreak/summary` document the Daily Challenge
        // actually writes. This used to read the legacy embedded
        // `users/{uid}.progress.daily` object, which nothing has written since
        // the daily record moved to its own subcollection - so a signed-in
        // player's streak always showed as zero on this screen while the daily
        // page showed it correctly.
        const remoteStreak = (await getDailyStreak(user.uid)) ?? EMPTY_STREAK;
        if (!cancelled) {
          setStreak(remoteStreak);
          setTodayDone((remoteStreak.completedDates ?? []).includes(todayKey));
          setDailyLoading(false);
        }
      } catch (error) {
        console.error('Failed to load mode select daily status:', error);
        if (!cancelled) {
          setStreak(EMPTY_STREAK);
          setTodayDone(false);
          setDailyLoading(false);
        }
      }
    };

    void loadDailyStatus();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user, todayKey]);

  const modes = [
    {
      id: 'daily',
      title: 'Araw-Araw',
      subtitle: 'Daily Challenge',
      description: 'One scenario per day. Build your streak, earn badges, and keep your skills sharp.',
      icon: CalendarDays,
      color: 'from-yellow-500/20 to-orange-500/5',
      borderColor: 'border-yellow-400/40 hover:border-yellow-400/70',
      iconColor: 'text-yellow-400',
      route: '/play/daily',
      locked: examLock,
      badge: dailyLoading ? 'Loading...' : (todayDone ? '✅ Done Today' : '🔥 New Today'),
      stars: 0,
    },
    {
      id: 'story',
      title: 'Bagong Driver',
      subtitle: 'Arangkada Mode',
      description: 'Navigate real Philippine road situations — jeepneys, tricycles, and all. Master traffic rules through experience.',
      icon: Car,
      color: 'from-sky-500/20 to-blue-600/5',
      borderColor: 'border-sky-400/40 hover:border-sky-400/70',
      iconColor: 'text-sky-400',
      route: '/play/story',
      locked: examLock,
      badge: completedLevels > 0 ? `${completedLevels}/${totalLevels} Levels` : null,
      stars: totalStars,
    },
    {
      id: 'eksamen',
      title: 'Eksamen Mode',
      subtitle: 'LTO Mock Exam',
      description: '40-item exam based on the real LTO test. See your weak areas and get recommendations.',
      icon: FileText,
      color: 'from-red-500/20 to-rose-600/5',
      borderColor: eksamenUnlocked ? 'border-red-400/40 hover:border-red-400/70' : 'border-muted/30',
      iconColor: eksamenUnlocked ? 'text-accent' : 'text-muted-foreground',
      route: '/play/eksamen',
      locked: examLock || !eksamenUnlocked,
      badge: null,
      stars: 0,
    },
  ];

  return (
    <AppLayout>
      <main className="max-w-6xl mx-auto px-6 py-10 min-h-screen">
      
        {/* Header row */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6">
          
          {/* Personalized greeting if logged in */}
          {isLoggedIn && profile ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center font-black text-xl italic text-primary-foreground shadow-lg">
              {(profile.username?.[0] ?? 'D').toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                Welcome back
              </p>
              <h4 className="font-black italic text-xl leading-none mt-1 text-foreground">
                {profile.username}
              </h4>
            </div>
          </div>
          ) : (
          <div />
          )}
          {/* Streak */}
          {streak.currentStreak > 0 && (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/30 text-primary shadow-[0_0_20px_rgba(var(--primary),0.15)]">
              <Flame className="w-5 h-5 fill-current" />
              <span className="font-black text-sm uppercase italic tracking-tight">
                {streak.currentStreak} day streak
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
            PUMILI NG{' '}
            <span className="text-primary drop-shadow-[0_0_15px_rgba(250,204,21,0.3)]">
              MODE
            </span>
          </h1>
          <p className="text-muted-foreground font-bold text-xs uppercase tracking-[0.4em] italic mt-4 opacity-60">
            Choose your training mode
          </p>
        </div>

        {/* The initial exam: taken first, from here; it opens the other modes. */}
        {exam.required && (
          <section className="mb-8">
            <button
              onClick={() => {
                if (user) void logUiAction(user.uid, 'menu_selected', { mode: 'initial_exam', done: examDone });
                navigate('/play/initial-exam');
              }}
              className={`relative flex w-full items-center gap-8 overflow-hidden rounded-[3rem] border p-10 text-left shadow-2xl transition-all duration-500 hover:scale-[1.01] ${
                examDone ? 'border-emerald-400/30 bg-gradient-to-r from-emerald-500/10 to-transparent' : 'border-primary/60 bg-gradient-to-r from-primary/20 to-transparent glow-yellow'
              }`}
            >
              {examDone ? <CheckCircle2 className="h-14 w-14 shrink-0 text-emerald-400" /> : <ClipboardCheck className="h-14 w-14 shrink-0 text-primary" />}
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Step 1 · Required</p>
                <h2 className="mt-1 text-4xl font-black uppercase italic leading-none text-white">Initial Exam</h2>
                <p className="mt-3 max-w-xl text-sm italic text-muted-foreground">
                  {!exam.signedIn
                    ? 'Sign in, then take the 55-item initial exam. It sets your starting point and opens every mode.'
                    : exam.loading
                      ? 'Checking your initial exam…'
                      : exam.error
                        ? exam.error
                        : examDone
                          ? 'Done. Every mode is open.'
                          : '55 items, 5 per driving competency, no pass mark. It sets your starting point and opens every mode.'}
                </p>
                {exam.bypass && !examDone && !exam.loading && (
                  <p className="mt-2 text-[10px] font-black uppercase text-muted-foreground">Admin or developer build: the modes stay open for testing</p>
                )}
                {lockedFrom && examLock && (
                  <p className="mt-2 text-xs font-bold text-red-400">That mode opens after the initial exam.</p>
                )}
              </div>
              <ChevronRight className="h-10 w-10 shrink-0 text-primary" />
            </button>
          </section>
        )}

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-[auto_1fr] gap-8">

          {modes.map((mode) => {
            const Icon = mode.icon;
            const isLocked = mode.locked;
            
            return (
              <button
                key={mode.id}
                onClick={() => {
                  if (user) void logUiAction(user.uid, 'menu_selected', { mode: mode.id, locked: isLocked });
                  if (!isLocked) navigate(mode.route);
                }}
                disabled={isLocked}
                className={`relative text-left p-12 rounded-[3rem] border transition-all duration-500 group overflow-hidden shadow-2xl
                  ${mode.id === 'daily'
                      ? `md:col-span-2 h-56 flex items-center bg-gradient-to-r ${mode.color} ${mode.borderColor} hover:scale-[1.01] hover:border-primary/50`
                      : isLocked
                      ? 'bg-black border-destructive/10 opacity-60 cursor-not-allowed'
                      : `h-[22rem] bg-gradient-to-br ${mode.color} border-white/10 hover:scale-[1.02] ${mode.borderColor} cursor-pointer glow-yellow`
                  }`}
              >
                {/* CARD LAYOUT */}
                {/* Icon */}
                <div className="absolute bottom-[-30px] right-[-30px] opacity-10 group-hover:opacity-20 transition-all duration-1000 pointer-events-none -rotate-[15deg] group-hover:rotate-0">
                  <Icon className="w-80 h-80 text-white" />
                </div> 
                {/* Chevron */}
                <div className="absolute top-12 right-12 opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all">
                {isLocked ? (
                  <Lock className="w-10 h-10 text-destructive" />
                ) : (
                    <ChevronRight className="w-10 h-10 text-primary" />
                )}
                </div>

                {examLock && (
                  <div className="absolute bottom-12 left-12 flex items-center gap-2 text-red-400 text-xs font-black uppercase">
                    <ShieldAlert className="w-4 h-4" />
                    Take the initial exam first
                  </div>
                )}

                {!examLock && mode.id === 'eksamen' && isLocked && (
                  <div className="absolute bottom-12 left-12 flex items-center gap-2 text-red-400 text-xs font-black uppercase">
                    <ShieldAlert className="w-4 h-4" />
                    Story Mode: Level 3 required
                  </div>
                )}
                
                <div className="relative z-10 flex flex-col h-full">
                  <h2 className="text-5xl font-black italic uppercase text-white leading-none">
                    {mode.title}
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mt-2">
                    {mode.subtitle}
                  </p>
                  <p className="text-sm italic text-muted-foreground mt-6 max-w-[280px]">
                    {mode.description}
                  </p>
                  <div className="mt-auto flex items-center gap-4">
                    {mode.badge && (
                      <span className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase">
                        {mode.badge}
                      </span>
                    )}
                    {/* Stars or completion badge */}
                    {mode.id === 'story' ? (
                      completedLevels === totalLevels ? (
                        <div className="flex items-center gap-1 text-yellow-400 text-glow-yellow font-black italic">
                          <Trophy className="w-4 h-4" />
                          Completed
                        </div>
                      ) : mode.stars > 0 && (
                        <div className="flex items-center gap-1 text-primary font-black italic">
                          <Star className="w-4 h-4" />
                          {mode.stars}
                        </div>
                      )
                    ) : (
                      mode.stars > 0 && (
                        <div className="flex items-center gap-1 text-primary font-black italic">
                          <Star className="w-4 h-4" />
                          {mode.stars}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </AppLayout>
  );
};

export default ModeSelect;
