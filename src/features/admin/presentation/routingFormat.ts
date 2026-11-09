/** How the routing sections name stops, groups, add-ons and the way to an attempt in Replay. */
import { getCompetencyLabel } from '@/domain/learner/profile';
import type { FlowAddOn } from '@/features/admin/domain/routingFlow';

export const GROUP_LABEL: Record<string, string> = { conventional: 'Conventional', optimized: 'Optimized', unassigned: 'Unassigned' };

/** A control state as the card and the list name it: `Level 3`, `Review of Level 2`, `Final Mission`, `Certified`. */
export const stopLabel = (stop: string) => {
  const drive = /^DRIVE\((\d+)\)$/.exec(stop);
  if (drive) return `Level ${drive[1]}`;
  const review = /^REVIEW\((\d+)\)$/.exec(stop);
  if (review) return `Review of Level ${review[1]}`;
  return stop === 'FINAL' ? 'Final Mission' : stop === 'CERTIFIED' ? 'Certified' : stop;
};

export const addOnLabel = (addOn: FlowAddOn | null) =>
  !addOn
    ? 'Nothing'
    : addOn.kind === 'practice'
      ? `Practice: ${getCompetencyLabel(addOn.competency)}`
      : `Review of Level ${addOn.level} for ${getCompetencyLabel(addOn.competency)}`;

/** The Replay of one pool account's attempt. */
export const replayHref = (code: string, attempt: { id: string }) =>
  `/admin/replay?${new URLSearchParams({ code, attempt: attempt.id }).toString()}`;

