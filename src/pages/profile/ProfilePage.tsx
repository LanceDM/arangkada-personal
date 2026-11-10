/**
 * `/profile`: the signed-in player's own progress. Where the course is, whether
 * the pre-test is done, and BKT mastery per competency: the same evidence,
 * order and model the routing decisions read, so what a player sees here is
 * what the course routes on.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gauge, Settings as SettingsIcon, User } from 'lucide-react';

import AppLayout from '@/app/layout/AppLayout';
import { useInitialExam } from '@/app/initialExam/useInitialExam';
import { useAuthSession } from '@/features/auth';
import { LEVELS, loadCompetencyCourseProgress, loadMasteryReport, type MasteryRow } from '@/features/driving-sim';
import { competencyText } from '@/domain/learner/profile';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';

const LEVEL_STYLE: Record<MasteryRow['level'], string> = {
  1: 'bg-red-500',
  2: 'bg-amber-400',
  3: 'bg-sky-400',
  4: 'bg-emerald-400',
};

const DESCRIPTOR_FIL: Record<MasteryRow['level'], string> = {
  1: 'Nagsisimula',
  2: 'Umuunlad',
  3: 'Kumokonekta',
  4: 'Mahusay',
};

type CourseProgress = Awaited<ReturnType<typeof loadCompetencyCourseProgress>>;

const stageName = (progress: CourseProgress | null): { en: string; fil: string } => {
  if (!progress) return { en: '…', fil: '…' };
  if (progress.endReason === 'certified') return { en: 'Course finished', fil: 'Tapos na ang kurso' };
  const level = LEVELS.find(entry => entry.id === progress.frontierLevel);
  if (progress.frontierLevel === 0) return { en: 'Tutorial', fil: 'Tutorial' };
  if (progress.frontierLevel === 12) return { en: 'Final Mission', fil: 'Huling Misyon' };
  return level
    ? { en: `Level ${level.id}: ${level.name}`, fil: `Antas ${level.id}: ${level.name}` }
    : { en: '—', fil: '—' };
};

export const MasteryTable = ({ rows }: { rows: readonly MasteryRow[] }) => {
  const text = useText();
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {rows.map(row => (
        <div key={row.competency} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-4 sm:grid-cols-[12rem_1fr_7rem]">
          <p className="text-sm font-bold">{text(competencyText(row.competency))}</p>
          <p className="text-right text-xs font-black uppercase tracking-wider sm:order-last">
            {text({ en: row.descriptor, fil: DESCRIPTOR_FIL[row.level] })}
          </p>
          <div className="col-span-2 sm:col-span-1">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(row.p * 100)} aria-label={text(competencyText(row.competency))}>
              <div className={`h-full ${LEVEL_STYLE[row.level]}`} style={{ width: `${Math.max(2, Math.round(row.p * 100))}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {Math.round(row.p * 100)}% ·{' '}
              {text({
                en: `${row.evidence.total} answers (${row.evidence.diagnostic} pre-test, ${row.evidence.quiz} quiz, ${row.evidence.drive} drive)`,
                fil: `${row.evidence.total} sagot (${row.evidence.diagnostic} pre-test, ${row.evidence.quiz} quiz, ${row.evidence.drive} pagmamaneho)`,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const text = useText();
  const { user, profile, isLoggedIn, loading, isAdmin, studyAccount } = useAuthSession();
  const exam = useInitialExam();
  const uid = isLoggedIn && user ? user.uid : null;
  const [rows, setRows] = useState<MasteryRow[] | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    Promise.all([loadMasteryReport(uid), loadCompetencyCourseProgress(uid)])
      .then(([mastery, course]) => {
        if (!live) return;
        setRows(mastery);
        setProgress(course);
      })
      .catch(failure => live && setError(failure instanceof Error ? failure.message : String(failure)));
    return () => {
      live = false;
    };
  }, [uid]);

  if (!loading && !uid) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl px-6 pt-28 text-center text-muted-foreground">
          <Say en="Sign in to see your progress." fil="Mag-login para makita ang iyong progreso." />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 pb-12 pt-24 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest"><Say en="Back" fil="Bumalik" /></span>
          </button>
          <button onClick={() => navigate('/settings')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <SettingsIcon className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-widest"><Say en="Settings" fil="Settings" /></span>
          </button>
        </div>

        <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="rounded-2xl bg-secondary p-3 text-yellow-400"><User /></div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-black italic">{profile?.username ?? user?.email ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? 'Admin' : studyAccount ? text({ en: 'Study account', fil: 'Study account' }) : text({ en: 'Player account', fil: 'Player account' })}
              {' · '}
              {exam.status?.done ? text({ en: 'Pre-test done', fil: 'Tapos na ang pre-test' }) : text({ en: 'Pre-test not taken yet', fil: 'Hindi pa nasasagutan ang pre-test' })}
              {' · '}
              {text(stageName(progress))}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Gauge className="h-4 w-4 text-yellow-400" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em]"><Say en="Competency mastery (BKT)" fil="Kahusayan sa bawat kakayahan (BKT)" /></h2>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            <Say
              en="Your chance of knowing each competency, from every pre-test, quiz and drive answer so far. It starts from the pre-test and moves with each answer. Benchmarking needs at least 3 drive answers."
              fil="Ang tsansang alam mo ang bawat kakayahan, mula sa lahat ng sagot sa pre-test, quiz at pagmamaneho. Nagsisimula ito sa pre-test at gumagalaw sa bawat sagot. Kailangan ng hindi bababa sa 3 sagot sa pagmamaneho para sa Mahusay."
            />
          </p>
          {error && <p className="px-1 text-sm text-destructive">{error}</p>}
          {!rows && !error && <div className="h-64 animate-pulse rounded-2xl bg-muted" />}
          {rows && <MasteryTable rows={rows} />}
        </section>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
