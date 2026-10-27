import type { ReactNode } from 'react';
import type { MarkingPlate, RoadMarkingArt } from '@/features/driving-sim/domain/scenario/scenarioScene';

/**
 * The marking equivalent of SignPlateCard.
 *
 * Paint on a 200px carriageway is not something anyone can identify by eye, and
 * a marking has no roadside plate to enlarge, so this draws the marking itself
 * on a swatch of road beside the question. Where the level module's own image
 * has been wired in it is used instead; until then the drawing carries the
 * level on its own, because a marking the player cannot see is a question about
 * nothing.
 */

const ASPHALT = '#3a3a50';
const WHITE = '#f8fafc';
const YELLOW = '#eab308';

/** Two lanes of road, drawn top-down, that every swatch is painted onto. */
const Road = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 100 100" className="h-full w-full" role="presentation">
    <rect x="0" y="0" width="100" height="100" fill={ASPHALT} />
    {children}
  </svg>
);

/** A line running with the traffic, at x, optionally dashed. */
const Along = ({
  x,
  color,
  dashed = false,
  width = 4,
}: {
  x: number;
  color: string;
  dashed?: boolean;
  width?: number;
}) => (
  <line
    x1={x}
    y1="-2"
    x2={x}
    y2="102"
    stroke={color}
    strokeWidth={width}
    strokeDasharray={dashed ? '12 9' : undefined}
  />
);

/** A line running across the traffic, at y. */
const Across = ({
  y,
  color,
  dashed = false,
  width = 6,
}: {
  y: number;
  color: string;
  dashed?: boolean;
  width?: number;
}) => (
  <line
    x1="4"
    y1={y}
    x2="96"
    y2={y}
    stroke={color}
    strokeWidth={width}
    strokeDasharray={dashed ? '9 7' : undefined}
  />
);

const UpArrow = ({ x = 50, color = WHITE }: { x?: number; color?: string }) => (
  <g fill={color}>
    <rect x={x - 3} y="42" width="6" height="34" />
    <polygon points={`${x},22 ${x - 14},46 ${x + 14},46`} />
  </g>
);

/**
 * Every marking drawn on its swatch of road, except the one whose whole
 * content is a number the level supplies. Keyed by art rather than by name,
 * so the two names the module gives a double yellow line share one drawing.
 *
 * A module-level constant rather than a value computed inside the component:
 * none of this depends on props, so it only needs to exist once rather than
 * being rebuilt — thirty-odd JSX trees — on every render.
 */
