/**
 * The study data export for the per-competency course (2026-10-28).
 *
 * BKT is per participant: each participant's mastery is replayed from their
 * own graded answers (drives, quiz, diagnostic and post-exam), in time order,
 * with the same model the app uses. The Q-table is shared: one table, which
 * every participant's decisions update, exported once as it stands now and,
 * per course-log entry, as it stood right after that entry.
 *
 * Excluded on purpose: IRT. No Rasch ability or standard error, no item
 * difficulties, no IRT scoring of the post-exam; the group has not decided
 * what data IRT will use. The post-exam's raw answers are included, because
 * BKT reads them.
 *
 * Participants are identified by user id only; names and emails stay in the
 * admin report, not in the study file.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import {
  DEFAULT_BKT_MODEL,
  bktTrajectory,
  buildBKTEvidence,
  type BKTStep,
  type CompetencyEvidence,
} from '@/domain/learner/mastery/buildBKTProfile';
import { masteryLevel, MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING } from '@/domain/competencyRouting/mastery';
import type { AttemptRow, BackgroundRow, CourseLogRow, SharedQTableRow, SittingRow, StudyData } from './adminReport';

/** The tutorial's steps teach the controls; they are not evidence of a competency. */
const TUTORIAL_LEVEL_ID = 0;

export interface ParticipantExport {
  userId: string;
  background: Omit<BackgroundRow, 'userId'> | null;
  bkt: {
    /** Every graded answer BKT read, in order, with P(L) before and after and the predicted P(correct). */
    trajectory: BKTStep[];
    /** P(L) per competency after the last answer. */
    finalMastery: Record<DrivingCompetency, number>;
    /** Mastery level 1-4 (cutoffs 0.50 / 0.80 / 0.95, capped below 4 until 3 drive answers). */
    finalLevel: Record<DrivingCompetency, number>;
    evidence: Record<DrivingCompetency, CompetencyEvidence>;
  };
  /** Story drives with their timing record. */
  drives: Omit<AttemptRow, 'userId' | 'logs'>[];
  /** Decisions, rewards and the table snapshot after each entry. */
  courseLog: Omit<CourseLogRow, 'userId'>[];
  /** Quiz, diagnostic and post-exam answers (no IRT scoring). */
  sittings: Omit<SittingRow, 'userId'>[];
}

export interface StudyExport {
  schemaVersion: 1;
  exportedAt: number;
  notes: {
    bkt: string;
    qTable: string;
    irt: string;
  };
  /** The BKT model every trajectory was replayed with (Tentative literature defaults). */
  bktModel: typeof DEFAULT_BKT_MODEL;
  sharedQTable: SharedQTableRow | null;
  participants: ParticipantExport[];
}

const withoutUser = <T extends { userId: string }>(row: T): Omit<T, 'userId'> => {
  const copy: Partial<T> = { ...row };
  delete copy.userId;
  return copy as Omit<T, 'userId'>;
};

/** One participant's BKT evidence: drive logs (tutorial left out) and sitting answers, oldest first. */
export const participantEvidence = (attempts: readonly AttemptRow[], sittings: readonly SittingRow[]): ActionLog[] =>
  [
    ...attempts.filter(attempt => attempt.levelId !== TUTORIAL_LEVEL_ID).flatMap(attempt => attempt.logs ?? []),
    ...sittings.flatMap(sitting => sitting.answers),
  ].sort((a, b) => a.timestamp - b.timestamp);

