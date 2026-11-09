/**
 * `/admin/replay`: one attempt as it was recorded. The address holds the
 * choice, so a replay can be reloaded or linked to: `?code=P01&attempt=…` for
 * a pilot pool account, `?view=players&player=<account id>&attempt=…` for any
 * other signed-in player.
 */
import { useSearchParams } from 'react-router-dom';

import { ReplaySection, useAttemptReplay, type ReplaySelection } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const ReplayPage = () => {
  const { isAdmin } = useAuthSession();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'players' ? 'players' : 'pilot';
  const select = ({ view, code, player, attemptId }: ReplaySelection) => {
    const next = new URLSearchParams();
    const account = view === 'players' ? player : code;
    if (view === 'players') next.set('view', 'players');
    if (account) next.set(view === 'players' ? 'player' : 'code', account);
    if (account && attemptId) next.set('attempt', attemptId);
    setParams(next);
  };
  const replay = useAttemptReplay(
    isAdmin,
    {
      view,
      code: view === 'pilot' ? params.get('code') : null,
      player: view === 'players' ? params.get('player') : null,
      attemptId: params.get('attempt'),
    },
    select
  );
  return <ReplaySection replay={replay} />;
};

export default ReplayPage;
