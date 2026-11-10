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
 * DRY_RUN=1 prints what it would write and writes nothing.
 */
import { QUESTION_BANK, RESERVED_FOR_POST_EXAM } from '@/domain/assessment/questionBank';
import { quizItemProblems, QUIZ_IMAGE_PREFIX, type QuizItemDraft } from '@/features/driving-sim/domain/scenario/quizBank';
import { fail, firestore, operator } from './admin';

const main = async () => {
  const db = firestore();
  const dryRun = process.env.DRY_RUN === '1';
  const tests = process.argv.includes('--tests');
  const use = tests ? 'test' : 'quiz';
  const now = Date.now();
  const items = QUESTION_BANK.filter(item => RESERVED_FOR_POST_EXAM.has(item.id) === tests);
  const existing = new Set((await db.collection('quiz_items').select().get()).docs.map(doc => doc.id));

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

main().then(
  () => process.exit(0),
  error => fail(String(process.env.DEBUG ? error?.stack : (error?.message ?? error)))
);
