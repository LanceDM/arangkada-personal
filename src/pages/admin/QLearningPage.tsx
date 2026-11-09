/**
 * `/admin/q-learning`: the Q-learning mapping. The address holds the choice, so
 * a view can be reloaded or linked to: `?view=table|participant|pool`, and
 * `&code=P02` for one Optimized participant's choices.
 */
import { useSearchParams } from 'react-router-dom';

import { QMappingSection, useQMapping, type QMappingSelection } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const VIEWS: ReadonlyArray<QMappingSelection['view']> = ['table', 'participant', 'pool'];

const QLearningPage = () => {
  const { isAdmin } = useAuthSession();
  const [params, setParams] = useSearchParams();
  const asked = params.get('view') as QMappingSelection['view'] | null;
  const view = asked && VIEWS.includes(asked) ? asked : 'table';
  const select = ({ view, code }: QMappingSelection) => {
    const next = new URLSearchParams({ view });
    if (view === 'participant' && code) next.set('code', code);
    setParams(next);
  };
  const q = useQMapping(isAdmin, { view, code: view === 'participant' ? params.get('code') : null }, select);
  return <QMappingSection q={q} />;
};

export default QLearningPage;
