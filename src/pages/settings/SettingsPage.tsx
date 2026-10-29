import { useNavigate } from 'react-router-dom';
import { Eye, Settings as SettingsIcon, ArrowLeft, Sun } from 'lucide-react';

import AppLayout from '@/app/layout/AppLayout';
import { useAuthSession } from '@/features/auth';
import { signOut } from '@/features/auth';
import { logUiAction } from '@/features/driving-sim';
import ThemeToggle from '@/app/layout/ThemeToggle';
import { useState } from 'react';

/* =========================
   TOGGLE (VISUALLY FIXED)
========================= */
const Toggle = ({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className={`w-14 h-8 rounded-full relative transition-all duration-200 cursor-pointer ${
      on ? 'bg-yellow-400' : 'bg-secondary'
    }`}
  >
    <div
      className={`absolute top-1 w-6 h-6 rounded-full bg-foreground transition-all duration-200 ${
        on ? 'right-1' : 'left-1'
      }`}
    />
  </button>
);

/* =========================
   SECTION TITLE
========================= */
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] px-2">
    {children}
  </p>
);

/* =========================
   MAIN SETTINGS
========================= */
const Settings = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuthSession();
  const [showFSM, setShowFSM] = useState(true);

  const handleSignOut = async () => {
    if (user) await logUiAction(user.uid, 'signed_out', { from: 'settings' }).catch(() => {});
    await signOut();
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="min-h-screen pt-24 pb-12 px-6 max-w-3xl mx-auto flex flex-col gap-10 bg-background text-foreground">

        {/* ================= BACK + HEADER ================= */}
        <div className="flex items-center justify-between">

          {/* BACK BUTTON */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">
              Back
            </span>
          </button>

          {/* TITLE */}
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-yellow-400" />
            <h2 className="text-4xl font-black italic uppercase text-foreground tracking-tighter">
              Settings
            </h2>
          </div>

          {/* spacer */}
          <div className="w-[70px]" />
        </div>

        {/* ================= EXPERIENCE ================= */}
        <section className="space-y-3">
          <SectionTitle> Experience</SectionTitle>

          <div className="bg-card border border-border rounded-2xl divide-y divide-border">

            {/* SOUND */}
            {/* <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/5 text-yellow-400">
                  {sound ? <Volume2 /> : <VolumeX />}
                </div>
                <div>
                  <p className="text-foreground font-black uppercase italic text-sm">
                    Sound Effects
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Game sounds and UI feedback
                  </p>
                </div>
              </div>

              <Toggle
                on={sound}
                onToggle={() => {
                  console.log('toggle sound clicked', !sound);
                  setSound(!sound);
                }}
              />
            </div> */}

            {/* LANGUAGE */}
            {/* <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/5 text-blue-400">
                  <Globe />
                </div>
                <div>
                  <p className="text-foreground font-black uppercase italic text-sm">
                    System Language
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Choose interface language
                  </p>
                </div>
              </div>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-black uppercase text-foreground outline-none cursor-pointer"
              >
                <option value="Tagalog">Tagalog</option>
                <option value="English">English</option>
              </select>
            </div> */}

            {/* FSM */}
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-secondary text-purple-400">
                  <Eye />
                </div>
                <div>
                  <p className="text-foreground font-black uppercase italic text-sm">
                    Show FSM Diagram
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Live state overlay during game
                  </p>
                </div>
              </div>

              <Toggle
                on={showFSM}
                onToggle={() => {
                  if (user) void logUiAction(user.uid, 'setting_changed', { setting: 'showFsmDiagram', from: showFSM, to: !showFSM });
                  setShowFSM(!showFSM);
                }}
              />
            </div>
            {/* THEME */}
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-secondary text-foreground">
                  <Sun />
                </div>
                <div>
                  <p className="text-foreground font-black uppercase italic text-sm">
                    Theme
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Switch light / dark mode
                  </p>
                </div>
              </div>

              <ThemeToggle />
            </div>
          </div>
        </section>

        {/* ================= ACCOUNT ================= */}
        <section className="space-y-3">
          <SectionTitle>Account</SectionTitle>

          <div className="bg-card border border-border rounded-2xl divide-y divide-border">

            {profile && (
              <div className="flex items-center gap-4 p-5">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center text-yellow-400 font-black">
                  {profile.username?.[0]?.toUpperCase() ?? 'D'}
                </div>
                <div className="min-w-0">
                  <p className="text-foreground font-black uppercase italic truncate">
                    {profile.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile.email}
                  </p>
                </div>
              </div>
            )}

            {/* SIGN OUT */}
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="text-foreground font-black uppercase italic text-sm">
                  Sign Out
                </p>
                <p className="text-xs text-muted-foreground">
                  Log out of your account
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-xs font-black uppercase bg-secondary border border-border rounded-xl text-muted-foreground hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  );
};

export default Settings;
