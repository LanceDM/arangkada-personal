/**
 * Address of a route for a full page load, given its router path.
 *
 * The router adds the base itself, but `window.location` and links that leave
 * the app (an email's continue URL) do not: under a sub-path build a bare
 * `/play/story` would point past the app to the host's root. `BASE_URL` is
 * Vite's `base` and always ends in `/`; at the default `/` the path comes back
 * unchanged.
 */
export const appUrl = (routePath: string): string =>
  `${import.meta.env.BASE_URL}${routePath.replace(/^\/+/, '')}`;
