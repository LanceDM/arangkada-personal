// Dev-only: a handle on the DrivingFSM instance the most recent drive used.
//
// `DrivingFSM.getTransitionLog()` records every transition for thesis
// analytics, but the instance that records them is created inside `useFSM` and
// dies with the component that owns it - so from any other route there is no
// way to read what a drive actually did. A dev route cannot be mounted at the
// same time as the game (routes are exclusive), which leaves exactly one
// question answerable: what did the *last* drive in this tab do.
//
// That is deliberately all this is. It is a pointer to one live object, not a
// recording, a buffer, or a session store - the transition log itself already
// lives on the instance. A replay system would need real persistence; this
// needs none, and adding any would be building that system by accident.
//
// Registration is guarded by `import.meta.env.DEV` at the call site, so the
// whole thing folds away in a production build.

import type { DrivingFSM } from './DrivingFSM';

let activeFSM: DrivingFSM | null = null;

/** Called by `useFSM` on mount. The last caller wins - there is only ever one drive. */
export const registerActiveFSM = (fsm: DrivingFSM) => {
  activeFSM = fsm;
};

/**
 * The most recently mounted FSM, or null if nothing has been driven in this
 * tab yet. Still live after the drive unmounts: nothing resets the instance,
 * so its transition log survives for as long as the page does.
 */
export const getActiveFSM = (): DrivingFSM | null => activeFSM;
