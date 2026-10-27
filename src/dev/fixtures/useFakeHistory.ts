// Dev-only. Adaptive practice only fires for a learner with real history -
// some competency logged below the mastery threshold - which real play has to
// be built up one level at a time to reach. This fabricates that history
// directly so ScenarioLab can preview and launch a practice-carrying level
// instantly, without grinding through prior levels first.
import { useMemo, useState } from 'react';
import type { ActionLog } from '@/domain/learner/attempt';
import { COMPETENCIES } from '@/domain/learner/profile';
import { selectPractice, type PracticeChoice } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { GAME_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { createRng } from '@/shared/lib/rng';

export interface FakeHistory {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  competency: DrivingCompetency;
  setCompetency: (competency: DrivingCompetency) => void;
  wrongCount: number;
  setWrongCount: (count: number) => void;
  /** What selectPractice actually returns for this fake history at this level - null if nothing fires. */
  choice: PracticeChoice | null;
}

const fakeLog = (competency: DrivingCompetency, result: ActionLog['result'], i: number): ActionLog => ({
  timestamp: i,
  action: 'brake',
  result,
  points: result === 'correct' ? 10 : -10,
  competency,
});

/**
 * Everything but `competency` mastered, and `competency` failed `wrongCount`
 * times in a row - the simplest history that reliably drops one competency
 * below the mastery threshold while leaving BKT's weakest-competency pick
 * unambiguous.
 */
const buildFakeLogs = (competency: DrivingCompetency, wrongCount: number): ActionLog[] => [
  ...COMPETENCIES.filter(c => c !== competency).flatMap((c, i) => [fakeLog(c, 'correct', i), fakeLog(c, 'correct', i)]),
  ...Array.from({ length: wrongCount }, (_, i) => fakeLog(competency, 'violation', i)),
];

/** Deterministic, so the same panel state always previews the same pick rather than a new random one on every render. */
const rng = createRng(1);

export const useFakeHistory = (levelId: number, stagedRoute: readonly ScenarioEvent[]): FakeHistory => {
  const [enabled, setEnabled] = useState(false);
  const [competency, setCompetency] = useState<DrivingCompetency>(COMPETENCIES[0]);
  const [wrongCount, setWrongCount] = useState(3);

  // The staged route is passed the way real play passes its rolled one, so the
  // panel previews a scenario that can actually be appended to what is staged
  // rather than one `withRemediation` would drop.
  const onRoute = useMemo(() => new Set(stagedRoute.map(event => event.id)), [stagedRoute]);
  const choice = useMemo(
    () =>
      enabled
        ? selectPractice(buildFakeLogs(competency, wrongCount), levelId, rng, onRoute, GAME_OPTIONS.weakestTieBreak)
        : null,
    [enabled, competency, wrongCount, levelId, onRoute]
  );

  return { enabled, setEnabled, competency, setCompetency, wrongCount, setWrongCount, choice };
};
