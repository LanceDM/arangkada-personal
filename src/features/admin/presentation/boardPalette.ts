/** The game boards' colours: a dark game screen in either theme. */
export const ASPHALT = '#1E2542';
export const TRAVELLED = '#3A4466';
export const LANE = '#F4C524';
export const BOARD_INK = '#10152A';
export const BOARD_BACKGROUND = '#0C1122';

/** A stop's pulse and the rolling dashes on the road being driven. */
export const BOARD_MOTION = `
@keyframes fsm-pulse { from { transform: scale(1); opacity: .65 } to { transform: scale(1.5); opacity: 0 } }
@keyframes fsm-roll { to { stroke-dashoffset: -24 } }
.fsm-pulse { animation: fsm-pulse 1.6s ease-out infinite; transform-box: fill-box; transform-origin: center }
.fsm-roll { animation: fsm-roll .9s linear infinite }
@media (prefers-reduced-motion: reduce) { .fsm-pulse, .fsm-roll { animation: none } }
`;
