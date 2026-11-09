/**
 * The study's enrolled participants, followed live for the Participants page
 *.
 *
 * One listener on the registry (`participants`, which also says whether a
 * participant has withdrawn), and per participant one on their consent record
 * (their name, age and username), one on their study steps (and with them
 * the background answers and the device check), one on their tests' status
 * (open or finished, never an answer), one on their attempts and one on their
 * course cursor, so the page updates as a
 * drive is saved without re-reading anything it already has. The frozen
 * design's group is read once per participant, until redesign step 6
 * retires it.
 *
 * An attempt leaves here as its level and its time only. Its score, verdicts
 * and logs are downloaded with it - Firestore sends whole documents - and
 * dropped at this boundary, so nothing above can show them.
 */
import { collection, doc, getDoc, onSnapshot, type FirestoreError, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { isStudyCohort } from '@/domain/study/participantCode';
import type { ParticipantDoc } from '@/domain/study/studyRecords';
import { DEVICE_TYPES, GAMING_FREQUENCIES } from '@/domain/study/consentRecords';
import type { PilotPoolRepository } from '@/features/admin/application/pilotPorts';
import {
  NO_PROFILE,
  NO_STEPS,
  type PilotAccountProgress,
  type PilotAttemptSummary,
  type PilotCursor,
  type PilotDeviceCheck,
  type PilotGroup,
  type PilotSteps,
} from '@/features/admin/domain/pilotProgress';

const timeOf = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const oneOf = <T extends string>(options: readonly T[], value: unknown): T | null =>
  options.includes(value as T) ? (value as T) : null;

const deviceCheckOf = (data: Record<string, unknown> | undefined): PilotDeviceCheck | null => {
  if (!data || typeof data.medianFps !== 'number') return null;
  const viewport = (data.viewport ?? {}) as { width?: unknown; height?: unknown };
  return {
    touch: data.touch === true,
    medianFps: data.medianFps,
    slow: data.slow === true,
    width: Number(viewport.width ?? 0),
    height: Number(viewport.height ?? 0),
  };
};
const testOf = (data: { status?: unknown } | undefined): PilotSteps['preTest'] =>
  data?.status === 'finished' ? 'finished' : data?.status === 'open' ? 'open' : 'none';

interface Tracked {
  progress: PilotAccountProgress;
  stop: Unsubscribe[];
}

const watch: PilotPoolRepository['watch'] = (onChange, onError) => {
  const registry = new Map<string, Tracked>();
  let closed = false;
  let queued = false;

  // Many listeners fire together on load; the page is told once per burst.
  const emit = () => {
    if (closed || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!closed) onChange([...registry.values()].map(tracked => tracked.progress));
    });
  };
  const fail = (error: FirestoreError | Error) => {
    if (!closed) onError(error.message);
  };

  const track = (entry: Pick<PilotAccountProgress, 'code' | 'cohort' | 'uid' | 'enrolledAt' | 'withdrawnAt'>): Tracked => {
    const tracked: Tracked = { progress: { ...entry, name: null, profile: NO_PROFILE, steps: NO_STEPS, group: null, cursor: null, attempts: [] }, stop: [] };
    const { uid } = entry;
    const update = (change: Partial<PilotAccountProgress>) => {
      tracked.progress = { ...tracked.progress, ...change };
      emit();
    };
    getDoc(doc(db, 'users', uid, 'routing', 'assignment'))
      .then(snap => snap.exists() && update({ group: ((snap.data() as { group?: PilotGroup }).group ?? null) as PilotGroup | null }))
      .catch(fail);
    tracked.stop.push(
      // The name, age and username given at consent: the admin-only record, followed so they appear when given.
      onSnapshot(
        doc(db, 'consents', uid),
        snap => {
          const data = snap.data() as Record<string, unknown> | undefined;
          update({
            name: textOf(data?.fullName),
            profile: {
              ...tracked.progress.profile,
              username: textOf(data?.username),
              age: typeof data?.age === 'number' ? data.age : null,
              consentVersion: textOf(data?.consentVersion),
            },
          });
        },
        fail
      ),
      onSnapshot(
        collection(db, 'users', uid, 'study'),
        snap => {
          const data = (id: string) => snap.docs.find(d => d.id === id)?.data() as Record<string, unknown> | undefined;
          update({
            steps: {
              ...tracked.progress.steps,
              consentedAt: timeOf(data('consent')?.agreedAt),
              backgroundAt: timeOf(data('background')?.answeredAt),
              deviceCheckedAt: timeOf(data('device')?.checkedAt),
              surveyOpenedAt: timeOf(data('survey')?.openedAt),
              surveyConfirmedAt: timeOf(data('survey')?.confirmedAt),
            },
            profile: {
              ...tracked.progress.profile,
              gaming: oneOf(GAMING_FREQUENCIES, data('background')?.gaming),
              device: oneOf(DEVICE_TYPES, data('background')?.device),
              deviceCheck: deviceCheckOf(data('device')),
            },
          });
        },
        fail
      ),
      onSnapshot(
        collection(db, 'users', uid, 'testStatus'),
        snap => {
          const data = (id: string) => snap.docs.find(d => d.id === id)?.data() as { status?: unknown } | undefined;
          update({ steps: { ...tracked.progress.steps, preTest: testOf(data('pre')), postTest: testOf(data('post')) } });
        },
        fail
      ),
      onSnapshot(
        doc(db, 'users', uid, 'routing', 'cursor'),
        snap => {
          const data = snap.data() as { state?: PilotCursor['state']; outcome?: PilotCursor['outcome']; updatedAt?: number } | undefined;
          update({ cursor: data?.state ? { state: data.state, outcome: data.outcome ?? null, updatedAt: Number(data.updatedAt ?? 0) } : null });
        },
        fail
      ),
      onSnapshot(
        collection(db, 'users', uid, 'attempts'),
        snap =>
          update({
            attempts: snap.docs.map((d): PilotAttemptSummary => {
              const data = d.data() as { levelId: number; timestamp: number };
              return { id: d.id, levelId: data.levelId, savedAt: data.timestamp };
            }),
          }),
        fail
      )
    );
    return tracked;
  };

  const stopRegistry = onSnapshot(
    collection(db, 'participants'),
    snap => {
      const present = new Set<string>();
      for (const d of snap.docs) {
        const data = d.data() as Partial<ParticipantDoc>;
        if (!data.uid || !isStudyCohort(data.cohort)) continue;
        const withdrawal = data.withdrawal as { at?: unknown } | null | undefined;
        const entry = {
          code: data.code ?? d.id,
          cohort: data.cohort,
          uid: data.uid,
          enrolledAt: Number(data.enrolledAt ?? 0),
          withdrawnAt: withdrawal ? timeOf(withdrawal.at) ?? 0 : null,
        };
        present.add(entry.code);
        const known = registry.get(entry.code);
        if (known?.progress.uid === entry.uid) {
          known.progress = { ...known.progress, withdrawnAt: entry.withdrawnAt };
          continue;
        }
        known?.stop.forEach(stop => stop());
        registry.set(entry.code, track(entry));
      }
      for (const [code, tracked] of registry) {
        if (present.has(code)) continue;
        tracked.stop.forEach(stop => stop());
        registry.delete(code);
      }
      emit();
    },
    fail
  );

  return () => {
    closed = true;
    stopRegistry();
    registry.forEach(tracked => tracked.stop.forEach(stop => stop()));
  };
};

export const firebasePilotPoolRepository: PilotPoolRepository = { watch };
