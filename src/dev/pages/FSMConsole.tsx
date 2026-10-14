// Dev-only. Fires DrivingFSM transitions by hand and watches the state/log
// respond, independent of a live drive - reuses useFSM() as-is (it already
// owns its own DrivingFSM instance and isn't tied to GameScreen) and renders
// the existing FSMDiagram (normally admin-only, inside GameScreen). Only
// registered as a route when import.meta.env.DEV (see app/router/AppRouter.tsx) - never
// reachable in production.
import { useState } from 'react';
import FSMDiagram from '@/features/driving-sim/presentation/ui/FSMDiagram';
import { useFSM } from '@/features/driving-sim/application/useFSM';
import type { EnvironmentTrigger, UserAction } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { DrivingCompetency } from '@/domain/learner/competency';

const USER_ACTIONS: UserAction[] = ['start', 'accelerate', 'brake', 'turn_left', 'turn_right', 'stop'];

const ENV_TRIGGERS: EnvironmentTrigger[] = [
  'red_light', 'green_light', 'yellow_light', 'pedestrian_crossing', 'obstacle_ahead',
  'stop_sign', 'speed_limit', 'road_clear', 'road_marking', 'overtaking_zone',
  'emergency_vehicle', 'level_end', 'scenario_trigger', 'feedback_displayed',
  'recovery_complete', 'crash',
];

const COMPETENCIES: DrivingCompetency[] = [
  'driver_legality', 'document_awareness', 'traffic_signals', 'road_signs',
  'right_of_way', 'pedestrians', 'speed_control', 'lane_discipline',
  'hazard_awareness', 'parking', 'general_rules',
];

const FSMConsole = () => {
  const { fsm, fsmState, snapshot, prevFsmState, transitionLabel } = useFSM();
  const [, forceRerender] = useState(0);

  // getTransitionLog() is a plain method, not reactive state - re-render
  // after every fired trigger so the log panel below picks up the change.
  const fire = (trigger: UserAction | EnvironmentTrigger) => {
    fsm.transition(trigger);
    forceRerender(n => n + 1);
  };

  const log = fsm.getTransitionLog();

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <h1 className="font-display text-lg font-black uppercase tracking-wider">FSM Console</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fire state-machine triggers by hand and watch the diagram/log respond - no drive needed.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <FSMDiagram
            currentState={fsmState}
            snapshot={snapshot}
            previousState={prevFsmState}
            transitionLabel={transitionLabel}
          />

          <div className="rounded-lg border border-border bg-card/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User actions</p>
            <div className="flex flex-wrap gap-2">
              {USER_ACTIONS.map(action => (
                <button
                  key={action}
                  onClick={() => fire(action)}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Environment triggers</p>
            <div className="flex flex-wrap gap-2">
              {ENV_TRIGGERS.map(trigger => (
                <button
                  key={trigger}
                  onClick={() => fire(trigger)}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  {trigger}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/60 p-4">
            <label className="grid gap-1.5 text-xs">
              <span className="font-semibold">Competency</span>
              <select
                onChange={e => {
                  fsm.setCompetency(e.target.value as DrivingCompetency);
                  forceRerender(n => n + 1);
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5"
              >
                {COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button
              onClick={() => {
                fsm.reset();
                forceRerender(n => n + 1);
              }}
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Transition log ({log.length})
          </p>
          <div className="grid max-h-[70vh] gap-1.5 overflow-y-auto text-xs">
            {log.length === 0 && <p className="text-muted-foreground">Nothing fired yet.</p>}
            {[...log].reverse().map((entry, i) => (
              <pre key={i} className="whitespace-pre-wrap rounded-md bg-background px-2 py-1.5">
                {JSON.stringify(entry, null, 2)}
              </pre>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FSMConsole;
