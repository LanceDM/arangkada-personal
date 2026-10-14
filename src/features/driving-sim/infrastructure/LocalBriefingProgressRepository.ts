/**
 * Per-module briefing progress in localStorage.
 *
 * Keyed by `moduleId` rather than level id on purpose: several levels share a
 * module, and reading it should count for all of them. Two call sites write the
 * same key — the reader embedded in the mission briefing and the standalone
 * `/learn/:levelId` route — so reading a module in either place satisfies the
 * lesson gate once.
 */
import type { BriefingProgress, BriefingProgressRepository } from '@/features/driving-sim/application/ports';

const storageKey = (moduleId: string) => `arangkada_briefing_${moduleId}`;

const load = (moduleId: string): Partial<BriefingProgress> => {
  try {
    const raw = localStorage.getItem(storageKey(moduleId));
    return raw ? (JSON.parse(raw) as Partial<BriefingProgress>) : {};
  } catch {
    return {};
  }
};

const save = (moduleId: string, progress: BriefingProgress) => {
  try {
    localStorage.setItem(storageKey(moduleId), JSON.stringify(progress));
  } catch {
    // Quota or private-mode failures lose the marker, which is recoverable by
    // reading again — they must not take the lesson flow down.
  }
};

export const localBriefingProgressRepository: BriefingProgressRepository = {
  load,
  save,
  /** Marks lessons read without disturbing whatever the quiz state already was. */
  markLessonsRead(moduleId) {
    save(moduleId, { lessonsRead: true, quizPassed: Boolean(load(moduleId).quizPassed) });
  },
};
