/**
 * The player's vehicle skin (2026-11-19): chosen on the profile page, or by
 * the study's "preferred vehicle" question, and kept on the account and the
 * device.
 *
 * Like the language: the account's choice wins once its profile is read, and
 * a choice made in this session outranks the profile as it was read at
 * sign-in, which does not hear of it. The session's choice is held here, in
 * one place, so every screen (the profile page, the drive) sees it at once.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_VEHICLE_SKIN, type VehicleSkin } from '@/shared/lib/vehicleSkin';
import { authDeps } from './dependencies';
import { useAuthSession } from './useAuthSession';

interface Chosen {
  /** The account it was chosen for; null for a guest. */
  uid: string | null;
  skin: VehicleSkin;
}

let chosen: Chosen | null = null;
let device: VehicleSkin | null | undefined;
const listeners = new Set<() => void>();

const deviceSkin = (): VehicleSkin | null => {
  if (device === undefined) {
    try {
      device = authDeps().deviceVehicleSkin?.load() ?? null;
    } catch {
      device = null;
    }
  }
  return device;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => chosen;

/**
 * Sets the skin: on this device, and on the account when there is one. Resolves
 * once the account's copy is saved; a failed save leaves the choice in place
 * for this session and device.
 */
export const chooseVehicleSkin = async (uid: string | null, skin: VehicleSkin): Promise<void> => {
  chosen = { uid, skin };
  device = skin;
  listeners.forEach(listener => listener());
  try {
    authDeps().deviceVehicleSkin?.save(skin);
  } catch {
    // No device storage: the session still has it.
  }
  if (uid) await authDeps().userProfiles.saveVehicleSkin(uid, skin);
};

/** For tests: forgets the session's choice and the device's cached one. */
export const resetVehicleSkinForTests = () => {
  chosen = null;
  device = undefined;
};

export const useVehicleSkin = (): { skin: VehicleSkin; choose: (skin: VehicleSkin) => Promise<void> } => {
  const { user, profile, profileLoaded, loading } = useAuthSession();
  const uid = user?.uid ?? null;
  const session = useSyncExternalStore(subscribe, snapshot, snapshot);

  const account = !loading && uid && profileLoaded ? (session?.uid === uid ? session.skin : profile?.vehicleSkin ?? null) : null;
  const guest = !uid && session?.uid === null ? session.skin : null;
  const skin = account ?? guest ?? deviceSkin() ?? DEFAULT_VEHICLE_SKIN;

  const choose = useCallback((next: VehicleSkin) => chooseVehicleSkin(uid, next), [uid]);
  return { skin, choose };
};
