/**
 * The Terms and Data Use a person agrees to before an account is made
 * (2026-11-13): what the app collects, what it is used for, and their choices.
 * Bump `TERMS_VERSION` whenever the text changes: each account records the
 * version it agreed to.
 */
export const TERMS_VERSION = '2026-11-13';

export const TERMS_MIN_AGE = 18;

export const TERMS_TITLE = 'Terms and Data Use';

export const TERMS_SECTIONS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'About Arangkada',
    body: 'Arangkada is a review app for driving rules and safe driving. It is a learning tool. It is not an official product of the Land Transportation Office (LTO), and using it does not guarantee that you will pass any exam.',
  },
  {
    title: 'What we collect',
    body: 'Your account details (email and username); your answers to the tests and quizzes; what you do in the driving scenarios; your scores, progress and the time you take; and basic technical information about your session, such as the device type and the app version.',
  },
  {
    title: 'How we use it',
    body: 'To run the app and save your progress; to choose what you practise next; and to study and improve how well the app teaches, which includes research and analysis of the collected data. Results are reported for groups of users only. You will never be named.',
  },
  {
    title: 'Storage and sharing',
    body: 'Your data is stored on secured cloud servers (Google Firebase) and is read only by the Arangkada team. We do not sell it, and we do not share it for advertising.',
  },
  {
    title: 'Your choices',
    body: 'Using Arangkada is voluntary, and you may stop at any time. Under the Data Privacy Act of 2012 (Republic Act No. 10173) you may ask to see, correct or delete your data by contacting the Arangkada team.',
  },
  {
    title: 'Fair use',
    body: 'Use your own account, answer for yourself, and do not try to disrupt the app or access data that is not yours.',
  },
];

export const TERMS_AGREEMENT = `I am ${TERMS_MIN_AGE} or older, and I agree to the Terms and Data Use.`;

export const TERMS_REQUIRED = 'Please read and agree to the Terms and Data Use to continue.';
