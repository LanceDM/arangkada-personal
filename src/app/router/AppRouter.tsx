/**
 * The route table, and nothing else.
 *
 * Two groups of routes are never reachable in a production build. The `/dev/*`
 * scenario tooling is lazy-loaded *and* gated on `import.meta.env.DEV`, so the
 * routes are never registered and the page modules are never loaded — nothing
 * dev-only ever executes, and none of it lands in the main bundle. (The lazy
 * chunks are not emitted either: a production build resolves every
 * `@/dev/pages/*` import to an empty module — see `stripDevPages` in
 * vite.config.ts.) `/test`, a scratch page for trying a component in
 * isolation, gets the same treatment: it renders a save-progress modal over
 * made-up numbers and has no business being reachable in a build.
 */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Landing from '@/pages/landing/LandingPage';
import ModeSelect from '@/pages/mode-select/ModeSelectPage';
import StoryModeLayout from '@/pages/story/StoryModeLayout';
import LevelMapPage from '@/pages/story/LevelMapPage';
import BriefingPage from '@/pages/story/BriefingPage';
import DrivePage from '@/pages/story/DrivePage';
import CompletePage from '@/pages/story/CompletePage';
import PostTestPage from '@/pages/story/PostTestPage';
import { DiagnosticPage, PostExamPage } from '@/pages/story/AssessmentPage';
import BackgroundFormPage from '@/pages/story/BackgroundFormPage';
import NotFound from '@/pages/NotFoundPage';
import ResetPassword from '@/pages/auth/ResetPasswordPage';
import VerifyEmail from '@/pages/auth/VerifyEmailPage';

// The modes that share nothing with each other: their own content, their own
// screens, no state carried in from anywhere else. Split so that opening the
// app does not load the mock exam's question bank, the daily challenge's
// scenarios and the admin report alongside the thing the player asked for.
//
// Story mode is deliberately *not* split. Its four screens are one attempt,
// held in a layout that must stay mounted from briefing through results, so
// suspending between them is a change to make with the roll timing in view -
// not as part of a bundle tidy-up.
const Learn = lazy(() => import('@/pages/learn/LearnPage'));
const EksamenMode = lazy(() => import('@/pages/mock-exam/MockExamPage'));
const DailyChallenge = lazy(() => import('@/pages/daily-challenge/DailyChallengePage'));
const Settings = lazy(() => import('@/pages/settings/SettingsPage'));
const Admin = lazy(() => import('@/pages/admin/AdminPage'));

const ComponentGallery = lazy(() => import('@/dev/pages/ComponentGallery'));
const ScenarioLab = lazy(() => import('@/dev/pages/ScenarioLab'));
const RendererLab = lazy(() => import('@/dev/pages/RendererLab'));
const FSMConsole = lazy(() => import('@/dev/pages/FSMConsole'));
const LearnerProfileLab = lazy(() => import('@/dev/pages/LearnerProfileLab'));

/** A route whose page is its own chunk, wrapped in the Suspense that needs. */
const lazyRoute = (path: string, element: React.ReactNode) => (
  <Route key={path} path={path} element={<Suspense fallback={null}>{element}</Suspense>} />
);

export const AppRouter = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/play" element={<ModeSelect />} />
    {/*
      Story mode is a layout route, not a leaf: the element below stays mounted
      across all four screens, which is what lets one attempt's rolled level
      config survive briefing -> drive -> complete. Only `briefing` is a real
      entry point; `drive` and `complete` hold in-memory run state and redirect
      when loaded cold. See src/pages/story/StoryModeLayout.tsx.
    */}
    <Route path="/play/story" element={<StoryModeLayout />}>
      <Route index element={<LevelMapPage />} />
      <Route path=":levelId/briefing" element={<BriefingPage />} />
      <Route path=":levelId/drive" element={<DrivePage />} />
      <Route path=":levelId/complete" element={<CompletePage />} />
      {/* The pilot's post-test, opened by the facilitator by URL. */}
      <Route path="post-test" element={<PostTestPage />} />
      {/* The per-competency course's two exams (2026-10-28). */}
      <Route path="background" element={<BackgroundFormPage />} />
      <Route path="diagnostic" element={<DiagnosticPage />} />
      <Route path="post-exam" element={<PostExamPage />} />
    </Route>
    {lazyRoute('/learn/:levelId', <Learn />)}
    {lazyRoute('/play/eksamen', <EksamenMode />)}
    {lazyRoute('/play/daily', <DailyChallenge />)}
    {lazyRoute('/settings', <Settings />)}
    {lazyRoute('/admin', <Admin />)}

    {/* Firebase email link landing pages */}
    <Route path="/auth/reset-password" element={<ResetPassword />} />
    <Route path="/auth/verify-email" element={<VerifyEmail />} />

    {import.meta.env.DEV && [
      lazyRoute('/dev/gallery', <ComponentGallery />),
      lazyRoute('/dev/scenarios', <ScenarioLab />),
      lazyRoute('/dev/renderer', <RendererLab />),
      lazyRoute('/dev/fsm', <FSMConsole />),
      lazyRoute('/dev/profile', <LearnerProfileLab />),
    ]}

    <Route path="*" element={<NotFound />} />
  </Routes>
);
