/**
 * What the app writes passes the schema that db:validate runs against the
 * database: a short course is played on the in-memory stores and every record
 * it logged is checked with the same checks.
 */
import { describe, expect, it } from 'vitest';
import {
  completeCourseDrive,
  diagnosticItems,
  drawCourseQuiz,
  loadCompetencyCourse,
  markCourseLessonsRead,
  planCourseDrive,
  saveDiagnostic,
  submitCourseQuiz,
} from '@/features/driving-sim/application/use-cases/competencyCourse';
import { memoryCourseStore, provideInMemoryDrivingSim } from '@/features/driving-sim/application/testDependencies';
import type { LevelResult } from '@/domain/learner/attempt';
import { SCHEMA, sequenceProblems } from './schema';

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const checkOf = (path: string) => SCHEMA.find(entry => entry.path === path)!.check;

describe('the database schema', () => {
  it('accepts every record a short course writes, and the logs are numbered without gaps', async () => {
    const store = memoryCourseStore();
    provideInMemoryDrivingSim(store);
    const uid = 'p1';
    let cursor = (await loadCompetencyCourse(uid)).cursor;
    const diagnostic = diagnosticItems();
    await saveDiagnostic(uid, diagnostic, diagnostic.map(item => item.answer));
    cursor = await markCourseLessonsRead(uid, cursor);
    const tutorial = await planCourseDrive(uid, cursor, 1);
    const empty: LevelResult = { levelId: 0, score: 0, stars: 0, completed: true, violations: 0, correctActions: 0, logs: [] };
    cursor = (await completeCourseDrive({ uid, cursor, run: tutorial, result: empty })).cursor;
    cursor = await markCourseLessonsRead(uid, cursor);
    const quiz = drawCourseQuiz(cursor, 3);
    cursor = (await submitCourseQuiz(uid, cursor, quiz.items, quiz.items.map(item => item.answer))).cursor;
    const run = await planCourseDrive(uid, cursor, 2);
    const logs = run.composed!.items.map((item, i) => ({
      timestamp: Date.now() + i, action: 'brake', result: i % 2 ? 'violation' as const : 'correct' as const, points: 0,
      competency: item.competency, scenarioId: item.scenarioId, reactionTime: 800,
    }));
    await completeCourseDrive({ uid, cursor, run, result: { levelId: run.levelId, score: 50, stars: 1, completed: true, violations: 3, correctActions: 3, logs } });

    const problems: string[] = [];
    const run_ = (path: string, records: unknown[], idOf: (r: Record<string, unknown>) => string) => {
      expect(records.length, path).toBeGreaterThan(0);
      for (const record of records.map(plain) as Record<string, unknown>[]) problems.push(...checkOf(path)(record, idOf(record)).map(p => `${path}: ${p}`));
    };
    run_('users/{uid}/events/{eventId}', store.events.get(uid)!, r => String(r.eventId));
    run_('users/{uid}/bktUpdates/{updateId}', store.bktUpdates.get(uid)!, r => String(r.eventId));
    run_('users/{uid}/bkt/profile', [store.bktProfiles.get(uid)!], () => 'profile');
    run_('policy/competencyQ/updates/{updateId}', store.qUpdates, r => String(r.eventId));
    run_('users/{uid}/courseLog/{id}', store.logs, () => 'x');
    run_('users/{uid}/assessmentSittings/{id}', store.sittings.get(uid)!, r => String(r.id));
    run_('users/{uid}/attempts/{id}', store.attempts.get(uid)!, () => 'x');
    run_('users/{uid}/state/active', [store.active.get(uid)!], () => 'active');
    run_('users/{uid}/routing/competencyCourse', [store.cursors.get(uid)!], () => 'competencyCourse');
    expect(problems).toEqual([]);

    expect(sequenceProblems('events', store.events.get(uid)!.map(e => e.seq))).toEqual([]);
    expect(sequenceProblems('bkt', store.bktUpdates.get(uid)!.map(e => e.userSeq))).toEqual([]);
    expect(sequenceProblems('q', store.qUpdates.map(e => e.globalSeq))).toEqual([]);
    const evidence = [...store.attempts.get(uid)!, ...store.sittings.get(uid)!].map(r => r.evidenceSeq);
    expect(sequenceProblems('evidence', evidence)).toEqual([]);
    expect(store.evidenceCounters.get(uid)).toBe(evidence.length + 1);
  });

  it('reports a gap or a repeat in a log', () => {
    expect(sequenceProblems('x', [1, 2, 4])).toEqual(['x: expected 3, found 4']);
    expect(sequenceProblems('x', [1, null])).toEqual(['x: 1 written offline without a number (ordered by time)']);
  });
});
