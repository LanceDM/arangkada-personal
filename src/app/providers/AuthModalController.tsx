/**
 * The global sign-in prompt, driven by the `useAuthModal` store so any screen
 * can ask for it without threading props. Mounted exactly once, inside the
 * router, so anywhere that opens the store's modal opens this instance.
 */
import { AuthModal, useAuthModal } from '@/features/auth';

export const AuthModalController = () => {
  const { isOpen, reason, defaultView, onSuccess, close } = useAuthModal();

  return (
    <AuthModal
      isOpen={isOpen}
      reason={reason}
      defaultView={defaultView}
      onSuccess={() => {
        onSuccess?.();
        close();
      }}
      onClose={close}
    />
  );
};
