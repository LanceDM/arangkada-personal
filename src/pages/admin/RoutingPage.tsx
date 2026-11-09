/**
 * `/admin/routing`: the routing FSM's flow. The address holds the choice, so a
 * view can be reloaded or linked to: `?view=machine|participant|pool`, and
 * `&code=P02` for one participant's path.
 */
import { useSearchParams } from 'react-router-dom';

import { RoutingFlowSection, useRoutingFlow, type RoutingFlowSelection } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const VIEWS: ReadonlyArray<RoutingFlowSelection['view']> = ['machine', 'participant', 'pool'];

const RoutingPage = () => {
  const { isAdmin } = useAuthSession();
  const [params, setParams] = useSearchParams();
  const asked = params.get('view') as RoutingFlowSelection['view'] | null;
  const view = asked && VIEWS.includes(asked) ? asked : 'machine';
  const select = ({ view, code }: RoutingFlowSelection) => {
    const next = new URLSearchParams({ view });
    if (view === 'participant' && code) next.set('code', code);
    setParams(next);
  };
  const flow = useRoutingFlow(isAdmin, { view, code: view === 'participant' ? params.get('code') : null }, select);
  return <RoutingFlowSection flow={flow} />;
};

export default RoutingPage;
