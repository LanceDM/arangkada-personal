/** The language chosen on this device: one localStorage key. */
import { isLanguage } from '@/shared/lib/localized';
import type { DeviceLanguageRepository } from '@/features/auth/application/ports';

const STORAGE_KEY = 'arangkada_language';

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const localDeviceLanguageRepository: DeviceLanguageRepository = {
  load() {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return isLanguage(raw) ? raw : null;
    } catch {
      return null;
    }
  },

  save(language) {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage blocked: the choice lasts no longer than this page.
    }
  },
};
