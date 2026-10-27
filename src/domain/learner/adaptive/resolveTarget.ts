import type { DrivingCompetency, LearnerProfile } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { relatedCompetencies } from './relatedness';
import type { PracticeTarget } from './qLearningPolicy';

/**
 * Which concrete competency an action's abstract target resolves to, given the
 * learner's current profile.
 *
 * Separate from `qLearningPolicy` because it needs the competency taxonomy and
 * the learner's profile, neither of which the pure Q-table layer should depend
 * on - which is what keeps that module a table lookup and nothing else.
 *
 * `review` picks the most comfortably mastered competency (highest score among
 * those already at/above threshold) rather than a random one, so revisiting it
 * is closer to spaced repetition of what's fading than a shot in the dark.
 * Falls back to the weakest competency whenever the intended target doesn't
 * resolve to anything (no related edge, or nothing mastered yet) - the caller
 * still has a real competency to work with either way. Shared verbatim by
 * production (`selectPractice` in Driving Sim's practiceSelection.ts) and the
 * offline trainer so they cannot drift.
 */
export const resolveTarget = (
  target: PracticeTarget,
  weakest: DrivingCompetency,
  profile: LearnerProfile,
  masteryThreshold: number
): DrivingCompetency => {
  if (target === 'weakest') return weakest;

  if (target === 'related') {
    const [related] = relatedCompetencies(weakest);
    return related ?? weakest;
  }

  const mastered = COMPETENCIES
    .filter(c => c !== weakest && profile[c].attempts > 0 && profile[c].score >= masteryThreshold)
    .sort((a, b) => profile[b].score - profile[a].score);
  return mastered[0] ?? weakest;
};
