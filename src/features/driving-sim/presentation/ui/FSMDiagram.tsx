import { FSMState, FSMSnapshot } from '@/features/driving-sim/domain/fsm/fsmTypes';
import { useState } from 'react';

interface FSMDiagramProps {
  currentState: FSMState;
  snapshot?: FSMSnapshot;
  previousState?: FSMState;
  transitionLabel?: string;
  compact?: boolean;
}

const STATE_NODES: { id: FSMState; label: string; x: number; y: number }[] = [
  { id: 'IDLE', label: 'IDLE', x: 10, y: 50 },
  { id: 'DRIVING', label: 'DRIVE', x: 28, y: 50 },
  { id: 'APPROACHING_EVENT', label: 'APPROACH', x: 46, y: 28 },
  { id: 'REACTION_WINDOW', label: 'REACT', x: 64, y: 28 },
  { id: 'INTERSECTION', label: 'INTERSECT', x: 82, y: 18 },
  { id: 'HAZARD', label: 'HAZARD', x: 82, y: 40 },
  { id: 'DECISION', label: 'DECIDE', x: 82, y: 62 },
  { id: 'VIOLATION', label: 'VIOLATE', x: 64, y: 80 },
  { id: 'FEEDBACK_DISPLAYED', label: 'FEEDBACK', x: 46, y: 80 },
  { id: 'RECOVERY', label: 'RECOVER', x: 28, y: 80 },
  { id: 'COMPLETED', label: 'DONE', x: 10, y: 80 },
];

const EDGES: { from: FSMState; to: FSMState; label: string }[] = [
  { from: 'IDLE', to: 'DRIVING', label: 'start' },
  { from: 'DRIVING', to: 'APPROACHING_EVENT', label: 'event' },
  { from: 'APPROACHING_EVENT', to: 'REACTION_WINDOW', label: 'near' },
  { from: 'REACTION_WINDOW', to: 'INTERSECTION', label: 'sign/light' },
  { from: 'REACTION_WINDOW', to: 'HAZARD', label: 'hazard' },
  { from: 'REACTION_WINDOW', to: 'DECISION', label: 'choice' },
  { from: 'INTERSECTION', to: 'FEEDBACK_DISPLAYED', label: 'feedback' },
  { from: 'HAZARD', to: 'FEEDBACK_DISPLAYED', label: 'feedback' },
  { from: 'REACTION_WINDOW', to: 'VIOLATION', label: 'wrong' },
  { from: 'INTERSECTION', to: 'VIOLATION', label: 'wrong' },
  { from: 'HAZARD', to: 'VIOLATION', label: 'wrong' },
  { from: 'VIOLATION', to: 'FEEDBACK_DISPLAYED', label: 'explain' },
  { from: 'FEEDBACK_DISPLAYED', to: 'RECOVERY', label: 'recover' },
  { from: 'RECOVERY', to: 'DRIVING', label: 'clear' },
  { from: 'DRIVING', to: 'COMPLETED', label: 'finish' },
];

const stateColor = (state: FSMState, isActive: boolean): string => {
  if (!isActive) return 'hsl(var(--muted))';
  switch (state) {
    case 'IDLE': return 'hsl(var(--muted-foreground))';
    case 'DRIVING': return 'hsl(var(--accent))';
    case 'APPROACHING_EVENT': return 'hsl(var(--primary))';
    case 'REACTION_WINDOW': return 'hsl(var(--signal-amber))';
    case 'INTERSECTION': return 'hsl(var(--primary))';
    case 'HAZARD': return 'hsl(var(--signal-amber))';
    case 'DECISION': return 'hsl(var(--primary))';
    case 'FEEDBACK_DISPLAYED': return 'hsl(var(--primary))';
    case 'RECOVERY': return 'hsl(var(--accent))';
    case 'VIOLATION': return 'hsl(var(--destructive))';
    case 'COMPLETED': return 'hsl(var(--accent))';
    default: return 'hsl(var(--muted-foreground))';
  }
};

const formatSnapshotLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase());

/**
 * Tone and description both come from the gameplay state itself. They used to
 * read a separate `phase` annotation, which was only ever a restatement of the
 * trigger that had just fired - so sourcing them from the machine's real state
 * shows the same thing without a second field to keep in sync.
 */
