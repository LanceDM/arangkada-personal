/**
 * The participant background form (study procedure step 2): after sign-in,
 * before the diagnostic. TENTATIVE: the questions and their options are
 * drafts for the group to review.
 *
 * MUTED for now (Lance, 2026-10-28): while BACKGROUND_FORM_ENABLED is false,
 * nobody is asked and Continue goes straight to the diagnostic. Turn it on by
 * setting it to true (or `backgroundFormEnabled` in Driving Sim's
 * dependencies, which overrides it).
 */
export const BACKGROUND_FORM_ENABLED = false;

export const BACKGROUND_FORM_VERSION = 1;

export interface BackgroundQuestion {
  id: string;
  prompt: string;
  options: readonly string[];
}

export const BACKGROUND_QUESTIONS: readonly BackgroundQuestion[] = [
  {
    id: 'license',
    prompt: 'Which license or permit do you hold now?',
    options: ['None', 'Student permit', 'Non-professional license', 'Professional license'],
  },
  {
    id: 'driving_experience',
    prompt: 'How much have you driven a car on real roads?',
    options: ['Never', 'Less than 6 months', '6 months to 2 years', 'More than 2 years'],
  },
  {
    id: 'driving_school',
    prompt: 'Have you taken a driving course (TDC or PDC) at a driving school?',
    options: ['No', 'Currently enrolled', 'Yes, finished'],
  },
  {
    id: 'gaming_frequency',
    prompt: 'How often do you play video games?',
    options: ['Never', 'Less than once a week', '1 to 3 times a week', 'Almost every day'],
  },
  {
    id: 'driving_games',
    prompt: 'Have you played driving games or driving simulators before?',
    options: ['Never', 'A few times', 'Often'],
  },
];

/** One participant's answers: each question id mapped to the option chosen. */
export interface BackgroundResponse {
  schemaVersion: 1;
  formVersion: number;
  answers: Record<string, string>;
  timestamp: number;
}

/** Every question answered with one of its own options. */
export const isCompleteBackground = (answers: Record<string, string | undefined>): answers is Record<string, string> =>
  BACKGROUND_QUESTIONS.every(q => answers[q.id] !== undefined && q.options.includes(answers[q.id]!));
