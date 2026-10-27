import { useEffect, useState } from 'react';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { FSMState, FSMSnapshot } from '@/features/driving-sim/domain/fsm/fsmTypes';

const INITIAL_SNAPSHOT: FSMSnapshot = {
  competency: 'unassigned',
  gameplay: 'IDLE',
};

/**
 * Also used by `FSMConsole` (`/dev/fsm`) to drive a throwaway instance by
 * hand - deliberately not registered with `domain/fsm/devRegistry` here. If it
 * were, opening that console and firing a couple of triggers to poke at the
 * state machine would silently overwrite `/dev/profile`'s "last real drive"
 * pointer with a near-empty scratch log. `GameScreen` (the only caller that
 * is ever a real drive) registers its own instance instead - see the
 * registerActiveFSM call there.
 */
export const useFSM = () => {
  // One machine per drive, created once. Held in state rather than a ref so
  // consumers can read it during render without reaching into `.current`.
  const [fsm] = useState(() => new DrivingFSM());
  const [fsmState, setFsmState] = useState<FSMState>('IDLE');
  const [snapshot, setSnapshot] = useState<FSMSnapshot>(INITIAL_SNAPSHOT);
  const [prevFsmState, setPrevFsmState] = useState<FSMState | undefined>(undefined);
  const [transitionLabel, setTransitionLabel] = useState('');

  useEffect(() => {
    const unsub = fsm.on(event => {
      if (event.type === 'state_change') {
        setPrevFsmState(event.data.from);
        setFsmState(event.data.to!);
        setTransitionLabel(event.data.message || '');
        if (event.data.snapshot) {
          setSnapshot(event.data.snapshot);
        }
      }
    });
    return unsub;
  }, [fsm]);

  return { fsm, fsmState, snapshot, prevFsmState, transitionLabel };
};
