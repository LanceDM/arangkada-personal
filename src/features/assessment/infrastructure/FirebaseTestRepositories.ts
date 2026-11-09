import { collection, doc, FieldPath, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { readQuizItem, type QuizItemDoc } from '@/features/driving-sim';
import { millisOf, readDraftAnswers } from '@/domain/assessment/sittingClock';
import { readTwoStageDesign } from '@/domain/assessment/twoStageDesign';
import type {
  TestDesignRepository,
  TestDraftRepository,
  TestItemRepository,
  TestSittingRepository,
} from '@/features/assessment/application/ports';
import { readPostTestStatus, readTestStatus } from '@/features/assessment/domain/testStatus';

/**
 * The test items, the design, the status, the draft and the record. The pre-test's query names `use == 'test'`, which is
 * what lets the rules allow a participant's list while their pre-test is open.
 * The post-test reads its items one document at a time, because the rules allow
 * a post-test item only by its block.
 *
 * Every time on the clock is a server timestamp the rules hold to
 * `request.time`, and is read back rather than assumed.
 */
export const firebaseTestItemRepository: TestItemRepository = {
  async loadTestItems() {
    const snap = await getDocs(query(collection(db, 'quiz_items'), where('use', '==', 'test')));
    return snap.docs
      .map(d => readQuizItem(d.id, d.data()))
      .filter((item): item is QuizItemDoc => item !== null);
  },
  async loadItemsById(ids) {
    const snaps = await Promise.all(ids.map(id => getDoc(doc(db, 'quiz_items', id))));
    return snaps
      .map(snap => (snap.exists() ? readQuizItem(snap.id, snap.data()) : null))
      .filter((item): item is QuizItemDoc => item !== null);
  },
};

export const firebaseTestDesignRepository: TestDesignRepository = {
  async loadPostTestDesign() {
    const snap = await getDoc(doc(db, 'test_designs', 'post'));
    return readTwoStageDesign(snap.exists() ? snap.data() : null);
  },
};

const statusRef = (uid: string, kind: string) => doc(db, 'users', uid, 'testStatus', kind);
const draftRef = (uid: string, kind: string) => doc(db, 'users', uid, 'testDrafts', kind);

export const firebaseTestSittingRepository: TestSittingRepository = {
  async status(uid, kind) {
    const snap = await getDoc(statusRef(uid, kind));
    return readTestStatus(snap.exists() ? snap.data() : null);
  },
  async postStatus(uid) {
    const snap = await getDoc(statusRef(uid, 'post'));
    return readPostTestStatus(snap.exists() ? snap.data() : null);
  },
  // One write: a draft is created only beside the status it belongs to.
  async open(uid, status) {
    const batch = writeBatch(db);
    batch.set(statusRef(uid, status.kind), { ...status, startedAt: serverTimestamp() });
    batch.set(draftRef(uid, status.kind), {
      schemaVersion: 1,
      kind: status.kind,
      seed: status.seed,
      answers: {},
      lastItem: null,
      syncAt: serverTimestamp(),
    });
    await batch.commit();
  },
  async enterStage2(uid, block) {
    await updateDoc(statusRef(uid, 'post'), { stage: 'stage2', block, stage2At: serverTimestamp() });
  },
  async startStage2(uid) {
    await updateDoc(statusRef(uid, 'post'), { stage2StartedAt: serverTimestamp() });
    const startedAt = millisOf((await getDoc(statusRef(uid, 'post'))).data()?.stage2StartedAt);
    if (startedAt === null) throw new Error('Part 2 has no start time.');
    return startedAt;
  },
  // One write: the rules accept the record only beside the status it finishes,
  // and finish the status only beside its record.
  async finish(uid, sitting) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'testSittings', sitting.kind), sitting);
    batch.update(statusRef(uid, sitting.kind), {
      status: 'finished',
      finishedAt: sitting.finishedAt,
    });
    await batch.commit();
  },
};

export const firebaseTestDraftRepository: TestDraftRepository = {
  async load(uid, kind) {
    return readDraftAnswers((await getDoc(draftRef(uid, kind))).data());
  },
  async saveAnswer(uid, kind, itemId, chosen) {
    await updateDoc(draftRef(uid, kind), new FieldPath('answers', itemId), { chosen, at: serverTimestamp() }, 'lastItem', itemId);
  },
  async serverTime(uid, kind) {
    await updateDoc(draftRef(uid, kind), { syncAt: serverTimestamp() });
    const now = millisOf((await getDoc(draftRef(uid, kind))).data()?.syncAt);
    if (now === null) throw new Error('The server gave no time.');
    return now;
  },
};
