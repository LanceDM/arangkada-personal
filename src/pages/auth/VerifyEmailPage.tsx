import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmailCode } from '@/features/auth';

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = params.get('oobCode');
  // A link with no code is already known to be bad on the first render; there
  // is nothing to verify and nothing to wait for.
  const [status, setStatus] = useState<'verifying' | 'done' | 'error'>(
    oobCode ? 'verifying' : 'error'
  );

  useEffect(() => {
    if (!oobCode) return;
    let active = true;
    let redirect: ReturnType<typeof setTimeout>;

    verifyEmailCode(oobCode)
      .then(() => {
        if (!active) return;
        setStatus('done');
        redirect = setTimeout(() => navigate('/play'), 2000);
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      clearTimeout(redirect);
    };
  }, [oobCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        {status === 'verifying' && <p className="font-display">Verifying...</p>}
        {status === 'done' && <p className="font-display text-accent">Email verified! Redirecting...</p>}
        {status === 'error' && <p className="font-display text-destructive">Link expired or invalid.</p>}
      </div>
    </div>
  );
};

export default VerifyEmail;