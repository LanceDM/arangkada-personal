/**
 * One sitting of a test, the pre-test's or the post-test's: open the status, read the items, present them by the
 * status's seed, one at a time and forward only, against each stage's
 * countdown, and save the record once.
 *
 * The server holds the sitting. The deadlines count from server timestamps on
 * the status, and each answer counts once the server has it, so a reload or
 * another device comes back to the same item with the same clock.
 *
 * A form says what the test is: how its status is read, what opening it
 * loads, whether a second stage follows the first, and how the record is
 * built. The pre-test is one stage. The post-test is two: when the routing
 * block closes, the form routes it and loads the second block, and nothing of
 * that block is read before.
 *
 * Nothing here scores aloud. `correct` is computed only into the record,
 * which the participant's account cannot read back.
 *
 * An admin who is not an enrolled participant gets a preview: the same screens, with
 * nothing written anywhere.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuizItemDoc } from '@/features/driving-sim';
import type { PresentedItem, SittingClosure, TestKind, TestSitting } from '@/domain/assessment/testResponse';
import type { TestDraft } from '@/features/assessment/domain/testDraft';
import { isParticipantCode } from '@/features/assessment/domain/testStatus';
import { assessmentDeps } from './dependencies';

export type TestAccess = 'participant' | 'preview' | 'none';

export const testAccess = (who: { uid: string | null; participantCode: string | null; isAdmin: boolean }): TestAccess =>
  who.uid && isParticipantCode(who.participantCode) ? 'participant' : who.uid && who.isAdmin && who.participantCode === null ? 'preview' : 'none';

/**
 * Why a sitting cannot open: the bank does not hold its items, the
 * participant's pre-test is not saved, or the post-test's design is not
 * published.
 */
export type NotReadyReason = 'items' | 'pre-test' | 'design';

/**
 * How long past a deadline the screen waits before closing a part. The device
 * knows the server's time only to within a network delay, and the rules refuse
 * a part closed early. The rules take an answer for longer than this.
 */
export const CLOSE_MARGIN_MS = 2000;

/**
 * Offline, a Firestore write waits rather than fails, and goes out on
 * reconnecting. This is how long a screen waits before saying so; the rules
 * refuse a write that then repeats one or arrives too late.
 */
const SAVE_WAIT_MS = 8000;

