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
import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from '@/pages/landing/LandingPage';
import ModeSelect from '@/pages/mode-select/ModeSelectPage';
import StoryModeLayout from '@/pages/story/StoryModeLayout';
import LevelMapPage from '@/pages/story/LevelMapPage';
import BriefingPage from '@/pages/story/BriefingPage';
import DrivePage from '@/pages/story/DrivePage';
import CompletePage from '@/pages/story/CompletePage';
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
const PreTest = lazy(() => import('@/pages/pre-test/PreTestPage'));
// The study's post-test, not the frozen pilot's at /play/story/post-test.
const StudyPostTest = lazy(() => import('@/pages/post-test/PostTestPage'));
// The admin area: one layout, and each section a chunk of its own.
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('@/pages/admin/OverviewPage'));
const Pilot = lazy(() => import('@/pages/admin/PilotPage'));
const TestMode = lazy(() => import('@/pages/admin/TestModePage'));
const AdminReport = lazy(() => import('@/pages/admin/ReportPage'));
const AdminReplay = lazy(() => import('@/pages/admin/ReplayPage'));
const AdminRouting = lazy(() => import('@/pages/admin/RoutingPage'));
const AdminQLearning = lazy(() => import('@/pages/admin/QLearningPage'));
const AdminQuiz = lazy(() => import('@/pages/admin/QuizPage'));
const AdminIrt = lazy(() => import('@/pages/admin/IrtPage'));
// The study's own pages: a participant joins and signs in by username.
const StudyHome = lazy(() => import('@/pages/study/StudyHomePage'));
const StudyJoin = lazy(() => import('@/pages/study/StudyJoinPage'));
const StudySignIn = lazy(() => import('@/pages/study/StudySignInPage'));
const StudyConsent = lazy(() => import('@/pages/study/StudyConsentPage'));
const StudyBackground = lazy(() => import('@/pages/study/StudyBackgroundPage'));
const StudyDevice = lazy(() => import('@/pages/study/StudyDevicePage'));
const StudySurvey = lazy(() => import('@/pages/study/StudySurveyPage'));
const StudyDone = lazy(() => import('@/pages/study/StudyDonePage'));

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
    </Route>
    {lazyRoute('/learn/:levelId', <Learn />)}
    {lazyRoute('/play/eksamen', <EksamenMode />)}
    {lazyRoute('/play/daily', <DailyChallenge />)}
    {lazyRoute('/settings', <Settings />)}
    {/* The study's pre-test: a participant sits it, an admin previews it. */}
    {lazyRoute('/play/pre-test', <PreTest />)}
    {/* The study's two-stage post-test, the same who as the pre-test. */}
    {lazyRoute('/play/post-test', <StudyPostTest />)}
    {/* The admin area. Participants keeps its old path, /admin/pilot. */}
    <Route
      path="/admin"
      element={
        <Suspense fallback={null}>
          <AdminLayout />
        </Suspense>
      }
    >
      <Route index element={<AdminOverview />} />
      <Route path="pilot" element={<Pilot />} />
      <Route path="test-mode" element={<TestMode />} />
      <Route path="replay" element={<AdminReplay />} />
      <Route path="routing" element={<AdminRouting />} />
      <Route path="q-learning" element={<AdminQLearning />} />
      <Route path="irt" element={<AdminIrt />} />
      <Route path="report" element={<AdminReport />} />
      <Route path="quiz" element={<AdminQuiz />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Route>
    {lazyRoute('/study', <StudyHome />)}
    {lazyRoute('/study/join', <StudyJoin />)}
    {lazyRoute('/study/sign-in', <StudySignIn />)}
    {lazyRoute('/study/consent', <StudyConsent />)}
    {lazyRoute('/study/background', <StudyBackground />)}
    {lazyRoute('/study/device', <StudyDevice />)}
    {lazyRoute('/study/survey', <StudySurvey />)}
    {lazyRoute('/study/done', <StudyDone />)}

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
