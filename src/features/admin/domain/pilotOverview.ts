/**
 * The dashboard's overview of the study's participants, from the
 * rows the Participants page follows live: how many have enrolled in each
 * cohort, where the study's participants are in the study's order, and where
 * they are in the course.
 *
 * The `study` cohort is the one the thesis reports; the dry run and the
 * developers' test accounts are counted apart.
 */
import type { StudyCohort } from '@/domain/study/participantCode';
import { STUDY_STAGES, type StudyStage } from '@/domain/study/studyStage';
import type { PilotRow } from './pilotProgress';

/** A participant's activity this recent counts as active now. */
export const ACTIVE_WITHIN_MS = 15 * 60_000;

const COURSE: readonly StudyStage[] = ['tutorial', 'levels', 'final'];

export interface PilotOverview {
  /** The study cohort's participants. */
  participants: number;
  /** Enrolments per cohort, the study's included. */
  cohorts: Record<StudyCohort, number>;
  study: {
    enrolledToday: number;
    inCourse: number;
    activeNow: number;
    done: number;
    withdrawn: number;
  };
  /** How many of the study's participants are at each stage, in the study's order, then withdrawn. */
  stages: Array<{ stage: StudyStage; participants: number }>;
  /** Where the next Continue takes each of the study's participants in the course, in course order. */
  places: Array<{ place: string; participants: number }>;
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** A place's position in the course, for ordering. */
const placeRank = (place: string): number => {
  if (place === 'Not in the course yet') return -1;
  if (place === 'Final Mission') return 100;
  if (place === 'Certified') return 101;
  const level = /^Level (\d+)/.exec(place);
  return level ? Number(level[1]) : 102;
};

export const pilotOverview = (rows: readonly PilotRow[], now: number): PilotOverview => {
  const study = rows.filter(row => row.cohort === 'study');
  const ofCohort = (cohort: StudyCohort) => rows.filter(row => row.cohort === cohort).length;
  const places = new Map<string, number>();
  for (const row of study.filter(entry => COURSE.includes(entry.stage))) places.set(row.place, (places.get(row.place) ?? 0) + 1);
  const atStage = (stage: StudyStage) => study.filter(row => row.stage === stage).length;

  return {
    participants: study.length,
    cohorts: { study: study.length, dryrun: ofCohort('dryrun'), test: ofCohort('test') },
    study: {
      enrolledToday: study.filter(row => sameDay(row.enrolledAt, now)).length,
      inCourse: study.filter(row => COURSE.includes(row.stage)).length,
      activeNow: study.filter(row => row.stage !== 'withdrawn' && row.lastActivityAt !== null && now - row.lastActivityAt <= ACTIVE_WITHIN_MS).length,
      done: atStage('done'),
      withdrawn: atStage('withdrawn'),
    },
    stages: [...STUDY_STAGES, 'withdrawn' as const].map(stage => ({ stage, participants: atStage(stage) })),
    places: [...places]
      .map(([place, count]) => ({ place, participants: count }))
      .sort((a, b) => placeRank(a.place) - placeRank(b.place)),
  };
};
