/** The vehicle skin chosen on this device: one localStorage key, for guests and a quick first paint. */
import { isVehicleSkin } from '@/shared/lib/vehicleSkin';
import type { DeviceVehicleSkinRepository } from '@/features/auth/application/ports';

const STORAGE_KEY = 'arangkada_vehicle_skin';

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const localDeviceVehicleSkinRepository: DeviceVehicleSkinRepository = {
  load() {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return isVehicleSkin(raw) ? raw : null;
    } catch {
      return null;
    }
  },

  save(skin) {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, skin);
    } catch {
      // Storage blocked: the choice lasts no longer than this page.
    }
  },
};