const STATIC_MARKING_ART: Record<Exclude<RoadMarkingArt, 'pavement_speed_limit'>, ReactNode> = {
  // A. Longitudinal lines.
  centre_line: <Along x={50} color={WHITE} />,
  lane_line: <Along x={50} color={WHITE} dashed />,
  double_solid_yellow: (
    <>
      <Along x={44} color={YELLOW} />
      <Along x={56} color={YELLOW} />
    </>
  ),
  single_solid_yellow: <Along x={50} color={YELLOW} />,
  solid_yellow_broken_white: (
    <>
      <Along x={44} color={YELLOW} />
      <Along x={58} color={WHITE} dashed width={3} />
    </>
  ),
  // The same pair, mirrored: solid yellow moves to the near (right) side.
  broken_white_solid_yellow: (
    <>
      <Along x={42} color={WHITE} dashed width={3} />
      <Along x={56} color={YELLOW} />
    </>
  ),
  broken_yellow: <Along x={50} color={YELLOW} dashed />,
  broken_and_solid_yellow: (
    <>
      <Along x={44} color={YELLOW} dashed />
      <Along x={56} color={YELLOW} />
    </>
  ),
  edge_line: (
    <>
      <rect x="0" y="0" width="18" height="100" fill="#4b4b3a" />
      <Along x={22} color={WHITE} />
    </>
  ),
  // The lane on the left is running out, so its line closes in on the through
  // lane: that convergence is the whole message of a continuity line.
  continuity_line: (
    <>
      <Along x={64} color={WHITE} dashed width={3} />
      <line x1="14" y1="100" x2="46" y2="0" stroke={WHITE} strokeWidth="5" strokeDasharray="10 6" />
    </>
  ),
  transition_line: (
    <>
      <polygon points="50,14 40,52 60,52" fill="#94a3b8" />
      <line x1="26" y1="100" x2="34" y2="46" stroke={WHITE} strokeWidth="4" />
      <line x1="74" y1="100" x2="66" y2="46" stroke={WHITE} strokeWidth="4" />
    </>
  ),

  // B. Traverse lines.
  stop_line: (
    <>
      <Across y={40} color={WHITE} width={9} />
      <text x="50" y="72" textAnchor="middle" fontSize="17" fontWeight="700" fill={WHITE}>
        STOP
      </text>
    </>
  ),
  give_way_line: (
    <>
      <Across y={36} color={WHITE} dashed width={5} />
      <Across y={48} color={WHITE} dashed width={5} />
    </>
  ),
  pedestrian_crossing: (
    <>
      {[10, 26, 42, 58, 74].map(x => (
        <rect key={x} x={x} y="24" width="10" height="52" fill={WHITE} />
      ))}
    </>
  ),
  pedestrian_crossing_signalized: (
    <>
      {[10, 26, 42, 58, 74].map(x => (
        <rect key={x} x={x} y="24" width="10" height="52" fill={WHITE} />
      ))}
      <rect x="82" y="8" width="14" height="26" rx="2" fill="#1f2937" />
      <circle cx="89" cy="15" r="4" fill="#ef4444" />
      <circle cx="89" cy="26" r="4" fill="#052e16" />
    </>
  ),

  // C. Other lines.
  turn_line: (
    <>
      <path d="M 30 100 Q 30 44 88 44" fill="none" stroke={WHITE} strokeWidth="4" strokeDasharray="9 7" />
      <polygon points="96,44 78,36 78,52" fill={WHITE} />
    </>
  ),
  yellow_box: (
    <>
      <rect x="10" y="18" width="80" height="64" fill="none" stroke={YELLOW} strokeWidth="4" />
      <line x1="10" y1="18" x2="90" y2="82" stroke={YELLOW} strokeWidth="3" />
      <line x1="90" y1="18" x2="10" y2="82" stroke={YELLOW} strokeWidth="3" />
    </>
  ),
  parking_bay: (
    <>
      <rect x="20" y="18" width="60" height="64" fill="none" stroke={WHITE} strokeWidth="4" />
      <text x="50" y="62" textAnchor="middle" fontSize="38" fontWeight="800" fill={WHITE}>
        P
      </text>
    </>
  ),
  loading_bay: (
    <>
      <Along x={22} color={WHITE} />
      <Along x={78} color={WHITE} />
      <text x="50" y="58" textAnchor="middle" fontSize="15" fontWeight="700" fill={WHITE}>
        LOAD
      </text>
    </>
  ),

  // C/D. Reserved lanes.
  bus_puj_lane_line: (
    <>
      <rect x="62" y="0" width="38" height="100" fill="rgba(234,179,8,0.16)" />
      <Along x={62} color={YELLOW} width={5} />
      <text x="81" y="56" textAnchor="middle" fontSize="12" fontWeight="700" fill={YELLOW}>
        PUJ
      </text>
    </>
  ),
  bus_lane: (
    <>
      <rect x="62" y="0" width="38" height="100" fill="rgba(234,179,8,0.16)" />
      <Along x={62} color={YELLOW} width={5} />
      <text x="81" y="56" textAnchor="middle" fontSize="12" fontWeight="700" fill={YELLOW}>
        BUS
      </text>
    </>
  ),
  bicycle_lane: (
    <>
      <rect x="0" y="0" width="34" height="100" fill="rgba(34,197,94,0.2)" />
      <Along x={34} color={WHITE} width={5} />
      <g fill="none" stroke={WHITE} strokeWidth="2.5">
        <circle cx="10" cy="60" r="7" />
        <circle cx="26" cy="60" r="7" />
        <path d="M 10 60 L 18 44 L 26 60" />
      </g>
    </>
  ),
  motorcycle_lane: (
    <>
      <rect x="0" y="0" width="34" height="100" fill="rgba(59,130,246,0.22)" />
      <Along x={34} color={WHITE} width={5} />
      <text x="17" y="58" textAnchor="middle" fontSize="13" fontWeight="700" fill={WHITE}>
        MC
      </text>
    </>
  ),

  // E. Painted curbs.
  red_curb: (
    <>
      <rect x="0" y="0" width="26" height="100" fill="#5b6067" />
      <rect x="20" y="0" width="10" height="100" fill="#dc2626" />
      <text x="66" y="56" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fca5a5">
        NO PARKING
      </text>
    </>
  ),
  yellow_curb: (
    <>
      <rect x="0" y="0" width="26" height="100" fill="#5b6067" />
      <rect x="20" y="0" width="10" height="100" fill={YELLOW} />
      <text x="66" y="50" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fde68a">
        NO LOAD
      </text>
      <text x="66" y="66" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fde68a">
        UNLOAD
      </text>
    </>
  ),

  // F. Object markings.
  traffic_cones: (
    <>
      {[[26, 78], [50, 56], [74, 34]].map(([x, y]) => (
        <g key={x}>
          <polygon points={`${x},${y - 16} ${x - 10},${y + 6} ${x + 10},${y + 6}`} fill="#fb923c" />
          <rect x={x - 5} y={y - 5} width="10" height="4" fill={WHITE} />
        </g>
      ))}
    </>
  ),
  concrete_barriers: (
    <>
      {[16, 46, 76].map(y => (
        <g key={y}>
          <rect x="18" y={y} width="64" height="22" rx="3" fill="#9ca3af" />
          <rect x="18" y={y + 8} width="64" height="6" fill="#f97316" />
        </g>
      ))}
    </>
  ),

  // G. Raised pavement markers.
  cats_eye: (
    <>
      {[14, 38, 62, 86].map(y => (
        <g key={y}>
          <rect x="42" y={y} width="16" height="9" rx="2" fill="#e2e8f0" />
          <rect x="45" y={y + 2} width="10" height="5" rx="1" fill="#facc15" />
        </g>
      ))}
    </>
  ),

  // H. Other markings.
  approach_markings: (
    <>
      <polygon points="50,16 36,58 64,58" fill="#94a3b8" />
      <line x1="20" y1="100" x2="30" y2="50" stroke={WHITE} strokeWidth="4" />
      <line x1="80" y1="100" x2="70" y2="50" stroke={WHITE} strokeWidth="4" />
      <line x1="34" y1="66" x2="66" y2="66" stroke={WHITE} strokeWidth="3" strokeDasharray="6 5" />
    </>
  ),
  chevron_marking: (
    <>
      {[22, 50, 78].map(y => (
        <polyline
          key={y}
          points={`22,${y + 12} 50,${y - 8} 78,${y + 12}`}
          fill="none"
          stroke={WHITE}
          strokeWidth="5"
        />
      ))}
    </>
  ),
  rumble_strips: (
    <>
      {[18, 30, 42, 54, 66, 78].map(y => (
        <rect key={y} x="8" y={y} width="84" height="6" fill={WHITE} opacity="0.9" />
      ))}
    </>
  ),
  railway_pavement: (
    <>
      <text x="50" y="42" textAnchor="middle" fontSize="30" fontWeight="800" fill={WHITE}>
        R
      </text>
      <line x1="18" y1="62" x2="82" y2="62" stroke={WHITE} strokeWidth="5" />
      <line x1="18" y1="76" x2="82" y2="76" stroke={WHITE} strokeWidth="5" />
      <line x1="30" y1="54" x2="30" y2="84" stroke={WHITE} strokeWidth="4" />
      <line x1="70" y1="54" x2="70" y2="84" stroke={WHITE} strokeWidth="4" />
    </>
  ),
  pavement_arrow: <UpArrow />,
};

