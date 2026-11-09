import { create } from 'zustand';
import type { AuthView } from '@/features/auth/domain/credentials';

interface AuthModalStore {
  isOpen: boolean;
  reason: string;
  defaultView: AuthView;
  onSuccess?: () => void;
  open: (opts?: { reason?: string; defaultView?: AuthView; onSuccess?: () => void }) => void;
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