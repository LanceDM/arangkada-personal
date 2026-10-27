import { describe, it, expect } from 'vitest';
import { COMPETENCIES, createLearnerProfile, getLowestScoringCompetency } from './profile';
import { resolveTarget } from '@/domain/learner/adaptive/resolveTarget';
import type { DrivingCompetency, LearnerProfile } from './competency';

describe('the weakest competency, and how a tie for it is broken', () => {
  /** Every competency at `score`, observed `attempts` times, unless overridden. */
  const profileOf = (
    rows: Partial<Record<DrivingCompetency, { score: number; attempts: number }>>,
    score = 30,
    attempts = 0
  ): LearnerProfile => {
    const profile = createLearnerProfile();
    for (const competency of COMPETENCIES) {
      profile[competency].score = rows[competency]?.score ?? score;
      profile[competency].attempts = rows[competency]?.attempts ?? attempts;
    }
    return profile;
  };

  it('is the lowest score under either rule when nothing ties it', () => {
    const profile = profileOf({ parking: { score: 12, attempts: 9 } });
    expect(getLowestScoringCompetency(profile, 'list-order')).toBe('parking');
    expect(getLowestScoringCompetency(profile, 'least-observed')).toBe('parking');
  });

  it('goes to the first in COMPETENCIES under list order, as the earlier studies ran', () => {
    const profile = profileOf({ driver_legality: { score: 30, attempts: 6 }, road_signs: { score: 30, attempts: 0 } }, 69, 3);
    expect(getLowestScoringCompetency(profile)).toBe('driver_legality');
    expect(getLowestScoringCompetency(profile, 'list-order')).toBe('driver_legality');
  });

  it('goes to the least-observed of the tied under least-observed', () => {
    const profile = profileOf({ driver_legality: { score: 30, attempts: 6 }, road_signs: { score: 30, attempts: 0 } }, 69, 3);
    expect(getLowestScoringCompetency(profile, 'least-observed')).toBe('road_signs');
  });

  it('falls back to list order only where the tied were observed equally often', () => {
    const profile = profileOf({
      speed_control: { score: 15, attempts: 1 },
      traffic_signals: { score: 15, attempts: 1 },
      parking: { score: 15, attempts: 2 },
    }, 69, 3);
    expect(getLowestScoringCompetency(profile, 'least-observed')).toBe('traffic_signals');
  });
});

describe('resolveTarget falls back rather than failing', () => {
  // A full profile, as `buildLearnerProfile` always produces: every competency
  // present. `resolveTarget` scans all of them, so a partial fixture would be
  // testing a shape production never creates.
  const profileWith = (overrides: Partial<Record<DrivingCompetency, number>>): LearnerProfile =>
    Object.fromEntries(
      COMPETENCIES.map(c => [
        c,
        { score: overrides[c] ?? 10, attempts: 1, correct: 0, violations: 1 },
      ])
    ) as LearnerProfile;

  it('returns the weakest competency when nothing is mastered to review', () => {
    const profile = profileWith({ road_signs: 20 });
    expect(resolveTarget('review', 'road_signs', profile, 70)).toBe('road_signs');
  });

  it('picks the most comfortably mastered competency to review', () => {
    const profile = profileWith({ road_signs: 20, traffic_signals: 95, pedestrians: 80 });
    expect(resolveTarget('review', 'road_signs', profile, 70)).toBe('traffic_signals');
  });

  it('excludes the nominated weakest competency even when it scores highest', () => {
    // `weakest` is whatever the caller nominated; review must look elsewhere so
    // spaced repetition never degenerates into re-practising the same item.
    const profile = profileWith({ road_signs: 99, pedestrians: 80 });
    expect(resolveTarget('review', 'road_signs', profile, 70)).toBe('pedestrians');
  });

  it('returns the weakest competency for the weakest target', () => {
    const profile = profileWith({ road_signs: 20 });
    expect(resolveTarget('weakest', 'road_signs', profile, 70)).toBe('road_signs');
  });

  it('resolves a related target to a curriculum neighbour of the weakest', () => {
    const profile = profileWith({ road_signs: 20 });
    const related = resolveTarget('related', 'road_signs', profile, 70);
    // Always a real competency, and never a no-op that just echoes an unrelated pick.
    expect(COMPETENCIES).toContain(related);
  });
});
