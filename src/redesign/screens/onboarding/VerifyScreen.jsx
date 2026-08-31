// Step 2 — SMS code (Figma 2670:11964).
//
// Where the flow forks. A verified number that already belongs to somebody is a
// RETURNING player on a new phone, so their account is adopted and they go
// straight to roll call — asking them to pick a name again would fork their
// identity, which is the exact bug the uid-keyed model exists to prevent. A
// number new to us continues to the name step.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import CodeInput from '../../components/CodeInput';
import OnboardingLayout from '../../components/OnboardingLayout';
import { splitName } from '../../../utils/helpers';
import { updateCurrentUser } from '../../identity/useCurrentUser';
import { authActions, updateJoinFlow, useJoinFlow } from '../../state/joinFlow';

// "(718) 555-0134" — for reading back the number we just texted. Local because
// this is the only screen that shows one; promote it if the profile ever does.
function formatPhoneUS(e164) {
  const d = (e164 || '').replace(/\D/g, '').replace(/^1/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (e164 || '');
}

export default function VerifyScreen() {
  const navigate = useNavigate();
  const flow = useJoinFlow();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  // Reachable directly by URL for review, but a real attempt needs a number to
  // have been sent to — without one there is nothing to confirm.
  useEffect(() => {
    if (!flow.e164) navigate('/create-account', { replace: true });
  }, [flow.e164, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const { e164, account } = await authActions.confirmCode(code);
      if (account) {
        // Adopt the existing account rather than starting a second one.
        const { firstName, lastName, needsLastName } = splitName(account.name);
        updateCurrentUser({ uid: account.uid, phone: e164, firstName, lastName });
        updateJoinFlow({ e164, firstName, lastName });
        // A one-word name on the old roster (Elle, Shimon) leaves them without
        // the last name the redesign requires, so they get the name step once —
        // with their first name already filled — instead of going straight in.
        navigate(needsLastName ? '/create-account/name' : '/', { replace: true });
        return;
      }
      updateJoinFlow({ e164 });
      navigate('/create-account/name');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setResent(false);
    try {
      await authActions.sendCode(flow.rawPhone);
      setCode('');
      setResent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <OnboardingLayout>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}>
        <h1 className="type-heading-h1" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
          Create account
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%' }}>
          <p className="type-body-regular" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
            Enter the code sent to{' '}
            <strong style={{ fontWeight: 'var(--font-weight-semibold)' }}>{formatPhoneUS(flow.e164)}</strong>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <CodeInput value={code} onChange={setCode} error={error} disabled={busy} autoFocus />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              <Button
                label={busy ? 'Verifying…' : 'Verify & create account'}
                variant="primary"
                type="submit"
                disabled={busy || code.length < 6}
                hug
              />
              <p className="type-body-regular" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
                {resent ? 'Sent — check your messages.' : 'Not seeing the code? '}
                {!resent && (
                  <button
                    type="button"
                    onClick={resend}
                    className="type-body-bold"
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      color: 'var(--color-dark-gray)', textDecoration: 'underline',
                      font: 'inherit', fontWeight: 'var(--font-weight-bold)',
                    }}
                  >
                    Try again
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>
      </form>
    </OnboardingLayout>
  );
}
