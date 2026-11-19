import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideAuthDependencies, type AuthDependencies } from './dependencies';
import { chooseVehicleSkin, resetVehicleSkinForTests } from './vehicleSkin';

const wire = () => {
  const saveVehicleSkin = vi.fn(async () => {});
  const save = vi.fn();
  provideAuthDependencies({
    auth: {} as AuthDependencies['auth'],
    userProfiles: { get: async () => null, saveLanguage: async () => {}, saveTermsAcceptance: async () => {}, saveVehicleSkin },
    deviceLanguage: { load: () => null, save: () => {} },
    deviceVehicleSkin: { load: () => null, save },
  });
  return { saveVehicleSkin, save };
};

afterEach(resetVehicleSkinForTests);

describe('choosing a vehicle skin (2026-11-19)', () => {
  it('keeps it on the device and on the account', async () => {
    const { saveVehicleSkin, save } = wire();
    await chooseVehicleSkin('u1', 'motorcycle');
    expect(save).toHaveBeenCalledWith('motorcycle');
    expect(saveVehicleSkin).toHaveBeenCalledWith('u1', 'motorcycle');
  });

  it("keeps a guest's on the device alone", async () => {
    const { saveVehicleSkin, save } = wire();
    await chooseVehicleSkin(null, 'car');
    expect(save).toHaveBeenCalledWith('car');
    expect(saveVehicleSkin).not.toHaveBeenCalled();
  });
});
