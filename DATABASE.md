# Arangkada database

Everything the study records lives in Firebase. There are two implementations:

| | A: Firestore only (default) | B: Firestore + SQL Connect |
|---|---|---|
| Logs, Q-table, BKT, course state | Firestore | Firestore |
| Participants, admin grants, settings versions, background form answers | Firestore collections | SQL Connect (PostgreSQL) tables |
| Plan needed | Spark (free) | Blaze (SQL Connect's database is billed after its 3-month trial) |
| Switch | `VITE_DATABASE_MODE=firestore` | `VITE_DATABASE_MODE=firestore+sql` |

The app reaches every record through a port with one adapter per implementation, picked in the composition root (`src/app/dependencies`). The design and its reasons are in the "Arangkada — Database Architecture" doc.

Firestore has no schema of its own. The schema is `scripts/db/schema.ts`: every path, what it holds, who writes it, and a check for each document. `firestore.rules` enforces the same shapes on every app write, and `npm run db:validate` runs the checks over the whole database.

## Connect a new Firebase project

1. **Create the project** in the Firebase console. Turn on **Authentication** (Email/Password) and **Cloud Firestore** (production mode; a region near the participants, e.g. `asia-southeast1`).
2. **Register a web app** (Project settings → Your apps → Web). Copy `.env.sample` to `.env` and fill in the six `VITE_FIREBASE_*` values from the config shown.
3. **Point the CLI at it:** `npx firebase login`, then `npx firebase use --add` and pick the project (this updates `.firebaserc`).
4. **Deploy the rules and indexes:** `npm run db:deploy`.
5. **Get a service account key** (Project settings → Service accounts → Generate new private key). Save it outside the repo and set `GOOGLE_APPLICATION_CREDENTIALS` to its path. Never commit it; `.gitignore` refuses the usual names.
6. **Set up the study documents:** `npm run db:init`. It writes the settings version (`configVersions/{tag}` and `policy/config`), an empty shared Q-table, and `meta/schema`. Safe to run again.
7. **Make yourself admin:** sign up in the app, then `npm run db:role -- grant you@example.com --reason "study lead"`. Sign out and in again.
8. **Check everything:** `npm run db:validate`.
9. **Enrol participants** (optional, for study codes in the exports): `npm run db:participant -- enroll P01 person@example.com --consent v1`.

For Implementation B, also: move the project to Blaze, set `VITE_DATABASE_MODE=firestore+sql` in `.env`, run `npm run db:deploy:sql` (the first deploy creates the Cloud SQL instance named in `dataconnect/dataconnect.yaml`), and run the scripts with `DATABASE_MODE=firestore+sql`.

## What is recorded

### The event stream: `users/{uid}/events/{eventId}`

One document per thing that happened (`activity_opened` with `opens` > 1 marks a quiz or drive opened again at the same position), numbered 1, 2, 3... per participant (`seq`, from `users/{uid}/state/events`). Every event carries the envelope: `eventId` (made on the device, also the document id), `uid`, `at`, `serverAt`, `sessionId`, `appBuild` (the git commit), `configVersion`.

| Type | Written when | Payload |
|---|---|---|
| `session_started` | A signed-in participant opens the app, or signs in | Browser, language, screen, viewport, whether the session was restored |
| `page_viewed` | Every screen, app-wide | Path, query |
| `ui_action` | Anything else the participant does | The action and its details: signed in / up / out; menu choices (with whether the mode was locked); theme and setting changes; the initial exam viewed, started, closed; each background-form choice; Continue (or blocked: initial exam not taken); free replay chosen; every briefing action (module opened, closed, finished; each lesson section viewed and outline jump; quiz opened or closed; review opened, closed, finished; drive overview opened, closed; Drive clicked; back to the map); result-screen choices; mock exam start, every answer and change, question jumps, submit, retake; daily challenge answer; routing override; admin exports |
| `answer_given` | Each quiz, initial exam or post-exam answer, the moment it is given | Sitting, attempt, position, item, competency, choice, expected, correct, response ms (an abandoned sitting still shows how far it got) |
| `app_error` | Any error the app did not catch | Kind, message, stack, path |
| `course_transition` | Every cursor move | From, to, trigger, quiz progress, pending decisions |
| `item_answered` | Each quiz, diagnostic or post-exam item | Item, position, choice, expected, correct, response ms |
| `sitting_submitted` | Each sitting | Kind, attempt, items, correct |
| `drive_planned` | A course drive or free replay is composed | Seed, counted scenarios and where each came from, route, shortfall |
| `activity_opened` | A quiz or drive is opened at a course position | Kind, seed, how many times opened (more than 1 = a reload or a second tab, same seed) |
| `drive_started` | The participant starts driving | Seed, counted scenarios, route |
| `drive_exited` | A drive is left before its end (Exit, or the tab closed, best effort) | Reason, stage, time on the road, score so far, decisions so far (each also as a `decision_made` marked `partial`), key presses per key, the key trace (first 2,000 inputs) |
| `decision_made` | Each graded decision in a drive (course, final, free replay) | Scenario and its format, rule, competency, action, expected, result, points, reaction ms, timed out, question timed out |
| `drive_ended` | Each drive | Completed, score, crash reason, end reason, start and end time, key presses per key |
| `verdict_computed` | Each competency in a drive | Counted, correct, passed, the rule, the scenarios |
| `policy_decision` | Each routing decision | State, legal actions, Q and visits per action, probabilities, random draw, chosen action, warm-up phase, explore/exploit/forced, Q-log id |
| `reward_computed` | Each reward | A_next, Pass, H, r, what measured it, next state, the Q update it caused |
| `background_submitted` | The background form (muted for now) | Answers |

Every key pressed and released on the road (auto-repeat left out), with its time from the start of the drive, is saved beside each finished drive at `users/{uid}/attempts/{id}/telemetry/inputs` (up to 20,000 inputs; `truncated` says if more), so a drive can be rebuilt key by key.

Nothing is logged for a guest: the study requires signing in, and the modes stay locked until the initial exam is taken.

### The initial exam gate

The initial exam (the diagnostic, with the background form first when it is asked) is taken from its own section of the main menu (`/play/initial-exam`), not forced at the start of Story Mode. Until it is taken, Story Mode, the Daily Challenge and the mock exam are locked in the menu, and a direct link to any of them returns to the menu. Admins and developer builds see the lock but are not held by it, so the group can test each mode.

### BKT, per participant: `users/{uid}/bkt/profile` and `users/{uid}/bktUpdates/{updateId}`

The profile is the participant's BKT now: for each of the 11 competencies, P(L), level, whether the 3-drive-answer cap holds it below level 4, the starting P(L) after the diagnostic, and answers and correct answers per item class. It is rebuilt from every saved answer after each graded action, so it always equals what the answers say.

Each update entry (one per graded answer, `userSeq` 1, 2, 3...) holds: the source (item class, stage, scenario or question, rule), the raw answer and the expected one, response time, the T, S and G used, P(L) before, predicted P(correct), the posterior, P(L) after, level before and after, and all 11 P(L) values after. When the settings version changes, the whole history is replayed into new entries under the new version; the old entries stay. An in-drive question that ran out of time (30 s, Tentative) fails its scenario but has no BKT entry: it is logged as `decision_made` with `questionTimedOut`.

### The shared Q-table: `policy/competencyQ` and `policy/competencyQ/updates/{updateId}`

The table document holds Q, n and visits per state and action, each state's warm-up phase and tag (`exploring`, `exploiting`, `no_choice`), and the last change. The admin dashboard's **Q-table (live)** tab listens to it and to the newest log entries.

Every change writes a log entry in the same transaction, numbered by the table's own counter (`globalSeq`, assigned inside the transaction, so two participants can never get the same number):

- `visit` (a decision was made): the decision with its probabilities, random draw, tag (`explore`, `exploit`, `forced`), warm-up phase, and visits before and after;
- `learn` (a reward arrived): A_next, Pass, H, weights, r, what measured it (a quiz, a drive, the final exam or the post-exam), next state, max Q of the next state, γ, α, target, Q and n before and after.

Each entry also holds the whole table and every state's tag after it.

### Simultaneous participants: one transaction per course step

Every participant reads and changes the same shared table, often at the same moment, so each course step (lessons read, quiz submitted, review done, drive or final finished, post-exam submitted) is committed as **one Firestore transaction** (`commitStep` in `FirebaseCompetencyCourseRepository`) that:

1. reads the participant's stored cursor, the newest shared table, the settings version in force (`policy/config`) and the participant's evidence counter;
2. refuses the step if the stored cursor is not the one the step started from (`CourseConflictError`: a second tab, a double click, a retry of a step already saved), or if this copy of the app runs other settings than the ones in force (`OutdatedAppError`);
3. chooses the routing decisions and computes the rewards **from that newest table**;
4. writes, all or nothing: the step's own record (the quiz or post-exam sitting, or the drive, under a fixed id and numbered by the evidence counter), the table, its numbered log entries, the course log entry and the new cursor.

If another participant changes the table between the read and the write, Firestore discards the attempt and runs it again on the newer table (up to 12 times), so a decision is never made from a stale table and no update is lost or applied twice. The random draw is redone with it, and the logged draw is the one that was committed.

What is derived from those records is written right after the transaction: the event stream, the BKT log and the drive telemetry. If that write is lost, the next step catches the BKT log up, and the raw records it is built from are already saved.

### What keeps the algorithm's data whole

| Edge case | What happens |
|---|---|
| The save fails (connection, closed tab) and the participant retries | Nothing of the failed step was written, so the retry saves the answers once. |
| A step is submitted twice (double click, second tab, retry after a lost reply) | The second is refused: the cursor already moved. The page reloads the course. |
| The diagnostic is submitted twice | It has one fixed id (`assessmentSittings/diagnostic`); the second finds it saved and writes nothing. |
| The page is reloaded in a quiz or before a drive | The quiz or drive open at that course position is kept in `users/{uid}/state/active` with its seed, so the reload gets the same items or the same drive. Every open is logged (`activity_opened`, with how many times); a new position (the next attempt) opens a new one. |
| A tab is left open across a settings change | The transaction refuses the step (`OutdatedAppError`), and the rules refuse any Q-table change not made under the settings in force. |
| A tab is left open across a deploy | Each build writes `version.json` next to the app. Before each step the app reads it, past every cache; if the site now serves a newer build, the step is refused and the participant reloads. (If the file cannot be read, offline or on the dev server, the step goes ahead.) |
| Two tabs bring BKT up to date at once | Each BKT entry's id is fixed, `{settings version}_{userSeq}`, and written in a transaction that first checks it is not there yet: one tab writes, the other is skipped. |
| The device clock jumps (a manual change, a time sync) | BKT reads the drives and sittings in the order they were saved, by `evidenceSeq` (1, 2, 3... per participant, from `users/{uid}/state/evidence`, assigned in the saving transaction), and each one's answers in the order given. The device time is kept as a recorded field only. Records saved before the counter have no number and are read first, by their own time. |

The rules back this up: a table change must come with its log entry under the new counter and under the settings in force; a numbered drive or sitting must move the evidence counter in the same write; records are never rewritten; and the course cursor's decision counter cannot go backwards.

`competencyCourse.concurrency.test.ts` plays two participants committing at the same moment; `competencyCourse.integrity.test.ts` plays each edge case above.

### The shared Q-table is never reset

The table is shared by every participant, so it is never emptied, not even when the settings change: `npm run db:init` creates it only if it does not exist. Each update is tagged with the settings version it was made under (`configVersion` on every log entry), and the table document records, under `versions`, each settings version with the first `globalSeq` made under it. The analysis can therefore split the table's history by version, and `db:audit` reports the number of updates per version.

If the settings ever change mid-study, the table carries on learning from where it is; changing the reward weights means updates before and after the change were made with different reward functions, which the analysis should treat as two periods.

### Settings versions

`src/domain/study/runConfig.ts` holds every algorithm setting (BKT values, cutoffs, reward weights, γ, warm-up, rules) and its version tag, `RUN_CONFIG_VERSION`. Every logged record carries the tag. A test fails if a setting changes without the tag being bumped. `npm run db:init` writes each version to `configVersions/{tag}` and the active one to `policy/config`.

### People and roles

Two roles: **Admin** (the `admin` custom claim on the sign-in token) and **User** (everyone else). `npm run db:role` grants or revokes admin and records it in `roleGrants`. `npm run db:participant` enrols an account under a study code in `participants/{code}`.

### IRT

Decided shared (one set of item difficulties from all participants), method still open. Nothing is computed or stored yet; the raw answers it needs are in `item_answered` events and `assessmentSittings`. The export leaves IRT out.

## Exports

Admin → Export → **Study data**: the study JSON, and CSVs of the replayed BKT trajectory, the BKT log as logged, decisions, rewards, the Q-table log and the background form. Participants appear by user id and study code.

## Scripts

| Script | Does |
|---|---|
| `npm run db:deploy` | Deploys `firestore.rules` and `firestore.indexes.json` |
| `npm run db:deploy:sql` | Deploys `dataconnect/` (Implementation B) |
| `npm run db:init` | Settings version, active config, empty Q-table, schema version |
| `npm run db:validate` | Checks every document against the schema and the logs' numbering |
| `npm run db:audit [-- --out table.json]` | Recomputes the values from the raw records (see below); `--out` writes the table the log replays to |
| `npm run db:role -- grant\|revoke <email>` / `list` | Admin role, with an audit record |
| `npm run db:participant -- enroll\|finish <code> ...` / `list` | Study enrolment |
| `npm run emulators` / `npm run emulators:sql` | Local Firestore and Auth / local SQL Connect |

Run the scripts against the emulators with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.

## What the rules can and cannot protect

Every record is written from the participant's browser, so the rules decide who may write and in what shape, never whether a value is true. In particular:

- **The shared Q-table** can only change together with its log entry, under the settings in force: the counter only moves forward, the last change must name the participant writing it and the settings version in `policy/config`, and the named log entry must exist under the new counter in the same transaction. Every change is therefore attributed and on the record, but the numbers themselves are not checked.
- **A participant's own records** (course cursor, events, BKT profile and log) can only be written by that participant, append-only where they are logs.
- **Admin** is a custom claim only the role script can set; settings versions, enrolment and role grants are written only by the scripts.

The rules cannot check the values themselves: that would need server code (Cloud Functions, which need the Blaze plan) recomputing each step. Instead, **`npm run db:audit`** recomputes them after the fact from the raw records and reports every difference:

- **The shared Q-table:** the update log is replayed from an empty table, entry by entry: numbering, each reward from its parts, the target, Q, n and visits before and after, and each entry's table snapshot. The stored table must equal the replay.
- **Each participant's course log against the table's log:** every decision has its `visit` entry and every reward its `learn` entry (same participant, decision, action and reward); every table change by a participant is in their course log; each reward's accuracy and pass match the verdict recorded with it.
- **Each participant's BKT:** the whole log is rebuilt from the raw answers (drive attempts and sittings) and compared entry by entry, and the profile with the rebuilt profile. This also catches answers logged out of time order (a device clock that jumped, two tabs at once).

Run it after each session and before any analysis. A participant whose records fail it can be set aside, and `--out` gives the table the honest log adds up to.

## Open decisions

- **Free replays and BKT** (Tentative): a stage replayed from the map is saved like any drive and counts toward BKT and the drive-answer cap, as before. The alternative is to log replays but leave them out of BKT, so the routing is evaluated on the course's own measurements only. To be decided by the group.
- **Hosting on GitHub Pages**: the build already writes `version.json`. A project site served under `/<repo>/` will also need Vite's `base`, the router's `basename`, and a `404.html` fallback for client-side routes.

## Not yet verified

- `firestore.rules` has not been run on the emulator here (the emulator download is blocked in this environment). `scripts/db/rules.test.ts` covers the new paths and runs when `FIRESTORE_EMULATOR_HOST` is set.
- Implementation B (the `dataconnect/` schema and operations, and its adapters) has not been deployed or run against the SQL Connect emulator. Check it with `npm run emulators:sql` before switching.
