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

One document per thing that happened, numbered 1, 2, 3... per participant (`seq`, from `users/{uid}/state/events`). Every event carries the envelope: `eventId` (made on the device, also the document id), `uid`, `at`, `serverAt`, `sessionId`, `appBuild` (the git commit), `configVersion`.

| Type | Written when | Payload |
|---|---|---|
| `session_started` | Story Mode opens for a signed-in participant | Browser, language, screen, viewport |
| `page_viewed` | Each Story Mode screen | Path |
| `course_transition` | Every cursor move | From, to, trigger, quiz progress, pending decisions |
| `item_answered` | Each quiz, diagnostic or post-exam item | Item, position, choice, expected, correct, response ms |
| `sitting_submitted` | Each sitting | Kind, attempt, items, correct |
| `drive_planned` | A course drive is composed | Seed, counted scenarios and where each came from, route, shortfall |
| `decision_made` | Each graded decision in a drive (course, final, free replay) | Scenario and its format, rule, competency, action, expected, result, points, reaction ms, timed out, question timed out |
| `drive_ended` | Each drive | Completed, score, crash reason, end reason, start and end time |
| `verdict_computed` | Each competency in a drive | Counted, correct, passed, the rule, the scenarios |
| `policy_decision` | Each routing decision | State, legal actions, Q and visits per action, probabilities, random draw, chosen action, warm-up phase, explore/exploit/forced, Q-log id |
| `reward_computed` | Each reward | A_next, Pass, H, r, what measured it, next state, the Q update it caused |
| `background_submitted` | The background form (muted for now) | Answers |

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

1. reads the participant's stored cursor and the newest shared table;
2. refuses the step (`CourseConflictError`) if the stored cursor is not the one the step started from: a second tab, a double click, or a request sent twice;
3. chooses the routing decisions and computes the rewards **from that newest table**;
4. writes the table, its numbered log entries, the participant's course log entry and the new cursor together.

If another participant changes the table between the read and the write, Firestore discards the attempt and runs it again on the newer table (up to 12 times), so a decision is never made from a stale table and no update is lost or applied twice. The random draw is redone with it, and the logged draw is the one that was committed. A step that is refused shows the participant where their course really is; answers and drives are checked against the stored cursor before they are saved, so a double submit does not record them twice.

The rules back this up: a table change must come with its log entry under the new counter, and the course cursor's decision counter cannot go backwards, so an old cursor cannot be written over a newer one. `competencyCourse.concurrency.test.ts` plays two participants committing at the same moment and checks that the log is numbered without gaps, that replaying it gives the stored table, and that a double submit is refused without a second record.

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

- **The shared Q-table** can only change together with its log entry: the counter only moves forward, the last change must name the participant writing it, and the named log entry must exist under the new counter in the same transaction. Every change is therefore attributed and on the record, but the numbers themselves are not checked.
- **A participant's own records** (course cursor, events, BKT profile and log) can only be written by that participant, append-only where they are logs.
- **Admin** is a custom claim only the role script can set; settings versions, enrolment and role grants are written only by the scripts.

The rules cannot check the values themselves: that would need server code (Cloud Functions, which need the Blaze plan) recomputing each step. Instead, **`npm run db:audit`** recomputes them after the fact from the raw records and reports every difference:

- **The shared Q-table:** the update log is replayed from an empty table, entry by entry: numbering, each reward from its parts, the target, Q, n and visits before and after, and each entry's table snapshot. The stored table must equal the replay.
- **Each participant's course log against the table's log:** every decision has its `visit` entry and every reward its `learn` entry (same participant, decision, action and reward); every table change by a participant is in their course log; each reward's accuracy and pass match the verdict recorded with it.
- **Each participant's BKT:** the whole log is rebuilt from the raw answers (drive attempts and sittings) and compared entry by entry, and the profile with the rebuilt profile. This also catches answers logged out of time order (a device clock that jumped, two tabs at once).

Run it after each session and before any analysis. A participant whose records fail it can be set aside, and `--out` gives the table the honest log adds up to.

## Not yet verified

- `firestore.rules` has not been run on the emulator here (the emulator download is blocked in this environment). `scripts/db/rules.test.ts` covers the new paths and runs when `FIRESTORE_EMULATOR_HOST` is set.
- Implementation B (the `dataconnect/` schema and operations, and its adapters) has not been deployed or run against the SQL Connect emulator. Check it with `npm run emulators:sql` before switching.
