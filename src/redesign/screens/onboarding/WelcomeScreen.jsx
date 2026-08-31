// Step 5 — welcome (Figma 2699:12982).
//
// The last thing the flow does is commit everything it collected to the identity
// seam, so the roll-call screen behind it already knows who you are. No badge
// here and no button in the frame: the screen is a beat, not a decision.
//
// 🎨 Two illustration variants exist (2699:12982 / 2699:13013); this is the
// first, chosen deliberately — swapping it is a one-line change.
//
// Since the design shows no CTA, it moves on by itself after a moment. Tapping
// anywhere skips the wait, so nobody is held on a screen they've finished
// reading. Worth a look in review — an auto-advance is an invention, however
// small, and the alternative is adding a button the frame doesn't have.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/OnboardingLayout';
import { updateCurrentUser } from '../../identity/useCurrentUser';
import { resetJoinFlow, useJoinFlow } from '../../state/joinFlow';
import illustration from '../../assets/welcome-illustration.svg';

const DWELL_MS = 2600;

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const flow = useJoinFlow();

  useEffect(() => {
    // The account is real from here on: everything the flow gathered lands on
    // the identity seam in one write.
    updateCurrentUser({
      firstName: flow.firstName,
      lastName: flow.lastName,
      photoURL: flow.photoURL,
      phone: flow.e164,
    });
    // Deliberately once, on arrival — re-running on every flow change would
    // re-commit after the reset below and resurrect the cleared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const go = () => { resetJoinFlow(); navigate('/', { replace: true }); };
    const t = setTimeout(go, DWELL_MS);
    return () => clearTimeout(t);
  }, [navigate]);

  const skip = () => { resetJoinFlow(); navigate('/', { replace: true }); };

  return (
    <OnboardingLayout badge={false}>
      <button
        type="button"
        onClick={skip}
        aria-label="Continue to roll call"
        style={{
          flex: '1 0 0', width: '100%', border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: 32,
          alignItems: 'center', justifyContent: 'center', padding: 0,
          color: 'var(--color-dark-gray)',
        }}
      >
        {/* The export carries preserveAspectRatio="none", so both dimensions are
            set explicitly at their designed size rather than left to scale. */}
        <img src={illustration} alt="" style={{ width: 148, height: 111.566, display: 'block', maxWidth: 'none' }} />
        <span
          style={{
            fontFamily: 'var(--font-family-base)',
            fontWeight: 'var(--font-weight-medium)',
            fontSize: 'var(--font-size-h2)',
            lineHeight: 'normal',
            textAlign: 'center',
          }}
        >
          Welcome to the club{flow.firstName ? ` ${flow.firstName}` : ''}
        </span>
      </button>
    </OnboardingLayout>
  );
}
