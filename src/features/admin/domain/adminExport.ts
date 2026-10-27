import type { AdminData, AttemptRow, RuleSummary } from './adminReport';

const escapeCSV = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const downloadFile = (fileName: string, body: string, type: string) => {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const buildAdminJSONExport = (data: AdminData, rules: RuleSummary[]) =>
  JSON.stringify({ ...data, rules }, null, 2);

export const buildAttemptsCSV = (attempts: AttemptRow[]) => {
  const header = ['userId', 'levelId', 'timestamp', 'finalScore', 'violations', 'correctDecisions'];
  const rows = attempts.map((attempt) =>
    [
      attempt.userId,
      attempt.levelId,
      attempt.timestamp,
      attempt.finalScore,
      attempt.violations,
      attempt.correctDecisions,
    ]
      .map(escapeCSV)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
};
