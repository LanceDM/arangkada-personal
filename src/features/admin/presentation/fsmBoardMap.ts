/**
 * The driving FSM as a game board: each state a stop, and roads for the
 * machine's main cycle, so a replay reads as a drive rather than a web of
 * arrows.
 *
 * - The main road runs Idle → Driving → Approaching → Reaction, fans into the
 *   three decision stops, and merges again.
 * - After the merge, the correct road runs to Feedback and the mistake branch
 *   runs through Violation into Feedback: the machine shows feedback either
 *   way. From Feedback the return road goes back to Driving, or the pit stop,
 *   Recovery, comes first.
 * - Every other move is off the road, and drawn only while it is the step
 *   shown: a self-loop is a count on its stop, coming to rest a count on Idle,
 *   a crash or a timeout a count on Run over, and anything else a dashed
 *   direct hop.
 *
 * A road only ever carries moves the machine's table has (`ROUTES`, held to
 * the table by a test), and the step's own card always names the machine's
 * real move. Only where the stops stand and how the roads bend is drawn here.
 */
import type { LucideIcon } from 'lucide-react';
import {
  CarFront,
  CircleQuestionMark,
  Eye,
  Flag,
  MessageSquareWarning,
  OctagonX,
  Pause,
  RotateCcw,
  Signpost,
  Siren,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import type { FSMState } from '@/features/driving-sim';
import { edgeKey, type TimelineStep } from '@/features/admin/domain/replayTimeline';

export const BOARD = { width: 680, height: 400, stopRadius: 24 } as const;

export type StopRole = 'drive' | 'decide' | 'feedback' | 'mistake' | 'finish' | 'crash';

/** Each role's colour on the board, which is a dark game screen in either theme. */
export const ROLE_COLOR: Record<StopRole, string> = {
  drive: '#F4C524',
  decide: '#8B7CF6',
  feedback: '#38BDF8',
  mistake: '#F0784A',
  finish: '#34D399',
  crash: '#F05252',
};

export interface Stop {
  x: number;
  y: number;
  label: string;
  role: StopRole;
  icon: LucideIcon;
  /** Where the label sits: under the stop unless it says otherwise. */
  labelSide?: 'right';
}

export const STOPS: Record<FSMState, Stop> = {
  IDLE: { x: 60, y: 45, label: 'Idle', role: 'drive', icon: Pause },
  COMPLETED: { x: 170, y: 45, label: 'Finish', role: 'finish', icon: Flag, labelSide: 'right' },
  DRIVING: { x: 170, y: 120, label: 'Driving', role: 'drive', icon: CarFront },
  APPROACHING_EVENT: { x: 290, y: 120, label: 'Approaching', role: 'drive', icon: Eye },
  REACTION_WINDOW: { x: 410, y: 120, label: 'Reaction', role: 'drive', icon: Zap },
  INTERSECTION: { x: 520, y: 50, label: 'Intersection', role: 'decide', icon: Signpost },
  HAZARD: { x: 520, y: 120, label: 'Hazard', role: 'decide', icon: TriangleAlert },
  DECISION: { x: 520, y: 190, label: 'Decision', role: 'decide', icon: CircleQuestionMark },
  VIOLATION: { x: 520, y: 265, label: 'Violation', role: 'mistake', icon: OctagonX },
  FEEDBACK_DISPLAYED: { x: 450, y: 340, label: 'Feedback', role: 'feedback', icon: MessageSquareWarning },
  RECOVERY: { x: 290, y: 265, label: 'Recovery', role: 'mistake', icon: RotateCcw },
  GAME_OVER: { x: 60, y: 340, label: 'Run over', role: 'crash', icon: Siren },
};

/** The roads, as SVG paths on the board. */
export const ROADS = {
  'idle-driving': 'M77 62C110 95 138 100 153 103',
  'driving-finish': 'M170 96V69',
  'driving-approaching': 'M194 120H266',
  'approaching-reaction': 'M314 120H386',
  'reaction-intersection': 'M434 120C470 120 470 50 496 50',
  'reaction-hazard': 'M434 120H496',
  'reaction-decision': 'M434 120C470 120 470 190 496 190',
  'intersection-out': 'M544 50C580 50 600 80 600 120',
  'hazard-out': 'M544 120H600',
  'decision-out': 'M544 190C580 190 600 160 600 120',
  'to-feedback': 'M600 120V310Q600 340 570 340H474',
  'to-violation': 'M600 205C600 245 580 265 544 265',
  'violation-out': 'M520 289C520 322 500 338 474 340',
  'feedback-return': 'M426 340H140Q110 340 110 310V150Q110 120 140 120H146',
  'feedback-recovery': 'M433 323C400 290 350 265 314 265',
  'recovery-return': 'M266 265H135Q110 265 110 240V150Q110 120 140 120H146',
} as const;

export type RoadId = keyof typeof ROADS;

/** The roads each move travels, by the machine's (from, to). Every key is a move in its table. */
export const ROUTES: Readonly<Record<string, readonly RoadId[]>> = {
  [edgeKey('IDLE', 'DRIVING')]: ['idle-driving'],
  [edgeKey('DRIVING', 'COMPLETED')]: ['driving-finish'],
  [edgeKey('DRIVING', 'APPROACHING_EVENT')]: ['driving-approaching'],
  [edgeKey('APPROACHING_EVENT', 'REACTION_WINDOW')]: ['approaching-reaction'],
  [edgeKey('REACTION_WINDOW', 'INTERSECTION')]: ['reaction-intersection'],
  [edgeKey('REACTION_WINDOW', 'HAZARD')]: ['reaction-hazard'],
  [edgeKey('REACTION_WINDOW', 'DECISION')]: ['reaction-decision'],
  [edgeKey('INTERSECTION', 'FEEDBACK_DISPLAYED')]: ['intersection-out', 'to-feedback'],
  [edgeKey('HAZARD', 'FEEDBACK_DISPLAYED')]: ['hazard-out', 'to-feedback'],
  [edgeKey('INTERSECTION', 'VIOLATION')]: ['intersection-out', 'to-violation'],
  [edgeKey('HAZARD', 'VIOLATION')]: ['hazard-out', 'to-violation'],
  [edgeKey('DECISION', 'VIOLATION')]: ['decision-out', 'to-violation'],
  [edgeKey('VIOLATION', 'FEEDBACK_DISPLAYED')]: ['violation-out'],
  [edgeKey('FEEDBACK_DISPLAYED', 'DRIVING')]: ['feedback-return'],
  [edgeKey('FEEDBACK_DISPLAYED', 'RECOVERY')]: ['feedback-recovery'],
  [edgeKey('RECOVERY', 'DRIVING')]: ['recovery-return'],
};

/**
 * How a move shows on the board: along roads, as a count on a stop (a
 * self-loop, coming to rest, a crash, running out of time), or as a direct hop
 * drawn only while it is the step shown. GAME_OVER is reached two ways, so the
 * trigger tells a crash from a timeout.
 */
export type BoardMove =
  | { kind: 'road'; roads: readonly RoadId[] }
  | { kind: 'loop' }
  | { kind: 'rest' }
  | { kind: 'crash' }
  | { kind: 'time-up' }
  | { kind: 'direct' };

export const boardMove = (from: FSMState, to: FSMState, trigger?: string): BoardMove => {
  if (from === to) return { kind: 'loop' };
  if (to === 'IDLE') return { kind: 'rest' };
  if (to === 'GAME_OVER') return trigger === 'time_up' ? { kind: 'time-up' } : { kind: 'crash' };
  const roads = ROUTES[edgeKey(from, to)];
  return roads ? { kind: 'road', roads } : { kind: 'direct' };
};

/** What the board shows up to and including the step: everything after it is still ahead. */
export interface BoardProgress {
  /** Stops entered so far, the one the log starts at included. */
  reached: Set<FSMState>;
  /** Roads travelled so far. */
  lit: Set<RoadId>;
  /** Self-loops so far, per stop. */
  loops: Partial<Record<FSMState, number>>;
  rests: number;
  crashes: number;
  timeouts: number;
  direct: number;
}

export const boardProgress = (
  steps: readonly TimelineStep[],
  step: TimelineStep | null,
  initial: FSMState | null
): BoardProgress => {
  const progress: BoardProgress = { reached: new Set(), lit: new Set(), loops: {}, rests: 0, crashes: 0, timeouts: 0, direct: 0 };
  if (initial) progress.reached.add(initial);
  if (!step) return progress;
  for (const each of steps) {
    if (each.index > step.index) break;
    const move = boardMove(each.from, each.to, each.trigger);
    if (move.kind === 'loop') {
      progress.loops[each.from] = (progress.loops[each.from] ?? 0) + each.count;
      continue;
    }
    progress.reached.add(each.to);
    if (move.kind === 'road') for (const road of move.roads) progress.lit.add(road);
    else if (move.kind === 'rest') progress.rests += each.count;
    else if (move.kind === 'crash') progress.crashes += each.count;
    else if (move.kind === 'time-up') progress.timeouts += each.count;
    else progress.direct += each.count;
  }
  return progress;
};
