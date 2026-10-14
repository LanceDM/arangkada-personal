import { create } from 'zustand';

interface AuthModalStore {
  isOpen: boolean;
  reason: string;
  defaultView: 'login' | 'register';
  onSuccess?: () => void;
  open: (opts?: { reason?: string; defaultView?: 'login' | 'register'; onSuccess?: () => void }) => void;
  close: () => void;
}

export const useAuthModal = create<AuthModalStore>((set) => ({
  isOpen: false,
  reason: '',
  defaultView: 'login',
  onSuccess: undefined,

  open: (opts = {}) => set({
    isOpen: true,
    reason: opts.reason ?? '',
    defaultView: opts.defaultView ?? 'login',
    onSuccess: opts.onSuccess,
  }),

  close: () => set({ isOpen: false }),
}));