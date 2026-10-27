import { LEVELS } from '@/features/driving-sim';

import type { RuleSummary } from './adminReport';

export const buildRuleSummaries = (): RuleSummary[] => {
  const summaries = new Map<string, RuleSummary>();

  for (const level of LEVELS) {
    for (const event of level.events) {
      const id = `R-${event.type.toUpperCase().replace(/_/g, '-')}-${event.correctAction.toUpperCase()}`;
      const current = summaries.get(id);

      if (current) {
        current.fires += 1;
        current.totalPoints += event.points;
        if (!current.levelIds.includes(level.id)) current.levelIds.push(level.id);
        if (!current.lawCitation && event.lawCitation) current.lawCitation = event.lawCitation;
      } else {
        summaries.set(id, {
          id,
          type: event.type,
          expectedAction: event.correctAction,
          levelIds: [level.id],
          fires: 1,
          totalPoints: event.points,
          lawCitation: event.lawCitation,
        });
      }
    }
  }

  return Array.from(summaries.values()).sort((a, b) => a.id.localeCompare(b.id));
};
