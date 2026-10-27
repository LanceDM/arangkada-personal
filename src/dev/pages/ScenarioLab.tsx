// Dev-only. Forces a level's content deterministically - either an exact
// variant per slot, or a reproducible seed - and an optional "jump to event"
// starting distance, then mounts the real GameScreen so the full FSM/physics
// loop plays out. Only registered as a route when import.meta.env.DEV, so it
// is never reachable in production.
import { useState } from 'react';
import { GameScreen } from '@/features/driving-sim';
import { withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { adaptsLevel, levelSupport } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import type { SupportLevel } from '@/domain/learner/competency';
import { type LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { labelForEvent } from '@/dev/fixtures/scenarioCatalog';
import { useStagedLevel } from '@/dev/fixtures/useStagedLevel';
import { useFakeHistory } from '@/dev/fixtures/useFakeHistory';
import { COMPETENCIES } from '@/domain/learner/profile';
import { actionKey } from '@/domain/learner/adaptive/qLearningPolicy';
import LevelStagingControls from '@/dev/components/LevelStagingControls';
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';

const ScenarioLab = () => {
  const staged = useStagedLevel(1);
  const fakeHistory = useFakeHistory(staged.levelId, staged.stagedLevel.events);
  // As in real play, the final exam takes no practice item.
  const practice = adaptsLevel(staged.levelId) ? fakeHistory.choice : null;
  const stagedLevel = practice ? withRemediation(staged.stagedLevel, practice.variant) : staged.stagedLevel;
  // The support level to drive at: what the policy would choose for this level
  // and history, or one forced by hand to see each level of h on any scenario.
  const [supportChoice, setSupportChoice] = useState<SupportLevel | 'policy'>('policy');
  const policySupport = levelSupport(staged.levelId, practice);
  const support = supportChoice === 'policy' ? policySupport : supportChoice;
  const [jumpTo, setJumpTo] = useState<number | 'start'>('start');
  const [launched, setLaunched] = useState<
    { level: LevelConfig; initialDistance?: number; support: SupportLevel } | null
  >(null);

  // Where the drive starts follows what has been staged: a level swap goes back
  // to the beginning, and single-event mode jumps to the forced slot so the
  // player lands on it instead of driving through everything before it.
  // Adjusted while rendering, so the control never shows last selection's slot.
  const stagedAt = `${staged.levelId}:${staged.mode}:${staged.singlePick.slotIndex}`;
  const [jumpFor, setJumpFor] = useState(stagedAt);
  if (jumpFor !== stagedAt) {
    setJumpFor(stagedAt);
    setJumpTo(staged.mode === 'single' ? staged.singlePick.slotIndex : 'start');
  }

  if (launched) {
    return (
      <GameScreen
        level={launched.level}
        initialDistance={launched.initialDistance}
        support={launched.support}
        onComplete={() => setLaunched(null)}
        onExit={() => setLaunched(null)}
      />
    );
  }

  const launch = () => {
    const buffer = 60;
    if (jumpTo === 'start') {
      setLaunched({ level: stagedLevel, support });
      return;
    }
    const event = stagedLevel.events[jumpTo];
    const lead = event.warningDistance ?? WARNING_ZONE_ENTER;
    const initialDistance = Math.max(0, event.triggerAtDistance - lead - buffer);
    setLaunched({ level: stagedLevel, initialDistance, support });
  };

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="font-display text-lg font-black uppercase tracking-wider">Scenario Lab</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Force a level's content, jump straight to an event, and play it through the real game screen.
      </p>

      <div className="mt-6 grid max-w-xl gap-5">
        <LevelStagingControls staged={staged} />

        <div className="grid gap-2 rounded-md border border-border bg-card p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={fakeHistory.enabled}
              onChange={e => fakeHistory.setEnabled(e.target.checked)}
            />
            Simulate weak history (adaptive practice)
          </label>
          <p className="text-xs text-muted-foreground">
            Fabricates a learner who has mastered every competency except the one below, failed it the given
            number of times, and is about to play the staged level. Real play needs this history built up level
            by level; this fakes it so a remediation-carrying route can be launched immediately.
          </p>

          {fakeHistory.enabled && (
            <>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5">
                  Weak at
                  <select
                    value={fakeHistory.competency}
                    onChange={e => fakeHistory.setCompetency(e.target.value as typeof fakeHistory.competency)}
                    className="rounded-md border border-border bg-background px-2 py-1"
                  >
                    {COMPETENCIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  Wrong ×
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={fakeHistory.wrongCount}
                    onChange={e => fakeHistory.setWrongCount(Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded-md border border-border bg-background px-2 py-1"
                  />
                </label>
              </div>

              <p className="font-mono text-xs">
                {fakeHistory.choice ? (
                  <>
                    <span className="text-amber-500">selectPractice → </span>
                    practising <strong>{fakeHistory.choice.competency}</strong>
                    {fakeHistory.choice.competency !== fakeHistory.choice.weakestCompetency &&
                      ` (stand-in for ${fakeHistory.choice.weakestCompetency})`}
                    {' '}at support {fakeHistory.choice.support} (action {actionKey(fakeHistory.choice.action)}
                    , state {fakeHistory.choice.state}), borrowed from level {fakeHistory.choice.sourceLevelId} (
                    {fakeHistory.choice.variant.id})
                    {!practice && ' - not injected: the final exam does not adapt'}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    selectPractice → null (no portable content for {fakeHistory.competency} or any of its
                    curriculum relatives at or before level {staged.levelId})
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Support level (h)</span>
          <select
            value={supportChoice}
            onChange={e => setSupportChoice(e.target.value as SupportLevel | 'policy')}
            className="rounded-md border border-border bg-card px-3 py-2"
          >
            <option value="policy">As the adaptive layer would choose ({policySupport})</option>
            <option value="full">full: the situation and the move</option>
            <option value="cue">cue: the situation and where to look</option>
            <option value="none">none: the situation alone</option>
          </select>
        </label>

        {staged.mode === 'single' ? (
          <p className="text-xs text-muted-foreground">
            Auto-jumping to event {staged.singlePick.slotIndex + 1} — the one you picked above.
          </p>
        ) : (
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Jump to</span>
            <select
              value={jumpTo}
              onChange={e => setJumpTo(e.target.value === 'start' ? 'start' : Number(e.target.value))}
              className="rounded-md border border-border bg-card px-3 py-2"
            >
              <option value="start">Start from the beginning</option>
              {stagedLevel.events.map((event, i) => (
                <option key={i} value={i}>
                  {i + 1}. {labelForEvent(event)} @ {event.triggerAtDistance}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={launch}
          className="rounded-md bg-primary px-4 py-2.5 font-display text-sm font-black uppercase tracking-wider text-primary-foreground"
        >
          Launch
        </button>
      </div>
    </div>
  );
};

export default ScenarioLab;
