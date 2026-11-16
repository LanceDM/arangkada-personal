import { describe, expect, it } from 'vitest';
import { composeSingleScenario } from './composeDrive';
import { holderOnPlate, withOnePlate } from './garagePlate';
import type { GarageHotspot } from './scenarioDefinition';

const point = (over: Partial<GarageHotspot>): GarageHotspot =>
  ({ id: 'p', label: '', area: '', x: 0, y: 0, observation: '', question: '', choices: [], correctAction: 'stop', points: 1, penaltyMessage: '', rewardMessage: '', ...over }) as GarageHotspot;

describe('one car, one plate', () => {
  it('draws the car with the plate the registration check reads, and names it on the papers', () => {
    const papers = point({ id: 'documents', document: { officerLine: '', documentType: '', holder: 'XYZ 8821 — Honda Civic', fields: [], vehicle: '', tripPurpose: '' } });
    const stage = withOnePlate({ plate: 'ABC 1435', intro: '', hotspots: [papers, point({ id: 'plate', plate: 'GHK 5508' })] });
    expect(stage.plate).toBe('GHK 5508');
    // The content keeps its words (a translation is checked against them); the screen swaps the plate.
    expect(stage.hotspots[0].document?.holder).toBe('XYZ 8821 — Honda Civic');
    expect(holderOnPlate('XYZ 8821 — Honda Civic', stage.plate)).toBe('GHK 5508 — Honda Civic');
    expect(holderOnPlate('Juan Dela Cruz', stage.plate)).toBe('Juan Dela Cruz');
  });

  it('keeps the stage plate when no point is about the plate', () => {
    expect(withOnePlate({ plate: 'ABC 1435', intro: '', hotspots: [point({})] }).plate).toBe('ABC 1435');
  });

  it('plays a composed Level 2 plate check on the car it asks about', () => {
    const garage = composeSingleScenario(2, 'level2.garage.plate.2')!.level.garage!;
    expect(garage.plate).toBe('XYZ 8829');
  });
});