/**
 * Which drawing represents this marking. Every art but one is static and
 * comes straight from the table above; `pavement_speed_limit` is the sole
 * reason this is a function rather than the table itself, since its content
 * is the number the level actually posts, not a fixed shape.
 */
const markingArt = (art: RoadMarkingArt, glyph?: string): ReactNode =>
  art === 'pavement_speed_limit' ? (
    <text x="50" y="66" textAnchor="middle" fontSize="42" fontWeight="800" fill={WHITE}>
      {glyph ?? '60'}
    </text>
  ) : (
    STATIC_MARKING_ART[art]
  );

/**
 * `compact` is the driving view: the picture and the name, nothing else — the
 * same trade SignPlateCard makes, for the same reason.
 */
const MarkingPlateCard = ({
  marking,
  compact = false,
}: {
  marking: MarkingPlate;
  compact?: boolean;
}) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5">
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-neutral-800 ${
        compact ? 'h-[76px] w-[76px]' : 'h-[104px] w-[104px]'
      }`}
    >
      {marking.image ? (
        <img
          src={`/${marking.image}`}
          alt={marking.name}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <Road>{markingArt(marking.art, marking.glyph)}</Road>
      )}
    </div>

    <div className="min-w-0 flex-1">
      {!compact && (
        <p className="font-display text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          {marking.category}
        </p>
      )}
      <p className={`text-sm font-black leading-tight text-foreground ${compact ? '' : 'mt-0.5'}`}>
        {marking.name}
      </p>
      {!compact && (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{marking.meaning}</p>
      )}
    </div>
  </div>
);

export default MarkingPlateCard;
