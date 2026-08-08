// Account creation — standalone flow (no top nav), reached for new users.
// Skeleton represents the multi-step onboarding; a real flow wires the steps.

import { useNavigate } from 'react-router-dom';
import Scaffold from '../components/Scaffold';
import PillButton from '../components/PillButton';

export default function CreateAccountScreen() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-light-olive)', fontFamily: 'var(--font-family-base)', color: 'var(--color-dark-gray)' }}>
      <div style={{ maxWidth: 430, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '32px 20px 0' }}>
          <div style={{ fontSize: 40 }}>⚽</div>
        </div>
        <Scaffold
          title="Create account"
          blurb="Standalone onboarding — no top nav here."
          planned={[
            'Step 1 — phone number (+ country code)',
            'Step 2 — SMS verification code',
            'Step 3 — first & last name',
            'Step 4 — profile photo (selfie / upload / skip → initials)',
          ]}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            <PillButton variant="primary" onClick={() => navigate('/')}>Finish → Home</PillButton>
          </div>
        </Scaffold>
      </div>
    </div>
  );
}
