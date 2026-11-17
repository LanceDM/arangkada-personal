import type { GarageHotspot } from './scenarioDefinition';

/**
 * The scenario a garage or crash-scene point stands for: its composed variant's
 * id (`level2.garage.tires.1`), else the point's own. The one rule for what a
 * point is counted, logged and marked seen under, so a verdict finds the
 * answer it counted.
 */
export const hotspotScenarioId = (hotspot: Pick<GarageHotspot, 'id' | 'scenarioId'>): string =>
  hotspot.scenarioId ?? hotspot.id;
