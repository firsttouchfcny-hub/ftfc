// Home — "open" variant (roll call open to everyone, 3pm+): game details, the
// I'm in / I'm in +1 sign-up buttons, and the lineup facepile.
// Built from Figma node 2699:13198. The admin early-signup window shows this
// same screen.
//
// Signing up is the one moment in the app where the answer genuinely matters
// and genuinely might not arrive: 6:50 AM, one bar of signal, and the question
// is whether you're in the game. So it says all three things — that the press
// was received, that it's still going, and that it failed if it did.
//
// Production only says the first two. On failure the error goes to the console,
// the buttons quietly re-enable, and the player is left to work out from an
// unchanged list whether it worked.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GameHeader from '../../components/GameHeader';
import Fab from '../../components/Fab';
import LineupPeek from '../../components/LineupPeek';

export default function HomeOpen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // `?signup=failed` / `?signup=offline` preview the two ways it goes wrong.
  // Nothing is actually written yet — the join is wired with the data layer.
  const preview = params.get('signup');
  const [pending, setPending] = useState(null);   // which button is in flight
  const [failed, setFailed] = useState(preview === 'failed' || preview === 'offline');

  const join = (plusOnes) => {
    if (pending !== null) return;
    setFailed(false);
    setPending(plusOnes);
    // Stands in for the write. The preview params make it fail on purpose so
    // the state can be reviewed; otherwise it goes through.
    setTimeout(() => {
      if (preview === 'failed' || preview === 'offline') {
        setPending(null);
        setFailed(true);
        return;
      }
      navigate('/game');
    }, 600);
  };

  // Offline gets different words for the same reason the couldn't-load state
  // does: "try again" is useless advice with no signal.
  const offline = preview === 'offline' || navigator.onLine === false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', padding: '64px 24px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
        <GameHeader />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
          {/* Button group */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
            <Fab
              label={pending === 1 ? 'Signing in…' : 'I’m in +1'}
              variant="secondary"
              disabled={pending !== null}
              busy={pending === 1}
              onClick={() => join(1)}
            />
            <Fab
              label={pending === 0 ? 'Signing in…' : 'I’m in'}
              variant="primary"
              disabled={pending !== null}
              busy={pending === 0}
              onClick={() => join(0)}
            />
          </div>

          {/* Directly under the buttons, because the button is what you tap to
              fix it. role="alert" so it's announced rather than silently added. */}
          {failed && (
            <p
              role="alert"
              className="type-small-regular"
              style={{ margin: 0, textAlign: 'center', color: 'var(--color-red)' }}
            >
              {offline
                ? 'You’re offline — check your connection and tap again.'
                : 'Couldn’t sign you up. Tap to try again.'}
            </p>
          )}
        </div>

        {/* Who's already in, before you decide to join. */}
        <LineupPeek />
      </div>
    </div>
  );
}
