/**
 * Where a participant may be, at each stage of the study's order, and where the home's one "Next step" takes them.
 *
 * A participant gets no free replay, no Mock Exam, no Daily Challenge and no
 * lesson reader outside the briefing: every participant meets
 * the same course, the same way. The team's and the admins' accounts are not
 * study accounts and keep everything.
 */
import type { StudyStage } from '@/domain/study/studyStage';

export const STUDY_HOME = '/study';

/** The tracker's steps, in the study's order, in English and Filipino (the Filipino is the team's to check). */
export const STAGE_LABELS: Record<Exclude<StudyStage, 'withdrawn'>, { en: string; fil: string }> = {
  consent: { en: 'Consent', fil: 'Pahintulot' },
  background: { en: 'About you', fil: 'Tungkol sa iyo' },
  device: { en: 'Device check', fil: 'Pagsuri ng device' },
  'pre-test': { en: 'Pre-test', fil: 'Pre-test' },
  tutorial: { en: 'Tutorial', fil: 'Tutorial' },
  levels: { en: 'Levels 1–11', fil: 'Mga Level 1–11' },
  final: { en: 'Final Mission', fil: 'Huling misyon' },
  'post-test': { en: 'Post-test', fil: 'Post-test' },
  survey: { en: 'Survey', fil: 'Survey' },
  done: { en: 'Done', fil: 'Tapos na' },
};

export interface NextStep {
  to: string;
  /** Asks the course to enter its next entry on arrival, as the map's Continue does. */
  continueCourse: boolean;
  label: { en: string; fil: string };
}

const COURSE: NextStep = { to: '/play/story', continueCourse: true, label: { en: 'Continue the course', fil: 'Ituloy ang kurso' } };

export const nextStepOf = (stage: StudyStage): NextStep | null => {
  switch (stage) {
    case 'consent':
      return { to: '/study/consent', continueCourse: false, label: { en: 'Read the study information', fil: 'Basahin ang impormasyon' } };
    case 'background':
      return { to: '/study/background', continueCourse: false, label: { en: 'Tell us about you', fil: 'Sabihin ang tungkol sa iyo' } };
    case 'device':
      return { to: '/study/device', continueCourse: false, label: { en: 'Check your device', fil: 'Suriin ang iyong device' } };
    case 'pre-test':
      return { to: '/play/pre-test', continueCourse: false, label: { en: 'Take the pre-test', fil: 'Sagutan ang pre-test' } };
    case 'tutorial':
      return { ...COURSE, label: { en: 'Start the tutorial', fil: 'Simulan ang tutorial' } };
    case 'levels':
      return COURSE;
    case 'final':
      return { ...COURSE, label: { en: 'Start the Final Mission', fil: 'Simulan ang Huling misyon' } };
    case 'post-test':
      return { to: '/play/post-test', continueCourse: false, label: { en: 'Take the post-test', fil: 'Sagutan ang post-test' } };
    case 'survey':
      return { to: '/study/survey', continueCourse: false, label: { en: 'Answer the survey', fil: 'Sagutan ang survey' } };
    case 'done':
      return { to: '/study/done', continueCourse: false, label: { en: 'See your summary', fil: 'Tingnan ang buod' } };
    case 'withdrawn':
      return null;
  }
};

const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/**
 * Whether a study account may be on this path at this stage. The study's own
 * pages, Settings (password, sign-out) and the auth links always; the tests
 * and Story Mode only at their stage; nothing else. A study page checks its
 * own stage itself.
 */
export const studyAccountMayVisit = (stage: StudyStage | null, path: string): boolean => {
  if (under(path, STUDY_HOME) || under(path, '/settings') || under(path, '/auth')) return true;
  if (stage === null || stage === 'withdrawn') return false;
  if (under(path, '/play/pre-test')) return stage === 'pre-test';
  if (under(path, '/play/post-test')) return stage === 'post-test';
  if (under(path, '/play/story')) return stage === 'tutorial' || stage === 'levels' || stage === 'final';
  return false;
};
