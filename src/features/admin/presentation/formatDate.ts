export const toDateTime = (value: number | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

/** "17 Oct 2026". */
export const toDate = (value: number | null | undefined) =>
  value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

/** "17 Oct, 14:05". */
export const toShortDateTime = (value: number | null | undefined) =>
  value ? new Date(value).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export const toRelative = (value: number | null | undefined, now = Date.now()) => {
  if (!value) return '-';
  const minutes = Math.floor(Math.max(0, now - value) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / (24 * 60));
  return days < 14 ? `${days} day${days === 1 ? '' : 's'} ago` : toDate(value);
};
