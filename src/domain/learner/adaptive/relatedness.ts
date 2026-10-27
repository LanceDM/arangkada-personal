// Which competencies reinforce each other, and how much that claim is worth.
//
// This exists for one decision: the learner is weak at X, but X has no usable
// practice content available in the level they are about to play. What is the
// next most useful thing to give them?
//
// Every edge below is derived from the curriculum's Traceability Matrix,
// which is the project's canonical educational design document. A row there
// assigning one official LTO topic to two different levels is a statement that
// the same knowledge is deliberately reinforced in both places - which is
// exactly the transfer relationship this map needs. Nothing here is inferred
// from vibes, from the level's prose, or from which competencies happen to
// share a level file.
//
// That last exclusion is deliberate and cost this map most of its size. Mere
// co-occurrence within one level is a much weaker signal than it looks: Level 2
// alone touches six competencies and Level 3 touches six more, so "appears in
// the same file" would wire almost everything to almost everything and the map
// would stop discriminating. A level containing two competencies means the
// level is broad, not that the two competencies teach each other.
//
// The map is therefore small, and two competencies (`road_signs`,
// `speed_control`) have no edges at all. That is a finding rather than a gap:
// the curriculum assigns their topics to a single level each and never asks them
// to interleave with anything else.

import type { DrivingCompetency } from '@/domain/learner/competency';

/**
 * How much confidence an edge carries, which is what decides the order the
 * selector tries them in.
 *
 * `primary` - the curriculum links the two topics across levels AND both
 * competencies genuinely appear on real tagged content, so the relationship is
 * confirmed in the code as well as in the design document.
 *
 * `fallback` - the curriculum links the topics across levels, but the two levels
 * label their content with different competencies, so the link is real
 * curriculum intent that the event tags do not independently corroborate.
 * Used only when nothing better is available (per the project decision to
 * include these rather than drop the curriculum's stated intent, but never to
 * let them outrank a confirmed edge).
 */
export type RelatednessTier = 'primary' | 'fallback';

interface RelatednessEdge {
  a: DrivingCompetency;
  b: DrivingCompetency;
  tier: RelatednessTier;
  /** The curriculum's Traceability Matrix row this edge comes from. */
  source: string;
}

const EDGES: RelatednessEdge[] = [
  // Both competencies are tagged on real content in the levels the row names,
  // and they additionally co-occur inside Level 6 - a driver reading a
  // no-parking marking and a driver choosing a lawful parking space are acting
  // on the same rule from two directions.
  {
    a: 'lane_discipline',
    b: 'parking',
    tier: 'primary',
    source: 'Yellow box, loading/unloading, no-parking markings -> Levels 4, 6',
  },
  // Level 1 tags both, on the same checkpoint documents: whether the licence
  // authorises this trip and whether the paperwork for it is in order are the
  // same inspection asked twice.
  {
    a: 'driver_legality',
    b: 'document_awareness',
    tier: 'primary',
    source: 'Student permit / licence types + validity and renewal -> Levels 1, 12',
  },

  // Curriculum links the topic across Levels 3 and 5, but Level 5 tags its
  // junction events `right_of_way`, never `traffic_signals` - the signal is
  // what tells you who has priority, so reading it and acting on it are split
  // across two levels and two tags.
  {
    a: 'traffic_signals',
    b: 'right_of_way',
    tier: 'fallback',
    source: 'Traffic lights and signals -> Levels 3, 5',
  },
  // Level 8 handles the ambulance as a hazard to be predicted rather than a
  // priority rule to be obeyed, so it never carries the `right_of_way` tag
  // Level 5 uses for the same encounter.
  {
    a: 'right_of_way',
    b: 'hazard_awareness',
    tier: 'fallback',
    source: 'Emergency vehicle right-of-way -> Levels 5, 8',
  },
  // Level 4 approaches the crossing as paint to be positioned against and tags
  // it `lane_discipline`; Levels 5 and 8 approach it as people to be yielded to
  // and tag it `pedestrians`. Same crossing, opposite ends of the same rule.
  {
    a: 'pedestrians',
    b: 'lane_discipline',
    tier: 'fallback',
    source: 'Pedestrian, PWD, and children crossing awareness -> Levels 4, 5, 8',
  },
  {
    a: 'driver_legality',
    b: 'general_rules',
    tier: 'fallback',
    source: 'Driver responsibilities and license as privilege -> Levels 1, 8, 12',
  },
  {
    a: 'document_awareness',
    b: 'general_rules',
    tier: 'fallback',
    source: 'OR/CR, plates, RFID, registration schedule -> Levels 2, 12',
  },
];

/**
 * Competencies related to `competency`, most trustworthy first: every `primary`
 * edge before any `fallback` one. The competency itself is never included -
 * callers try it directly before ever consulting this map.
 */
export const relatedCompetencies = (competency: DrivingCompetency): DrivingCompetency[] => {
  const matches = (tier: RelatednessTier) =>
    EDGES.filter(edge => edge.tier === tier)
      .flatMap(edge =>
        edge.a === competency ? [edge.b] : edge.b === competency ? [edge.a] : []
      );

  return [...new Set([...matches('primary'), ...matches('fallback')])];
};

/** The curriculum rows backing a competency's edges, for tracing a decision back to the syllabus. */