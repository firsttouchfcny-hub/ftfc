// Step 3 — first & last name (Figma 2670:12326).
//
// Both names are required: the club's rule is that one-word names aren't
// allowed, and edit-profile enforces the same thing. This screen is therefore
// also where a RETURNING player with a one-word name on the old roster (Elle,
// Shimon) is sent to supply the missing half — the same form, arriving with the
// first name already filled. That's why the headline and helper adapt rather
// than a second screen existing.
//
// 🎨 The Figma frame labels the first field "Frist name" — a typo, corrected
// here, exactly as edit-profile already does.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import OnboardingLayout from '../../components/OnboardingLayout';
import { updateCurrentUser } from '../../identity/useCurrentUser';
import { updateJoinFlow, useJoinFlow } from '../../state/joinFlow';

export default function NameScreen() {
  const navigate = useNavigate();
  const flow = useJoinFlow();
  const [firstName, setFirstName] = useState(flow.firstName);
  const [lastName, setLastName] = useState(flow.lastName);
  const [errors, setErrors] = useState({});

  // Arriving with a first name already set means we're completing an existing
  // account, not creating one.
  const completing = !!flow.firstName;

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!firstName.trim()) next.firstName = 'Enter your first name.';
    if (!lastName.trim()) next.lastName = 'Enter your last name.';
    setErrors(next);
    if (Object.keys(next).length) return;

    updateJoinFlow({ firstName: firstName.trim(), lastName: lastName.trim() });
    if (completing) {
      // Nothing left to collect — they already have a photo and an account.
      updateCurrentUser({ firstName: firstName.trim(), lastName: lastName.trim() });
      navigate('/', { replace: true });
      return;
    }
    navigate('/create-account/photo');
  };

  return (
    <OnboardingLayout>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}>
        <h1 className="type-heading-h1" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
          {completing ? 'Add your last name' : 'Add your name'}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {/* Each field is wrapped as an explicit flex item. InputField is
              width:100% by design (it's normally the only thing in its row), so
              two of them side by side each ask for the full width and overflow
              the page. `flex: 1 1 0` replaces that basis with an equal share. */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <InputField
                label="First name"
                placeholder="Mikey"
                value={firstName}
                onChange={setFirstName}
                error={errors.firstName}
                autoComplete="given-name"
                name="firstName"
              />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <InputField
                label="Last name"
                placeholder="Colver"
                value={lastName}
                onChange={setLastName}
                error={errors.lastName}
                autoComplete="family-name"
                name="lastName"
              />
            </div>
          </div>
          <Button label={completing ? 'Save' : 'Next'} variant="primary" type="submit" hug />
        </div>
      </form>
    </OnboardingLayout>
  );
}