const orTimeout = <T,>(write: Promise<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The server did not answer in time.')), SAVE_WAIT_MS);
    write.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

export type TestPhase =
  | { kind: 'checking' }
  | { kind: 'none' }
  | { kind: 'intro'; resuming: boolean }
  | { kind: 'loading' }
  | { kind: 'not-ready'; count: number; reason: NotReadyReason }
  | { kind: 'running' }
  | { kind: 'between' }
  | { kind: 'saving' }
  | { kind: 'save-failed' }
  | { kind: 'done' }
  | { kind: 'failed' };

/** One stage: its items in the order shown, and its countdown. */
export interface SittingStage {
  readonly presented: PresentedItem<QuizItemDoc>[];
  readonly seconds: number;
}

export interface SittingContext {
  readonly access: TestAccess;
  readonly uid: string | null;
  readonly participantCode: string | null;
  readonly newSeed: () => number;
  readonly clock: () => number;
}

/** Where a participant stands, before Start. */
export interface FormStatus {
  readonly status: 'none' | 'open' | 'finished';
  /** Set when no sitting may be opened yet. */
  readonly blocked: NotReadyReason | null;
}

export type FormOpening =
  | {
      readonly seed: number;
      readonly stages: SittingStage[];
      readonly count: number;
      /** The sitting as the server holds it; null in a preview, which starts its own. */
      readonly draft: TestDraft | null;
    }
  | { readonly notReady: NotReadyReason; readonly count: number };

export interface SittingForm {
  readonly kind: TestKind;
  readonly stageCount: 1 | 2;
  readStatus(uid: string): Promise<FormStatus>;
  /**
   * Start: opens the status when there is none (a participant's), and loads
   * the sitting as the server holds it, with the stages it has reached.
   */
  open(context: SittingContext): Promise<FormOpening>;
  /** The second stage, once the first has closed with these answers. */
  advance(context: SittingContext, draft: TestDraft, first: SittingStage): Promise<SittingStage>;
  /** Starts the second stage's clock on the server, and returns it. */
  startStage2(context: SittingContext): Promise<number>;
  record(context: SittingContext, draft: TestDraft, stages: readonly SittingStage[], finishedAt: number, closedBy: SittingClosure): TestSitting;
  problems(sitting: TestSitting): string[];
}

export interface TestSittingInput {
  uid: string | null;
  participantCode: string | null;
  isAdmin: boolean;
  /** Where a new sitting's seed comes from. Taken once, when the status is opened. */
  newSeed: () => number;
  clock: () => number;
}

type StatusRead =
  | { kind: 'checking' }
  | { kind: 'failed' }
  | { kind: 'found'; status: FormStatus };

const stageOf = (draft: TestDraft | null): 0 | 1 => (draft?.stage2StartedAt !== undefined ? 1 : 0);

export const useTestSitting = (form: SittingForm, { uid, participantCode, isAdmin, newSeed, clock }: TestSittingInput) => {
  const access = testAccess({ uid, participantCode, isAdmin });
  const { kind } = form;
  // Once Start is pressed the flow owns the phase; before, it follows the status read.
  const [flow, setPhase] = useState<TestPhase | null>(null);
  const [stages, setStages] = useState<SittingStage[]>([]);
  const [draft, setDraft] = useState<TestDraft | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [now, setNow] = useState(clock);
  // Whether the last confirmed answer has reached the server.
  const [answerSave, setAnswerSave] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [check, setCheck] = useState(0);
  const [read, setRead] = useState<{ key: string; value: StatusRead }>({ key: '', value: { kind: 'checking' } });
  const pending = useRef<{ final: TestDraft; finishedAt: number; closedBy: SittingClosure } | null>(null);
  const closing = useRef(false);
  const saving = useRef(false);
  // The server's time minus this device's, so a device's clock never moves a deadline.
  const serverOffset = useRef(0);
  const context = useMemo<SittingContext>(
    () => ({ access, uid, participantCode, newSeed, clock }),
    [access, uid, participantCode, newSeed, clock]
  );

  // Where a participant stands, read each time the screen opens.
  const readKey = `${uid}:${check}`;
  useEffect(() => {
    if (access !== 'participant') return;
    let cancelled = false;
    form
      .readStatus(uid!)
      .then(found => {
        if (!cancelled) setRead({ key: readKey, value: { kind: 'found', status: found } });
      })
      .catch(error => {
        console.warn(`Could not read the ${kind}-test status.`, error);
        if (!cancelled) setRead({ key: readKey, value: { kind: 'failed' } });
      });
    return () => {
      cancelled = true;
    };
  }, [access, uid, readKey, form, kind]);

  const statusRead: StatusRead = read.key === readKey ? read.value : { kind: 'checking' };
  const phase: TestPhase =
    flow ??
    (access === 'none'
      ? { kind: 'none' }
      : access === 'preview'
        ? { kind: 'intro', resuming: false }
        : statusRead.kind === 'checking'
          ? { kind: 'checking' }
          : statusRead.kind === 'failed'
            ? { kind: 'failed' }
            : statusRead.status.status === 'finished'
              ? { kind: 'done' }
              : statusRead.status.status === 'none' && statusRead.status.blocked
                ? { kind: 'not-ready', count: 0, reason: statusRead.status.blocked }
                : { kind: 'intro', resuming: statusRead.status.status === 'open' });

  const serverNow = useCallback(() => clock() + serverOffset.current, [clock]);

  /** The second stage, loaded once the first has closed; then the screen between them. */
  const reachStage2 = useCallback(
    async (closed: TestDraft, first: SittingStage) => {
      setPhase({ kind: 'loading' });
      try {
        const second = await form.advance(context, closed, first);
        setStages([first, second]);
        setPhase({ kind: 'between' });
      } catch (error) {
        // The routing answers are kept, so Try again routes the same block.
        console.warn(`Could not open the second part of the ${kind}-test.`, error);
        setPhase({ kind: 'failed' });
      }
    },
    [form, kind, context]
  );

  const start = useCallback(async () => {
    setPhase({ kind: 'loading' });
    try {
      const opening = await form.open(context);
      setPreviewCount(opening.count);
      if ('notReady' in opening) {
        setPhase({ kind: 'not-ready', count: opening.count, reason: opening.notReady });
        return;
      }
      if (access === 'participant') {
        const sent = clock();
        const server = await orTimeout(assessmentDeps().drafts.serverTime(uid!, kind));
        serverOffset.current = server - (sent + clock()) / 2;
      }
      const at = serverNow();
      const next = opening.draft ?? { seed: opening.seed, startedAt: at, answers: {} };
      setDraft(next);
      setStages(opening.stages);
      setNow(at);
      setSelected(null);
      setAnswerSave('idle');
      closing.current = false;
      if (next.routingClosedAt !== undefined && next.stage2StartedAt === undefined) {
        if (opening.stages.length > 1) setPhase({ kind: 'between' });
        else await reachStage2(next, opening.stages[0]);
        return;
      }
      setPhase({ kind: 'running' });
    } catch (error) {
      console.warn(`Could not open the ${kind}-test.`, error);
      setPhase({ kind: 'failed' });
    }
  }, [access, uid, kind, form, context, clock, serverNow, reachStage2]);

  const save = useCallback(async () => {
    const closed = pending.current;
    if (!closed) return;
    if (access === 'preview') {
      setPhase({ kind: 'done' });
      return;
    }
    setPhase({ kind: 'saving' });
    try {
      // The record is built from what the server has, with the times it gave.
      const answers = await assessmentDeps().drafts.load(uid!, kind);
      const sitting = form.record(context, { ...closed.final, answers }, stages, closed.finishedAt, closed.closedBy);
      const problems = form.problems(sitting);
      if (problems.length > 0) console.warn(`The ${kind}-test record has problems; saving it as it is.`, problems);
      await orTimeout(assessmentDeps().sittings.finish(uid!, sitting));
      setPhase({ kind: 'done' });
    } catch (error) {
      // Another device may have closed it first; otherwise Try again saves it,
      // and a later visit closes it from the same draft.
      const status = await form.readStatus(uid!).catch(() => null);
      if (status?.status === 'finished') {
        setPhase({ kind: 'done' });
        return;
      }
      console.warn(`Could not save the ${kind}-test.`, error);
      setPhase({ kind: 'save-failed' });
    }
  }, [access, uid, kind, form, context, stages]);

  const stageIndex = stageOf(draft);
  const stage = stages[stageIndex] ?? null;
  const current = draft && stage ? stage.presented.find(p => draft.answers[p.item.id] === undefined) ?? null : null;
  const stageStartedAt = stageIndex === 1 ? draft?.stage2StartedAt : draft?.startedAt;
  const deadline = stage && stageStartedAt !== undefined ? stageStartedAt + stage.seconds * 1000 : Infinity;

  const closeStage = useCallback(
    (final: TestDraft, at: number) => {
      if (closing.current) return;
      closing.current = true;
      setAnswerSave('idle');
      if (stageIndex === 0 && form.stageCount === 2) {
        const closed = { ...final, routingClosedAt: at };
        setDraft(closed);
        void reachStage2(closed, stages[0]);
        return;
      }
      pending.current = {
        final,
        finishedAt: Math.min(at, deadline),
        closedBy: at >= deadline ? 'deadline' : 'participant',
      };
      void save();
    },
    [stageIndex, form, stages, deadline, reachStage2, save]
  );

  // Each countdown is a deadline on the server's clock: time away from the page
  // counts, and neither a reload nor another device restarts it. When it passes,
  // only the answers the server has count: the item on screen and the rest of
  // the stage are unanswered. An answer on its way is waited for.
  useEffect(() => {
    if (phase.kind !== 'running' || !draft || !stage) return;
    const tick = () => {
      const at = serverNow();
      setNow(at);
      if (answerSave === 'saving') return;
      if (!current || at >= deadline + CLOSE_MARGIN_MS) closeStage(draft, at);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [phase.kind, draft, stage, current, deadline, answerSave, serverNow, closeStage]);

  // An answer counts once the server has it, so the next item waits for that.
  const next = useCallback(async () => {
    if (!draft || !current || selected === null || phase.kind !== 'running' || saving.current) return;
    const itemId = current.item.id;
    saving.current = true;
    setAnswerSave('saving');
    try {
      if (access === 'participant') await orTimeout(assessmentDeps().drafts.saveAnswer(uid!, kind, itemId, selected));
      setDraft({ ...draft, answers: { ...draft.answers, [itemId]: { chosen: selected, at: serverNow() } } });
      setSelected(null);
      setAnswerSave('idle');
    } catch (error) {
      // Another device may have answered it already: then take what the server has.
      const held = await assessmentDeps().drafts.load(uid!, kind).catch(() => null);
      if (held?.[itemId]) {
        setDraft({ ...draft, answers: held });
        setSelected(null);
        setAnswerSave('idle');
      } else {
        console.warn(`Could not save an answer of the ${kind}-test.`, error);
        setAnswerSave('failed');
      }
    } finally {
      saving.current = false;
    }
  }, [draft, current, selected, phase.kind, access, uid, kind, serverNow]);

  /** From the screen between the stages: the second block's clock starts now. */
  const beginStage2 = useCallback(async () => {
    if (!draft || phase.kind !== 'between') return;
    setPhase({ kind: 'loading' });
    try {
      const at = await form.startStage2(context);
      setDraft({ ...draft, stage2StartedAt: at });
      setNow(serverNow());
      setSelected(null);
      closing.current = false;
      setPhase({ kind: 'running' });
    } catch (error) {
      console.warn(`Could not start the second part of the ${kind}-test.`, error);
      setPhase({ kind: 'failed' });
    }
  }, [draft, phase.kind, form, context, kind, serverNow]);

  const retry = useCallback(() => {
    if (phase.kind === 'save-failed') {
      void save();
      return;
    }
    setPhase(null);
    setCheck(n => n + 1);
  }, [phase.kind, save]);

  const answeredInStage = draft && stage ? stage.presented.filter(p => draft.answers[p.item.id] !== undefined).length : 0;
  const total = stage?.presented.length ?? 0;
  return {
    access,
    phase,
    current,
    /** 0 for the first stage, 1 for the second. */
    stageIndex,
    position: Math.min(answeredInStage + 1, total),
    total,
    selected,
    /** Whether the last confirmed answer has reached the server. */
    answerSave,
    secondsLeft: Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0,
    previewCount,
    start,
    choose: setSelected,
    next,
    beginStage2,
    retry,
  };
};

export type TestSittingState = ReturnType<typeof useTestSitting>;
