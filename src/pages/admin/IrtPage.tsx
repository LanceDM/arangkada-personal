/**
 * `/admin/irt`: the Rasch model. The address holds the
 * view, so it can be reloaded or linked to: `?view=bank|calibration|design|results`.
 * Review sheets saved here carry this admin's id.
 */
import { useSearchParams } from 'react-router-dom';

import { IrtSection, useIrtPanel, type IrtView } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const VIEWS: readonly IrtView[] = ['bank', 'calibration', 'design', 'results'];

const IrtPage = () => {
  const { isAdmin, user } = useAuthSession();
  const [params, setParams] = useSearchParams();
  const asked = params.get('view') as IrtView | null;
  const view = asked && VIEWS.includes(asked) ? asked : 'bank';
  const irt = useIrtPanel(isAdmin, user?.uid ?? null);
  return <IrtSection irt={irt} view={view} onView={next => setParams(new URLSearchParams({ view: next }))} />;
};

export default IrtPage;
