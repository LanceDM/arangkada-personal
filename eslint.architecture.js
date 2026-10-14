/**
 * The architecture's import rules, as lint.
 *
 * The architecture is described in prose elsewhere; this is the copy that is
 * actually checked, so the prose cannot quietly drift from the code. Each rule
 * is a set of forbidden import patterns matched against the import source
 * string — which is why a relative `../infrastructure/X` is caught alongside an
 * aliased `@/features/auth/infrastructure/X`.
 *
 * The layering, in one line:
 *
 *   presentation -> application -> domain,  infrastructure -> ports + domain
 *
 * One config object per file glob, each carrying the *complete* pattern list
 * for that glob. ESLint replaces a rule's options rather than merging them, so
 * two blocks that both set `no-restricted-imports` over the same file would
 * silently leave only the later one in force.
 *
 * Two exceptions exist, both narrow and both deliberate:
 *
 *   - `src/app/dependencies` is the composition root. It may reach a feature's
 *     `composition.ts` — the entry point each feature exposes for exactly this
 *     purpose — but nothing deeper.
 *   - a feature's own `composition.ts` may import its own infrastructure. That
 *     is its whole job, and it sits outside the layer folders, so the layer
 *     rules do not apply to it.
 */

export const FEATURES = [
  'auth',
  'progression',
  'driving-sim',
  'daily-challenge',
  'mock-exam',
  'admin',
];

/** Frameworks, I/O and UI that domain code may not reach for. */
const FRAMEWORK_AND_IO = [
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  'react-router-dom',
  'zustand',
  'zustand/*',
  'firebase',
  'firebase/*',
  'next-themes',
  'sonner',
  'lucide-react',
  '@/shared/infrastructure/**',
  '@/shared/ui/**',
];

const ABOVE_APPLICATION = ['**/presentation/**'];
const IMPLEMENTATIONS = ['**/infrastructure/**'];
const UPWARD = ['@/app/**', '@/pages/**'];
const DEV_ONLY = ['@/dev/**'];

/** Every path that reaches inside a feature other than `self`. */
const otherFeatures = self =>
  FEATURES.filter(name => name !== self).map(name => `@/features/${name}/*/**`);

/** Every path that reaches inside any feature. */
const anyFeatureInternals = FEATURES.map(name => `@/features/${name}/*/**`);

const block = (files, patterns, message) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
  },
});

const LAYER_MESSAGE = {
  domain:
    'Domain code imports no framework and no I/O — no React, canvas, Firebase, Zustand or browser storage — and nothing from a layer above it.',
  application:
    'Application code depends on ports, not implementations, and never on the layers above it. Add the call to the feature port and bind it in composition.ts.',
  presentation:
    'Presentation reaches infrastructure only through the application layer, and never depends upward on app/ or pages/.',
  infrastructure:
    'Infrastructure implements this feature’s ports over its domain contracts. It draws nothing and knows no other feature.',
};

export const architectureRules = (features = FEATURES) => [
  // ── The shared learner model: pure, and blind to every feature. ──────────
  block(
    ['src/domain/**/*.{ts,tsx}'],
    [...FRAMEWORK_AND_IO, ...ABOVE_APPLICATION, ...IMPLEMENTATIONS, ...UPWARD, ...DEV_ONLY, '@/features/**'],
    'src/domain/learner is the model every feature shares: it imports no feature, no framework and no I/O.'
  ),

  // ── Each feature's four layers. ─────────────────────────────────────────
  ...features.flatMap(self => [
    block(
      [`src/features/${self}/domain/**/*.{ts,tsx}`],
      [
        ...FRAMEWORK_AND_IO,
        ...ABOVE_APPLICATION,
        ...IMPLEMENTATIONS,
        ...UPWARD,
        ...DEV_ONLY,
        ...otherFeatures(self),
        `@/features/${self}/application/**`,
      ],
      LAYER_MESSAGE.domain
    ),
    block(
      [`src/features/${self}/application/**/*.{ts,tsx}`],
      [...ABOVE_APPLICATION, ...IMPLEMENTATIONS, ...UPWARD, ...DEV_ONLY, ...otherFeatures(self)],
      LAYER_MESSAGE.application
    ),
    block(
      [`src/features/${self}/presentation/**/*.{ts,tsx}`],
      [...IMPLEMENTATIONS, ...UPWARD, ...otherFeatures(self)],
      LAYER_MESSAGE.presentation
    ),
    block(
      [`src/features/${self}/infrastructure/**/*.{ts,tsx}`],
      [...ABOVE_APPLICATION, ...UPWARD, ...DEV_ONLY, ...otherFeatures(self)],
      LAYER_MESSAGE.infrastructure
    ),
    // index.ts and composition.ts: still opaque to other features.
    block(
      [`src/features/${self}/*.{ts,tsx}`],
      [...UPWARD, ...DEV_ONLY, ...otherFeatures(self)],
      `Never deep-import another feature from ${self}. Use that feature's index.ts.`
    ),
  ]),

  // ── shared/ sits beneath the features and knows none of them. ───────────
  block(
    ['src/shared/**/*.{ts,tsx}'],
    ['@/features/**', '@/app/**', '@/domain/**', '@/pages/**', '@/dev/**'],
    'shared/ sits beneath the features and may not import any of them.'
  ),

  // ── Pages compose feature public APIs. ──────────────────────────────────
  block(
    ['src/pages/**/*.{ts,tsx}'],
    [...anyFeatureInternals, '@/features/*/composition'],
    "Pages compose feature public APIs. Import from the feature's index.ts, not its internals."
  ),

  // ── app/ is the composition root; only dependencies/ may wire. ───────────
  {
    ...block(
      ['src/app/**/*.{ts,tsx}'],
      [...anyFeatureInternals, '@/features/*/composition'],
      'Only app/dependencies wires implementations. Everything else in app/ uses feature public APIs.'
    ),
    ignores: ['src/app/dependencies/**'],
  },
  block(
    ['src/app/dependencies/**/*.{ts,tsx}'],
    anyFeatureInternals,
    'The composition root reaches a feature through its composition.ts, never deeper.'
  ),
];
