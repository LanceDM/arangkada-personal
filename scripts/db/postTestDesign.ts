/**
 * The post-test's two-stage design, `test_designs/post`, which only this
 * script writes (the rules refuse every client, an admin's included).
 *
 *   npm run db:post-design -- show
 *   npm run db:post-design -- placeholder
 *   npm run db:post-design -- irt [--min 20] [--force]
 *
 * - `placeholder` (TENTATIVE): parallel blocks balanced by competency and
 *   cuts at thirds, so the post-test can open before there is any data.
 *   Every sitting under it records calibrationId `placeholder`.
 * - `irt`: each test item's Rasch difficulty from the share right on the
 *   pre-tests saved so far, blocks by difficulty and cuts at the pre-test
 *   takers' routing-score thirds (src/domain/assessment/assembleDesign.ts).
 *   Refused with fewer than --min pre-tests (default 20).
 *
 * Either refuses while any post-test is open (a sitting holds the design it
 * started under), unless --force. DRY_RUN=1 prints the design and writes
 * nothing.
 */
import { irtDesign, placeholderDesign, type DesignItem, type PreTestAnswers } from '@/domain/assessment/assembleDesign';
import { readTwoStageDesign } from '@/domain/assessment/twoStageDesign';
import { fail, firestore, flag, operator } from './admin';

const main = async () => {
  const db = firestore();
  const mode = process.argv[2];
  const dryRun = process.env.DRY_RUN === '1';
  const force = process.argv.includes('--force');
  const current = readTwoStageDesign((await db.doc('test_designs/post').get()).data() ?? null);

  if (mode === 'show' || !mode) {
    console.log(current ? JSON.stringify(current, null, 2) : 'No post-test design published yet.');
    return;
  }
  if (mode !== 'placeholder' && mode !== 'irt') fail('Usage: npm run db:post-design -- show | placeholder | irt [--min 20] [--force]');

  const items: DesignItem[] = (await db.collection('quiz_items').where('use', '==', 'test').get()).docs
    .filter(doc => doc.data().isActive === true)
    .map(doc => ({ id: doc.id, competency: String(doc.data().competency) }));

  const statuses = await db.collectionGroup('testStatus').get();
  const openPost = statuses.docs.filter(doc => doc.id === 'post' && doc.data().status === 'open').length;
  if (openPost > 0 && !force) fail(`${openPost} post-test(s) are open under the current design; wait for them to finish, or pass --force.`);

  const date = new Date().toISOString().slice(0, 10);
  let design;
  if (mode === 'placeholder') {
    design = placeholderDesign(items, `placeholder-${date}`);
  } else {
    const sittings = (await db.collectionGroup('testSittings').get()).docs.filter(doc => doc.id === 'pre');
    const min = Number(flag('min') ?? 20);
    if (sittings.length < min) fail(`Only ${sittings.length} pre-test(s) saved; the IRT design needs at least ${min} (--min to change).`);
    const pretests: PreTestAnswers[] = sittings.map(doc => {
      const responses = (doc.data().responses ?? []) as { itemId: string; correct: boolean; chosen: number | null }[];
      return {
        answered: new Set(responses.map(r => r.itemId)),
        correct: new Set(responses.filter(r => r.correct).map(r => r.itemId)),
      };
    });
    const built = irtDesign(items, pretests, `irt-${date}-n${pretests.length}`, `pretest-proportion-${date}-n${pretests.length}`);
    design = built.design;
    for (const item of built.difficulties) console.log(`${item.id.padEnd(10)} ${item.competency.padEnd(20)} b ${item.b.toFixed(2).padStart(6)}  (${item.correct}/${item.total})`);
  }

  console.log(JSON.stringify(design, null, 2));
  if (dryRun) {
    console.log('DRY_RUN: nothing written.');
    return;
  }
  await db.doc('test_designs/post').set({ ...design, publishedAt: Date.now(), publishedBy: operator(), previous: current?.designId ?? null });
  console.log(`Published ${design.designId} to test_designs/post${current ? ` (replacing ${current.designId})` : ''}.`);
};

main().then(
  () => process.exit(0),
  error => fail(String(process.env.DEBUG ? error?.stack : (error?.message ?? error)))
);
