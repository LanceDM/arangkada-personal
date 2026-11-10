/**
 * Whether the site is open to players (2026-11-10): an admin can suspend it,
 * for example to stop a session or fix something mid-study. While suspended,
 * every page but the admin area shows a paused screen to everyone but admins.
 * Stored in `site/status`, which anyone may read and only an admin may write.
 */
export interface SiteStatus {
  suspended: boolean;
  /** Shown to players while suspended; empty for the default text. */
  message: string;
  updatedAt: number;
  updatedBy: string;
}

export const SITE_OPEN: SiteStatus = { suspended: false, message: '', updatedAt: 0, updatedBy: '' };

export const MAX_SITE_MESSAGE = 300;

export const readSiteStatus = (data: Record<string, unknown> | undefined | null): SiteStatus =>
  data && typeof data.suspended === 'boolean'
    ? {
        suspended: data.suspended,
        message: typeof data.message === 'string' ? data.message : '',
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
      }
    : SITE_OPEN;