export const buildStudyExport = (
  data: StudyData & { attempts: readonly AttemptRow[] },
  exportedAt: number
): StudyExport => {
  const userIds = [
    ...new Set([
      ...data.courseLogs.map(row => row.userId),
      ...data.sittings.map(row => row.userId),
      ...data.backgrounds.map(row => row.userId),
    ]),
  ].sort();

  const participants = userIds.map((userId): ParticipantExport => {
    const attempts = data.attempts.filter(row => row.userId === userId).sort((a, b) => a.timestamp - b.timestamp);
    const sittings = data.sittings.filter(row => row.userId === userId);
    const evidence = participantEvidence(attempts, sittings);
    const trajectory = bktTrajectory(evidence);
    const counts = buildBKTEvidence(evidence);
    const finalMastery = Object.fromEntries(COMPETENCIES.map(c => [c, DEFAULT_BKT_MODEL.pInit])) as Record<DrivingCompetency, number>;
    for (const step of trajectory) finalMastery[step.competency] = step.pAfter;
    const finalLevel = Object.fromEntries(
      COMPETENCIES.map(c => [c, masteryLevel(finalMastery[c], counts[c].drive)])
    ) as Record<DrivingCompetency, number>;
    const background = data.backgrounds.find(row => row.userId === userId);

    return {
      userId,
      background: background ? withoutUser(background) : null,
      bkt: { trajectory, finalMastery, finalLevel, evidence: counts },
      drives: attempts.map(attempt => {
        const copy: Partial<AttemptRow> = { ...attempt };
        delete copy.userId;
        delete copy.logs;
        return copy as Omit<AttemptRow, 'userId' | 'logs'>;
      }),
      courseLog: data.courseLogs.filter(row => row.userId === userId).map(withoutUser),
      sittings: sittings.map(withoutUser),
    };
  });

  return {
    schemaVersion: 1,
    exportedAt,
    notes: {
      bkt: `Per participant: each trajectory is replayed from that participant's own answers with bktModel. predictedCorrect is the prediction made before each answer (for next-answer AUC/RMSE). Level 4 needs ${MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING} drive answers.`,
      qTable: 'Shared: one table updated by every participant. sharedQTable is the table now; each courseLog entry carries tableAfter, the table right after it.',
      irt: 'Excluded: no Rasch ability, standard error, item difficulty or IRT scoring of the post-exam, until the group decides what IRT uses.',
    },
    bktModel: DEFAULT_BKT_MODEL,
    sharedQTable: data.sharedQTable,
    participants,
  };
};

const escapeCSV = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csv = (header: string[], rows: unknown[][]) => [header.join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');
const stateKey = (state: { mastery: number; result: string } | null) => (state ? `M${state.mastery}-${state.result}` : '');

/** Long format, one row per graded answer: what next-answer AUC and RMSE are computed from. */
export const buildBKTTrajectoryCSV = (study: StudyExport) =>
  csv(
    ['userId', 'step', 'timestamp', 'competency', 'source', 'itemId', 'scenarioId', 'correct', 'pBefore', 'predictedCorrect', 'pAfter'],
    study.participants.flatMap(p =>
      p.bkt.trajectory.map((s, i) => [
        p.userId, i + 1, s.timestamp, s.competency, s.source, s.itemId ?? '', s.scenarioId ?? '', s.correct ? 1 : 0, s.pBefore, s.predictedCorrect, s.pAfter,
      ])
    )
  );

/** One row per routing decision. */
export const buildDecisionsCSV = (study: StudyExport) =>
  csv(
    ['userId', 'seq', 'levelId', 'phase', 'competency', 'state', 'masteryP', 'legal', 'action', 'source', 'probability', 'leader', 'timestamp'],
    study.participants.flatMap(p =>
      p.courseLog.flatMap(entry =>
        entry.decisions.map(d => [
          p.userId, d.seq, d.levelId, d.phase, d.competency, stateKey(d.state), d.masteryP, d.legal.join('|'), d.action, d.source, d.probability, d.leader ?? '', d.timestamp,
        ])
      )
    )
  );

/** One row per reward: the decision it settles, and what measured it. */
export const buildRewardsCSV = (study: StudyExport) =>
  csv(
    ['userId', 'decisionId', 'competency', 'state', 'action', 'reward', 'accuracy', 'passed', 'addedDecisions', 'nextState', 'measuredBy', 'timestamp'],
    study.participants.flatMap(p =>
      p.courseLog.flatMap(entry =>
        entry.rewards.map(r => [
          p.userId, r.decisionId, r.competency, stateKey(r.state), r.action, r.reward, r.accuracy, r.passed ? 1 : 0, r.addedDecisions, stateKey(r.next), r.measuredBy, r.timestamp,
        ])
      )
    )
  );

/** One row per participant: the background form's answers. */
export const buildBackgroundCSV = (study: StudyExport) => {
  const questionIds = [...new Set(study.participants.flatMap(p => Object.keys(p.background?.answers ?? {})))].sort();
  return csv(
    ['userId', 'formVersion', 'timestamp', ...questionIds],
    study.participants
      .filter(p => p.background)
      .map(p => [p.userId, p.background!.formVersion, p.background!.timestamp, ...questionIds.map(id => p.background!.answers[id] ?? '')])
  );
};