const stateTone = (gameplay: FSMState) => {
  if (gameplay === 'VIOLATION' || gameplay === 'GAME_OVER') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (gameplay === 'FEEDBACK_DISPLAYED' || gameplay === 'RECOVERY') return 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber';
  if (gameplay === 'COMPLETED') return 'border-accent/30 bg-accent/10 text-accent';
  return 'border-primary/30 bg-primary/10 text-primary';
};

const statePurpose = (snapshot?: FSMSnapshot) => {
  if (!snapshot) return 'Tracks the target skill and road state.';
  const { gameplay } = snapshot;
  if (gameplay === 'VIOLATION') return 'The learner made a decision that needs corrective feedback.';
  if (gameplay === 'GAME_OVER') return 'The run ended in a collision.';
  if (gameplay === 'FEEDBACK_DISPLAYED' || gameplay === 'RECOVERY') return 'The correction is being shown before driving resumes.';
  if (gameplay === 'COMPLETED') return 'The session ended and learner mastery can be summarized.';
  return 'The learner is practicing while the game monitors skill-specific decisions.';
};

const FSMDiagram = ({ currentState, snapshot, previousState, transitionLabel, compact }: FSMDiagramProps) => {
  /**
   * The transitions this diagram has seen, adjusted as the props change rather
   * than in an Effect: the history is derived from the state the machine has
   * moved through, so recording it a render late would leave the list one
   * transition behind what is highlighted.
   */
  const [seen, setSeen] = useState<{ at: string; history: string[] }>({ at: '', history: [] });
  const transitionKey = `${previousState ?? ''}->${currentState}`;
  if (seen.at !== transitionKey) {
    setSeen(previous => ({
      at: transitionKey,
      history:
        previousState && previousState !== currentState
          ? [`${previousState} -> ${currentState}`, ...previous.history].slice(0, 5)
          : previous.history,
    }));
  }
  const transitionHistory = seen.history;

  /**
   * The arrival flash. A CSS animation keyed on the state rather than a timer
   * writing back into React: entering a state remounts the element, which is
   * what restarts the animation, and nothing has to be unwound on the way out.
   */

  if (compact) {
    return (
      <div className="bg-card/90 backdrop-blur border border-border rounded-xl p-3 w-52">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="font-display text-[10px] text-muted-foreground tracking-wider">DRIVING FSM</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap mb-2">
          {STATE_NODES.map(node => {
            const isActive = node.id === currentState;
            const wasPrevious = node.id === previousState;
            return (
              <div
                key={node.id}
                className={`px-1.5 py-0.5 rounded text-[8px] font-display transition-all duration-300 border ${
                  isActive ? 'scale-110 border-current shadow-sm' : 'border-transparent opacity-50'
                } ${wasPrevious && !isActive ? 'opacity-70' : ''}`}
                style={{ color: stateColor(node.id, isActive || wasPrevious) }}
              >
                {node.label}
              </div>
            );
          })}
        </div>

        <div
          key={currentState}
          className="animate-fsm-arrival text-center py-1.5 rounded-lg border font-display text-xs tracking-wider transition-all duration-300"
          style={{
            color: stateColor(currentState, true),
            borderColor: stateColor(currentState, true),
            backgroundColor: `color-mix(in srgb, ${stateColor(currentState, true)} 10%, transparent)`,
          }}
        >
          {currentState}
        </div>

        {snapshot && (
          <div className="mt-2 grid gap-1 text-[8px] text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>SKILL</span>
              <span className="text-foreground">{formatSnapshotLabel(snapshot.competency)}</span>
            </div>
          </div>
        )}

        {transitionHistory.length > 0 && (
          <div className="mt-2 space-y-0.5">
            <span className="text-[8px] text-muted-foreground font-display">TRANSITIONS</span>
            {transitionHistory.slice(0, 3).map((t, i) => (
              <div key={i} className="text-[8px] text-muted-foreground/60 font-body" style={{ opacity: 1 - i * 0.3 }}>
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const svgW = 360;
  const svgH = 240;

  const getPos = (state: FSMState) => {
    const n = STATE_NODES.find(n => n.id === state);
    return n ? { x: (n.x / 100) * svgW, y: (n.y / 100) * svgH } : { x: 0, y: 0 };
  };

  return (
    <div className="bg-card/95 backdrop-blur border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="font-display text-xs text-muted-foreground tracking-wider">DRIVING FSM</span>
        {transitionLabel && (
          <span className="ml-auto font-body text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {transitionLabel}
          </span>
        )}
      </div>

      <svg width={svgW} height={svgH} className="w-full" viewBox={`0 0 ${svgW} ${svgH}`}>
        {EDGES.map((edge, i) => {
          const from = getPos(edge.from);
          const to = getPos(edge.to);
          const isActiveEdge = edge.from === previousState && edge.to === currentState;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const offsetX = len ? -dy / len * 12 : 0;
          const offsetY = len ? dx / len * 12 : 0;

          return (
            <g key={i}>
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={isActiveEdge ? stateColor(edge.to, true) : 'hsl(var(--border))'}
                strokeWidth={isActiveEdge ? 2.5 : 1}
                strokeDasharray={isActiveEdge ? '' : '4 3'}
                opacity={isActiveEdge ? 1 : 0.4}
              />
              <circle
                cx={to.x + (from.x - to.x) * 0.15}
                cy={to.y + (from.y - to.y) * 0.15}
                r={isActiveEdge ? 3 : 2}
                fill={isActiveEdge ? stateColor(edge.to, true) : 'hsl(var(--border))'}
                opacity={isActiveEdge ? 1 : 0.4}
              />
              <text
                x={midX + offsetX}
                y={midY + offsetY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fill={isActiveEdge ? stateColor(edge.to, true) : 'hsl(var(--muted-foreground))'}
                opacity={isActiveEdge ? 1 : 0.5}
                fontFamily="'Orbitron', monospace"
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {STATE_NODES.map(node => {
          const isActive = node.id === currentState;
          const pos = getPos(node.id);
          const color = stateColor(node.id, isActive);

          return (
            <g key={node.id}>
              {isActive && (
                <circle cx={pos.x} cy={pos.y} r={24} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
                  <animate attributeName="r" from="18" to="28" dur="0.6s" fill="freeze" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="0.6s" fill="freeze" />
                </circle>
              )}
              <circle
                cx={pos.x} cy={pos.y}
                r={isActive ? 18 : 14}
                fill={isActive ? `color-mix(in srgb, ${color} 20%, transparent)` : 'hsl(var(--card))'}
                stroke={color}
                strokeWidth={isActive ? 2.5 : 1}
                opacity={isActive ? 1 : 0.5}
              />
              <text
                x={pos.x} y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isActive ? '8' : '7'}
                fill={color}
                fontFamily="'Orbitron', monospace"
                fontWeight={isActive ? 700 : 400}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {snapshot && (
        <div className="mt-3 border-t border-border pt-3">
          <div className={`mb-2 rounded-lg border px-3 py-2 text-[10px] font-semibold leading-relaxed ${stateTone(snapshot.gameplay)}`}>
            {statePurpose(snapshot)}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary p-2">
              <p className="font-display text-[8px] text-muted-foreground tracking-wider">TARGET SKILL</p>
              <p className="mt-1 text-[10px] font-semibold text-foreground">{formatSnapshotLabel(snapshot.competency)}</p>
            </div>
            <div className="rounded-lg bg-secondary p-2">
              <p className="font-display text-[8px] text-muted-foreground tracking-wider">ROAD STATE</p>
              <p className="mt-1 text-[10px] font-semibold text-foreground">{formatSnapshotLabel(snapshot.gameplay)}</p>
            </div>
          </div>
        </div>
      )}

      {transitionHistory.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <span className="font-display text-[9px] text-muted-foreground tracking-wider">TRANSITION LOG</span>
          <div className="mt-1 space-y-0.5">
            {transitionHistory.map((t, i) => (
              <div key={i} className="text-[10px] text-muted-foreground/70 font-body flex items-center gap-1.5" style={{ opacity: 1 - i * 0.2 }}>
                <span className="w-1 h-1 rounded-full bg-primary/50" />
                {t}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FSMDiagram;
