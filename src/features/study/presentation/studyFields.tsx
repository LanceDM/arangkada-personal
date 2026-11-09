import { useState, type ReactNode } from 'react';
import { Eye, EyeOff, Gauge } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { LanguageSwitch } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { studyMessages as m } from './messages';

export const FIELD =
  'w-full px-4 py-3 rounded-xl bg-background border border-border text-lg text-foreground placeholder:text-muted-foreground/50 placeholder:text-base focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all';

/** The card every study page sits in, with the language switch on every one. */
export const StudyCard = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
    <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-clip">
      <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <span className="w-20" aria-hidden />
          <div className="flex items-center justify-center gap-2">
            <Gauge className="w-6 h-6 text-primary" />
            <span className="font-display text-xl font-bold tracking-wider">
              ARANG<span className="text-primary">KADA</span>
            </span>
          </div>
          <LanguageSwitch className="w-20 justify-end" />
        </div>
        {children}
      </div>
    </div>
  </div>
);

export const Field = ({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/** A password field with a show button. Paste and password managers are welcome. */
export const PasswordInput = ({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'new-password' | 'current-password';
}) => {
  const [shown, setShown] = useState(false);
  const text = useText();
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className={`${FIELD} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShown(v => !v)}
        aria-label={text(shown ? m.hidePassword : m.showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {shown ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
};

export const ErrorNote = ({ message }: { message: Localized | null }) => {
  const text = useText();
  return message ? (
    <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
      {text(message)}
    </p>
  ) : null;
};

export const SubmitButton = ({ busy, children }: { busy: boolean; children: ReactNode }) => (
  <Button type="submit" size="lg" className="w-full h-14 font-display font-bold text-base" disabled={busy}>
    {busy ? (
      <span className="flex items-center gap-2">
        <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
        …
      </span>
    ) : (
      children
    )}
  </Button>
);

export const InviteInput = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <input
    id="study-invite"
    name="study-invite"
    type="text"
    value={value}
    onChange={e => onChange(e.target.value.toUpperCase())}
    placeholder="7K3Q9-X2MT4"
    autoComplete="off"
    autoCorrect="off"
    autoCapitalize="characters"
    spellCheck={false}
    maxLength={14}
    className={`${FIELD} font-display font-bold tracking-[0.2em]`}
  />
);
