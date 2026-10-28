/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const EMPTY_MODULE = '\0arangkada:dev-page-stub'

/**
 * Keeps the dev tooling out of a production build entirely.
 *
 * `/dev/*` routes are lazy and `import.meta.env.DEV`-gated, so nothing dev-only
 * ever executes in production and no dev path reaches the main bundle. Rollup
 * still emitted a chunk for each of them, because `import('...')` with a
 * literal path is statically analysable and gets a chunk regardless of whether
 * anything can reach it.
 *
 * Resolving those imports to an empty module in a production build means the
 * chunks are never emitted. If anything outside `src/dev` ever imports a dev
 * page for real, this turns that into a blank screen rather than a silent
 * inclusion — which is why the architecture lint forbids it in the first place.
 */
const stripDevPages = (): Plugin => ({
  name: 'arangkada:strip-dev-pages',
  apply: (_config, { command, mode }) => command === 'build' && mode === 'production',
  enforce: 'pre',
  resolveId(source) {
    return source.includes('/dev/pages/') ? EMPTY_MODULE : null
  },
  load(id) {
    return id === EMPTY_MODULE ? 'export default () => null;' : null
  },
})

/** The commit the app is built from, stamped on every logged study record. */
const appBuild = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
})()

const build = process.env.VITE_APP_BUILD ?? appBuild

/**
 * Writes `version.json` ({ build }) next to the built app. A static host
 * (GitHub Pages) serves it like any file; an open tab fetches it before each
 * course step and refuses to save with an older build (see composition.ts).
 */
const versionFile = (): Plugin => ({
  name: 'arangkada:version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build }) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_BUILD': JSON.stringify(build),
  },
  plugins: [react(), tailwindcss(), stripDevPages(), versionFile()],
  cacheDir: '.vite-cache',
    resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    // Pure-logic tests only for now (scenario data, pooling, rule engine) -
    // no DOM needed, so the default 'node' environment is enough. Globals are
    // deliberately left off: tests import describe/it/expect from 'vitest'
    // explicitly, so no ambient test-global types need to be added to
    // tsconfig.app.json, keeping `tsc -b`'s production build unaffected.
    environment: 'node',
  },
})
