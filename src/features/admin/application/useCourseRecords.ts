/**
 * The course views' records for one cohort: its enrolled participants (from
 * the study's registry, as the records store reads it), each one's course log
 * and BKT update log, read on Load and held in the section alone; and the
 * cohort's shared Q-table, followed live while the section is open.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudyCohort } from '@/domain/study/participantCode';
import { EVIDENCE_BKT_MODEL } from '@/domain/learner/mastery/evidenceBKT';
import {
  courseLogRowOf,
  decisionRows,
  playerBkt,
  playerCourseRows,
  stateActionStats,
  type CourseLogRow,
} from '@/features/admin/domain/courseAdmin';
import { adminDeps } from './dependencies';

export interface CourseRecords {
  cohort: StudyCohort;
  /** Participant code by account id. */
  codes: Map<string, string>;
  courseLogs: CourseLogRow[];
  bktUpdates: Record<string, unknown>[];
  /** Course-log documents that were not one. */
  unread: number;
  loadedAt: number;
}

export const readCourseRecords = async (cohort: StudyCohort): Promise<CourseRecords> => {
  const { pilotRecords, courseLogs } = adminDeps();
  const enrolled = (await pilotRecords.pool()).filter(entry => entry.cohort === cohort);
  const read = await Promise.all(
    enrolled.map(async entry => {
      const [bkt, course] = await Promise.all([courseLogs.bktUpdates(entry.uid), courseLogs.courseLog(entry.uid)]);
      return { entry, bkt, course };
    })
  );
  const rows: CourseLogRow[] = [];
  let unread = 0;
  for (const { entry, course } of read) {
    for (const data of course) {
      const row = courseLogRowOf(entry.uid, data);
      if (row) rows.push(row);
      else unread++;
    }
  }
  return {
    cohort,
    codes: new Map(enrolled.map(entry => [entry.uid, entry.code])),
    courseLogs: rows,
    bktUpdates: read.flatMap(({ bkt }) => bkt),
    unread,
    loadedAt: Date.now(),
  };
};

export const useCourseRecords = () => {
  const [cohort, setCohort] = useState<StudyCohort>('study');
  const [data, setData] = useState<CourseRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest read lands: a slower read of another cohort never overwrites it.
  const latest = useRef(0);
  const load = useCallback((which: StudyCohort) => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    readCourseRecords(which).then(
      result => {
        if (ticket !== latest.current) return;
        setData(result);
        setLoading(false);
      },
      (failure: unknown) => {
        if (ticket !== latest.current) return;
        setError(failure instanceof Error ? failure.message : String(failure));
        setLoading(false);
      }
    );
  }, []);
  const derived = useMemo(() => {
    if (!data) return null;
    const label = (uid: string) => data.codes.get(uid) ?? `${uid.slice(0, 6)}…`;
    return {
      players: playerCourseRows(data.courseLogs, label),
      stats: stateActionStats(data.courseLogs),
      decisions: decisionRows(data.courseLogs, label),
      bkt: playerBkt(data.bktUpdates, label, EVIDENCE_BKT_MODEL.pInit),
    };
  }, [data]);
  return { cohort, setCohort, data, derived, loading, error, load };
};

export type CourseRecordsState = ReturnType<typeof useCourseRecords>;

interface LiveTable {
  cohort: StudyCohort;
  table: Record<string, unknown> | null;
  updates: Record<string, unknown>[];
  error: string | null;
}

const emptyLive = (cohort: StudyCohort): LiveTable => ({ cohort, table: null, updates: [], error: null });

/** A cohort's shared table and its newest update-log entries, live. What arrives for another cohort is never shown. */
export const useLiveCourseTable = (cohort: StudyCohort, updates = 30) => {
  const [live, setLive] = useState<LiveTable>(() => emptyLive(cohort));
  useEffect(() => {
    const { courseLogs } = adminDeps();
    const merge = (patch: Partial<LiveTable>) =>
      setLive(prev => ({ ...(prev.cohort === cohort ? prev : emptyLive(cohort)), ...patch }));
    const fail = (error: string) => merge({ error });
    const stopTable = courseLogs.watchTable(cohort, table => merge({ table }), fail);
    const stopRows = courseLogs.watchUpdates(cohort, updates, rows => merge({ updates: rows }), fail);
    return () => {
      stopTable();
      stopRows();
    };
  }, [cohort, updates]);
  const current = live.cohort === cohort ? live : emptyLive(cohort);
  return { table: current.table, updates: current.updates, error: current.error };
};
