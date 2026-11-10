# Arangkada

Arangkada is a browser-based driving education app for Philippine driver's
license exam preparation. Learners play story missions in a canvas driving
simulation, take daily challenges and sit a mock exam. It is built with React,
TypeScript, Vite, Tailwind CSS and Firebase.

## Features

- Story Mode: mission briefings, lesson modules, quizzes, and a canvas driving
  simulation built on an authoritative world model and a typed scene graph.
- A driving finite-state machine (`features/driving-sim/domain/fsm`) that
  decides when a scenario is approached, opened and graded.
- A routing finite-state machine (`domain/routing`) that decides, after each
  level, which level comes next and what practice is added to it.
- A learner model: BKT mastery estimates per competency, and a Q-learning
  policy over the routing machine's legal moves.
- Daily Challenge and a Mock Exam over an LTO-style question bank.
- Firebase email/password and Google sign-in, and Firestore-backed progress.

## Setup

You need **Node.js 20.19 or newer** (22 LTS recommended) and **Java 11 or
newer**, which the Firebase emulators run on.

On Windows, some image paths are long. If cloning fails with "Filename too
long", run this once and clone again:

```bash
git config --global core.longpaths true
```

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local Firebase emulators (Auth and Firestore) in one terminal:

   ```bash
   npm run emulators
   ```

   Their dashboard is at http://127.0.0.1:4000.

3. In a second terminal, add the placeholder quizzes. Without them every
   level's Short Quiz is blocked and **Drive stays locked**. The emulators
   forget everything when they stop, so run this after each start:

   ```bash
   npm run seed
   ```

   The quiz questions are placeholders, not real exam content: pick
   "Keyed answer". To use the admin pages, sign up in the app, run
   `npm run seed -- --admin you@example.com`, then sign out and back in.

4. Start the app, and open the address it prints:

   ```bash
   npm run dev
   ```

There is no `.env` to create: with no Firebase key configured, the app uses
the local emulators. Everything you do here stays on your machine: accounts
you sign up and the progress they save live in the emulators, and are gone
when the emulators stop. Without the emulators running the game still opens
and plays as a guest, but signing in fails. Never put a real Firebase
project's keys in a `.env` here.

## Commands

```bash
npm run test       # every test
npm run lint       # ESLint, including the architecture's import rules
npm run build      # type-check, then a production build
```

- `npm run fsm:check` compares the driving FSM against its committed golden,
  and `npm run routing:check` does the same for the routing FSM. Both write
  nothing and fail on a difference.

### Goldens

Recordings pin behaviour that is hard to assert directly. A failing golden test
means something changed. Regenerate one only when that change was intended,
and say so in your pull request.

| Golden | What it pins | Regenerate |
|---|---|---|
| `drive.golden.json` | What the world does over the scripted drives | `npx tsx scripts/captureDriveGolden.ts` |
| `render.golden.json` | Every canvas operation, over the scene samples | `npx tsx scripts/captureRenderGolden.ts` |
| `collision.golden.json` | Every solid body, over the same samples | `npx tsx scripts/captureCollisionGolden.ts` |
| `characterization.golden.json` | The driving FSM's structure | `npm run fsm:update-golden` |
| `routingCharacterization.golden.json` | The routing FSM's structure | `npm run routing:update-golden` |

A change to a scene's geometry moves the render and collision goldens
together, so regenerate both.

## Project Layout

Arangkada is a **modular monolith**: one deployable, divided into feature
modules that each own their presentation, application, domain and
infrastructure.

- `src/main.tsx` - entry point; binds feature dependencies, mounts the app.
- `src/app/` - composition root: providers, router, progress sync, app shell.
- `src/pages/<route>/` - one folder per route; composition only.
- `src/features/` - `auth`, `progression`, `driving-sim`, `daily-challenge`, `assessment`, `study`,
  `mock-exam`, `admin`. Each exposes a public API through its `index.ts`.
- `src/domain/learner/` - the learner model shared across features.
- `src/domain/routing/` - the routing FSM over the course's levels.
- `src/shared/` - UI primitives, hooks, and the Firebase client.
- `src/dev/` - development-only tooling, never reachable in production.
- `public/arangkada_extracted_images/` - curriculum image assets.

Story Mode's simulation lives in `features/driving-sim`. "Story Mode" is still
the product name, and `/play/story` is still the route.

In a development build, five tools are available: `/dev/renderer`,
`/dev/scenarios`, `/dev/gallery`, `/dev/fsm` and `/dev/profile`.

## Development Rules

- Import through the `@/` alias.
- Never deep-import another feature - use its `index.ts`.
- Domain code imports no React, canvas, Firebase or browser storage.
- Keep route orchestration in `src/pages`; keep decisions in features.

These are not conventions to remember: `eslint.architecture.js` states them as
lint rules, so `npm run lint` fails on a violation.

## Contributing

1. Pull the latest `main`, then create a branch for your change.
2. Before you push, run `npm run test`, `npm run lint` and `npm run build`.
3. Open a pull request into `main` and describe what changed and why.
4. Pull requests are merged with **Squash and merge**, so each one lands as a
   single commit.

Keep new files inside `src/`, `public/` or the project root.
