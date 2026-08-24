// Step 1 — phone number (Figma 2670:11784).
//
// The country code is a fixed "+1" select. It carries the chevron because the
// design shows one, but the club is Brooklyn-only and `toE164US` accepts US
// numbers alone, so offering other countries would promise something the rest
// of the stack can't keep. Read-only until that changes.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import OnboardingLayout from '../../components/OnboardingLayout';
import { authActions, updateJoinFlow, useJoinFlow } from '../../state/joinFlow';

export default function PhoneScreen() {
  const navigate = useNavigate();
  const flow = useJoinFlow();
  const [phone, setPhone] = useState(flow.rawPhone);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const { e164 } = await authActions.sendCode(phone);
      updateJoinFlow({ rawPhone: phone, e164 });
      navigate('/create-account/verify');
    } catch (err) {
      // Every message the seam throws is written to be shown as-is.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingLayout>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}>
        <h1 className="type-heading-h1" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
          Create account
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%' }}>
            <div style={{ width: 84, flexShrink: 0 }}>
              <InputField value="+1" readOnly chevron ariaLabel="Country code" />
            </div>
            <InputField
              value={phone}
              onChange={setPhone}
              placeholder="Phone number"
              error={error}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              name="phone"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <Button
              label={busy ? 'Sending…' : 'Verify & create account'}
              variant="primary"
              type="submit"
              disabled={busy}
              hug
            />
            <p className="type-small-regular" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
              We’ll send you an SMS Verification code
            </p>
          </div>
        </div>
      </form>
    </OnboardingLayout>
  );
}
