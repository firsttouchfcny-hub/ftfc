// Step 1 — phone number (Figma 2670:11784).
//
// One field, no country selector.
//
// The Figma frame (2670:11784) pairs the number with a "+1" select carrying a
// chevron. Dropped deliberately: the chevron promises a choice, and every phone
// entry point in the app funnels through `toE164US`, which accepts only the +1
// range — so the picker could never open. A prefix box that can't be changed is
// worse than no box, because it invites the tap that goes nowhere.
//
// `toE164US` already takes a bare 10-digit number and adds the +1 itself, so
// this needs nothing from production. Widening the accepted range is a separate
// product decision, logged in the inventory.

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
          <InputField
            value={phone}
            onChange={setPhone}
            placeholder="Phone number"
            // The placeholder is the only visible cue, and a placeholder is not
            // a label — it vanishes the moment you type.
            ariaLabel="Phone number"
            error={error}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            name="phone"
          />

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
