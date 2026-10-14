import { X } from 'lucide-react';
import AuthForm from './AuthForm';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
  defaultView?: 'login' | 'register';
  reason?: string;        // "Save your progress" / "Sign in to continue"
}

const AuthModal = ({ isOpen, onSuccess, onClose, defaultView = 'login', reason }: AuthModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="p-6 space-y-4">
          {reason && (
            <p className="text-sm text-muted-foreground text-center">{reason}</p>
          )}
          <AuthForm
            defaultView={defaultView}
            onSuccess={onSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default AuthModal;