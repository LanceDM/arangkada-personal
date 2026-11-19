/**
 * npm run db:seed-quiz
 *
 * Moves the bundled short-quiz bank (src/domain/assessment/questionBank.json,
 * the team's question bank) into Firestore's `quiz_items`, where an admin
 * edits it under Admin > Quiz items and the course's short quiz reads it.
 *
 * - Each item keeps its Item ID (e.g. `L1-DL-01`) as its document id, under
 *   the module that teaches it (`lto_level_{stage}`), as a `quiz` item.
 * - The post-exam's reserved items are left out: the study's tests are the
 *   team's own `test` items.
 * - An id already in the bank is never overwritten, so an admin's edits (and
 *   any `test` item with the same id) stay as they are. Safe to run again.
 *
 * npm run db:seed-tests  (--tests)
 *
 * Writes the 60 items the bundled bank holds back from the quizzes (5 or 6
 * per competency) as the pre-test's `test` items. The pre-test opens only
 * on exactly 60 switched-on test items. The admin can replace them under
 * Admin > Quiz items; ids already in the bank are left as they are.
 *
 * npm run db:seed-quiz -- --sync   (and db:seed-tests -- --sync)
 *
 * Brings items already in the bank up to the bundled bank (2026-11-13, the
 * law-first sources and the items corrected against the law). An item no
 * admin has edited (revision 1) takes the bundled question, choices, answer
 * and source. An item an admin has edited keeps its text and takes only the
 * bundled source; it is listed so its text can be checked by hand. Either
 * way the revision goes up by one. Items already equal are left alone.
 *
 * DRY_RUN=1 prints what it would write and writes nothing.
 */
import { QUESTION_BANK, RESERVED_FOR_POST_EXAM } from '@/domain/assessment/questionBank';
import { quizItemProblems, QUIZ_IMAGE_PREFIX, type QuizItemDraft } from '@/features/driving-sim/domain/scenario/quizBank';
import { fail, firestore, operator } from './admin';

const main = async () => {
  const db = firestore();
  const dryRun = process.env.DRY_RUN === '1';
  const tests = process.argv.includes('--tests');
  const sync = process.argv.includes('--sync');
  const use = tests ? 'test' : 'quiz';
  const now = Date.now();
  const items = QUESTION_BANK.filter(item => RESERVED_FOR_POST_EXAM.has(item.id) === tests);
  const existing = new Set((await db.collection('quiz_items').select().get()).docs.map(doc => doc.id));
  if (sync) return syncExisting(db, items, dryRun, now);

  let written = 0;
  let kept = 0;
  const problems: string[] = [];
  let batch = db.batch();
  let pending = 0;
  for (const [order, item] of items.entries()) {
    if (existing.has(item.id)) {
      kept += 1;
      continue;
    }
    const image = item.image ? (item.image.startsWith('/') ? item.image : `/${item.image}`) : '';
    const draft: QuizItemDraft = {
      moduleId: `lto_level_${item.stage}`,
      question: item.question,
      options: item.choices,
      correctIndex: item.answer,
      explanation: '',
      image: image.startsWith(QUIZ_IMAGE_PREFIX) ? image : '',
      competency: item.competency,
      source: item.source,
      use,
      isActive: true,
      order,
    };
    const wrong = quizItemProblems(draft);
    if (wrong.length > 0) {
      problems.push(`${item.id}: ${wrong.join(' ')}`);
      continue;
    }
    written += 1;
    if (dryRun) continue;
    batch.set(db.doc(`quiz_items/${item.id}`), {
      ...draft,
      schemaVersion: 1,
      id: item.id,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: operator(),
    });
    if (++pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (!dryRun && pending > 0) await batch.commit();
  for (const line of problems) console.warn(`Skipped ${line}`);
  console.log(`${dryRun ? 'Would write' : 'Wrote'} ${written} ${use} items; ${kept} already in the bank were left as they are; ${problems.length} skipped.`);
};

type BundledItem = (typeof QUESTION_BANK)[number];

const sameList = (a: unknown, b: readonly string[]) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

const syncExisting = async (db: ReturnType<typeof firestore>, items: readonly BundledItem[], dryRun: boolean, now: number) => {
  let full = 0;
  let sourceOnly = 0;
  let same = 0;
  const editedByAdmin: string[] = [];
  let batch = db.batch();
  let pending = 0;
  for (const item of items) {
    const ref = db.doc(`quiz_items/${item.id}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = snap.data() as { question?: string; options?: unknown; correctIndex?: number; source?: string; revision?: number };
    const revision = typeof data.revision === 'number' ? data.revision : 1;
    const unedited = revision === 1;
    const textDiffers = data.question !== item.question || !sameList(data.options, item.choices) || data.correctIndex !== item.answer;
    const sourceDiffers = data.source !== item.source;
    if (!sourceDiffers && (!textDiffers || !unedited)) {
      same += 1;
      if (textDiffers) editedByAdmin.push(item.id);
      continue;
    }
    const update: Record<string, unknown> = { source: item.source, revision: revision + 1, updatedAt: now, updatedBy: operator() };
    if (unedited && textDiffers) {
      Object.assign(update, { question: item.question, options: item.choices, correctIndex: item.answer });
      full += 1;
    } else {
      sourceOnly += 1;
      if (textDiffers) editedByAdmin.push(item.id);
    }
    if (dryRun) continue;
    batch.update(ref, update);
    if (++pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (!dryRun && pending > 0) await batch.commit();
  const verb = dryRun ? 'Would update' : 'Updated';
  console.log(`${verb} ${full} items in full and ${sourceOnly} by their source only; ${same} were already up to date.`);
  if (editedByAdmin.length > 0) {
    console.log(`Edited by an admin, so their text was kept; check it against the bundled bank: ${editedByAdmin.join(', ')}`);
  }
};

main().then(
  () => process.exit(0),
  error => fail(String(process.env.DEBUG ? error?.stack : (error?.message ?? error)))
);
