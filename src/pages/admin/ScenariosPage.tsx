/** `/admin/scenarios`: every level's road and every scenario's configuration, read from this build's content. */
import { useMemo } from 'react';
import { ScenariosSection } from '@/features/admin';
import { levelConfigRows, scenarioConfigRows } from '@/features/driving-sim';

const ScenariosPage = () => {
  const levels = useMemo(() => levelConfigRows(), []);
  const scenarios = useMemo(() => scenarioConfigRows(), []);
  return <ScenariosSection levels={levels} scenarios={scenarios} />;
};

export default ScenariosPage;
