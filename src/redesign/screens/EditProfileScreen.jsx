// Edit profile — first name, last name, phone number. From Figma 3233:12478.
//
// Both names are required: clearing one and saving puts that field into the
// error state rather than silently dropping it.
//
// Changing the number re-triggers phone verification, exactly as production
// does today (PhoneVerify). The redesign's OTP screen belongs to the
// account-creation flow and isn't built yet, so `needsVerification` below marks
// the hand-off point rather than inventing that screen here.
//
// Note: the Figma labels read "Frist name" and "Phonen number" — typos, so the
// correct spellings are used.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import InputField from '../components/InputField';
import { useCurrentUser, updateCurrentUser } from '../identity/useCurrentUser';

// "+15555550100" → "555-555-0100" for the editable field (the +1 lives in its
// own control, matching the design).
function toLocalDigits(e164) {
  const d = (e164 || '').replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length !== 10) return ten;
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
}

const digitsOnly = (s) => (s || '').replace(/\D/g, '');

export default function EditProfileScreen() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [phone, setPhone] = useState(toLocalDigits(user.phone));
  const [errors, setErrors] = useState({});

  const originalPhone = digitsOnly(user.phone).slice(-10);
  const phoneChanged = digitsOnly(phone) !== originalPhone;

  const handleSave = () => {
    const next = {};
    if (!firstName.trim()) next.firstName = 'First name is required';
    if (!lastName.trim()) next.lastName = 'Last name is required';
    if (digitsOnly(phone).length !== 10) next.phone = 'Enter a 10-digit phone number';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Names save immediately. The number is deliberately NOT written here: in
    // production a new number only takes effect once it's verified, so writing
    // it now would show an unverified number as if it were confirmed.
    updateCurrentUser({ firstName: firstName.trim(), lastName: lastName.trim() });

    // TODO: route to the OTP step once the account-creation flow is built, and
    // write the number on success. Stubbing that screen here would invent
    // undesigned UI, so for now a changed number simply isn't applied.
    navigate('/profile');
  };

  return (
    // Fills the space under the sticky nav so Save can sit at the bottom.
    <div style={{ minHeight: 'calc(100dvh - 92px)', display: 'flex', flexDirection: 'column', padding: '40px 24px', boxSizing: 'border-box' }}>
      <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}>
        <h1 className="type-heading-h1" style={{ color: 'var(--color-dark-gray)', textAlign: 'center', width: '100%' }}>
          Edit profile
        </h1>

        {/* Fields at the top, Save pushed to the bottom */}
        <div style={{ flex: '1 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <InputField
              label="First name"
              name="given-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(v) => { setFirstName(v); setErrors((e) => ({ ...e, firstName: undefined })); }}
              error={errors.firstName}
            />
            <InputField
              label="Last name"
              name="family-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(v) => { setLastName(v); setErrors((e) => ({ ...e, lastName: undefined })); }}
              error={errors.lastName}
            />

            {/* Country code + number share a row, bottom-aligned so the labelled
                and unlabelled fields line up. */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', width: '100%' }}>
              <div style={{ width: 84, flexShrink: 0 }}>
                <InputField label="Phone number" value="+1" readOnly chevron />
              </div>
              <div style={{ flex: '1 0 0', minWidth: 0 }}>
                <InputField
                  value={phone}
                  onChange={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: undefined })); }}
                  placeholder="000-000-0000"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  error={errors.phone}
                  helper={phoneChanged ? 'You’ll need to verify this number' : undefined}
                />
              </div>
            </div>
          </div>

          {/* `hug` keeps it 56px tall: the default flex:1 would grow it down the
              column's main axis. It still spans the width via align-stretch. */}
          <Button label="Save" variant="primary" onClick={handleSave} hug />
        </div>
      </div>
    </div>
  );
}
