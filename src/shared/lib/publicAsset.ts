/**
 * URL of a file under `public/`, given its path relative to that folder.
 *
 * The app is not always served from the domain root: a GitHub Pages build
 * lives under `/<repo>/`. `BASE_URL` is Vite's `base` and always ends in `/`,
 * so a hard-coded leading `/` would point past the app to the host's root.
 */
export const publicAsset = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

/**
 * An image path as stored (the quiz bank keeps `/arangkada_extracted_images/...`,
 * the bundled bank `arangkada_extracted_images/...`): a full URL is left as it
 * is, anything else is a file under `public/`.
 */
export const imageUrl = (path: string): string => (/^(https?:|data:|blob:)/.test(path) ? path : publicAsset(path));
