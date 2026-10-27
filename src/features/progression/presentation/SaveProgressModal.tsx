import { Gauge, X, LogIn, UserPlus, Shield, Star, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useAuthModal } from '@/features/auth';

interface SaveProgressModalProps {
  totalScore: number;
  completedLevels: number;
  onDismiss: () => void;
}

const SaveProgressModal = ({ totalScore, completedLevels, onDismiss }: SaveProgressModalProps) => {
  const { open } = useAuthModal();
  
  const handleLogin = () => {
    onDismiss();                          // close this modal first
    open({ defaultView: 'login' });       // then open auth modal
  };

  const handleRegister = () => {
    onDismiss();
    open({ defaultView: 'register' });
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onDismiss}/>

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 space-y-5">

          {/* ── PROMPT VIEW ── */}
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 glow-yellow">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold leading-tight">
                    I-SAVE ANG PROGRESS?
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Huwag mawala ang iyong mga nakamit!
                  </p>
                </div>
              </div>

              {/* Stats snapshot */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <div className="font-display text-xl font-bold text-primary">{completedLevels}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Levels Done</div>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <div className="font-display text-xl font-bold text-primary">{totalScore.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total Score</div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                {[
                  { icon: Shield, text: 'Progress mo ay ligtas sa cloud' },
                  { icon: Star, text: 'I-track ang stars at rankings' },
                  { icon: ChevronRight, text: 'Mag-play sa ibang device' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    {text}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-2.5 pt-1">
                <Button
                  size="lg"
                  className="w-full font-display font-bold text-sm glow-yellow"
                  onClick={handleLogin}>
                  <LogIn className="w-4 h-4 mr-2" />
                  MAG-LOGIN
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full font-display font-bold text-sm"
                  onClick={handleRegister}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  GUMAWA NG ACCOUNT
                </Button>
                <button
                  onClick={onDismiss}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                  Ituloy bilang guest — maaaring mawala ang progress
                </button>
              </div>
        </div>
      </div>
    </div>
  );
};

export default SaveProgressModal;
