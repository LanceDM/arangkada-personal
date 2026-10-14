import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmNewPassword } from '@/features/auth';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = params.get('oobCode');    // Firebase puts this in the URL
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    try {
      await confirmNewPassword(oobCode, password);
      setDone(true);
      setTimeout(() => navigate('/'), 2000);
    } catch {
      setError('Link expired or invalid. Request a new one.');
    }
  };

  if (!oobCode) return <p>Invalid link.</p>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
        <h1 className="font-display text-lg font-bold">Set new password</h1>
        {done ? (
          <p className="text-sm text-accent">Password updated! Redirecting...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-display font-bold rounded-xl">
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;