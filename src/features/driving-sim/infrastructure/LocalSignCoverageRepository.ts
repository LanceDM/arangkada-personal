/** Sign-coverage persistence: one localStorage key, best-effort throughout. */
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import type { SignCoverageRepository } from '@/features/driving-sim/application/ports';

const STORAGE_KEY = 'arangkada_sign_coverage';

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const loadSignCoverage = (): SignCoverage => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as SignCoverage) : {};
  } catch {
    // A corrupt or unreadable record must never stop someone from driving.
    return {};
  }
};

const save = (coverage: SignCoverage) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(coverage));
  } catch {
    // Storage full or blocked: coverage is an optimisation, not a requirement.
  }
};

/** Notes that a plate was met, and whether the learner responded correctly. */
export const recordSignOutcome = (plateName: string, isCorrect: boolean): SignCoverage => {
  const coverage = loadSignCoverage();
  const previous = coverage[plateName];
  coverage[plateName] = {
    seen: (previous?.seen ?? 0) + 1,
    correct: (previous?.correct ?? 0) + (isCorrect ? 1 : 0),
    wrong: (previous?.wrong ?? 0) + (isCorrect ? 0 : 1),
    lastSeenAt: Date.now(),
  };
  save(coverage);
  return coverage;
};

export const localSignCoverageRepository: SignCoverageRepository = {
  load: loadSignCoverage,
  record: recordSignOutcome,
};
