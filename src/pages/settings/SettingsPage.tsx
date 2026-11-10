import { useNavigate } from 'react-router-dom';
import { Eye, Globe, Settings as SettingsIcon, ArrowLeft, Sun } from 'lucide-react';

import AppLayout from '@/app/layout/AppLayout';
import { StudyPasswordForm, useAuthSession } from '@/features/auth';
import { signOut } from '@/features/auth';
import { logUiAction } from '@/features/driving-sim';
import ThemeToggle from '@/app/layout/ThemeToggle';
import { useState } from 'react';
import { useLanguage, useText } from '@/shared/i18n/useText';
import { settingsMessages as m } from './messages';
import { LANGUAGE_NAMES, LANGUAGES, isLanguage } from '@/shared/lib/localized';

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
  const { profile, studyAccount, user } = useAuthSession();
  const [showFSM, setShowFSM] = useState(true);
  const { language, choose } = useLanguage();
  const text = useText();

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
              {text(m.back)}
            </span>
          </button>

          {/* TITLE */}
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-yellow-400" />
            <h2 className="text-4xl font-black italic uppercase text-foreground tracking-tighter">
              {text(m.title)}
            </h2>
          </div>

          {/* spacer */}
          <div className="w-[70px]" />
        </div>

        {/* ================= EXPERIENCE ================= */}
        <section className="space-y-3">
          <SectionTitle>{text(m.experience)}</SectionTitle>

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

            {/* LANGUAGE: kept on the account, and on this device */}
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-secondary text-blue-400">
                  <Globe />
                </div>
                <div>
                  <p className="text-foreground font-black uppercase italic text-sm">
                    {text(m.language)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {text(m.languageHint)}
                  </p>
                </div>
              </div>

              <select
                aria-label={text(m.language)}
                value={language}
                onChange={e => {
                  if (isLanguage(e.target.value)) choose(e.target.value);
                }}
                className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-black uppercase text-foreground outline-none cursor-pointer"
              >
                {LANGUAGES.map(option => (
                  <option key={option} value={option} lang={option}>
                    {LANGUAGE_NAMES[option]}
                  </option>
                ))}
              </select>
            </div>

            {/* FSM */}
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-secondary text-purple-400">
                  <Eye />
                </div>
                <div>
                  <p className="text-foreground font-black uppercase italic text-sm">
                    {text(m.showFsm)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {text(m.showFsmHint)}
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
                    {text(m.theme)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {text(m.themeHint)}
                  </p>
                </div>
              </div>

              <ThemeToggle />
            </div>
          </div>
        </section>

        {/* ================= ACCOUNT ================= */}
        <section className="space-y-3">
          <SectionTitle>{text(m.account)}</SectionTitle>

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
                  {/* A study participant's account has no email, and shows none. */}
                  {profile.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.email}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* A study participant has no email to reset a password by. */}
            {studyAccount && <StudyPasswordForm />}

            {/* SIGN OUT */}
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="text-foreground font-black uppercase italic text-sm">
                  {text(m.signOutTitle)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {text(m.signOutHint)}
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-xs font-black uppercase bg-secondary border border-border rounded-xl text-muted-foreground hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
              >
                {text(m.signOut)}
              </button>
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  );
};

export default Settings;
