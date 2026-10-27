import type { AttemptRow, UserRow } from './adminReport';

export const countCompletedLevels = (users: UserRow[]) =>
  users.reduce((total, row) => {
    const levelResults = Object.values(row.progress?.levelResults ?? {});
    return total + levelResults.filter((result) => result.completed).length;
  }, 0);

export const countTotalViolations = (attempts: AttemptRow[]) =>
  attempts.reduce((total, row) => total + row.violations, 0);

export const countTotalCorrectDecisions = (attempts: AttemptRow[]) =>
  attempts.reduce((total, row) => total + row.correctDecisions, 0);

export const calculateAverageScore = (attempts: AttemptRow[]) =>
  attempts.length ? Math.round(attempts.reduce((total, row) => total + row.finalScore, 0) / attempts.length) : 0;

export const getTopWeakCompetencies = (users: UserRow[]) => {
  const counts = new Map<string, number>();

  for (const row of users) {
    for (const result of Object.values(row.progress?.levelResults ?? {})) {
      if (result.weakestCompetency) {
        counts.set(result.weakestCompetency, (counts.get(result.weakestCompetency) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
};
