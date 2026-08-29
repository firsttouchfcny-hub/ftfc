// What to show when data doesn't arrive.
//
// The alternative — and what production does today — is to wait five or six
// seconds, give up, and render a default: "roll call is not open", "no gear".
// Those are presented as facts, so a player on a bad connection is confidently
// told the game is closed when it isn't. Saying we couldn't load is both honest
// and more useful, because it names an action they can take.
//
// Offline is the same component with different words, not a separate design.
// The distinction matters to the reader: "reload" is useless advice with no
// signal, and "check your connection" is insulting when the connection is fine.
//
// Two sizes:
//   · section — fills the slot the content would have occupied, leaving the
//     rest of the page usable. A failed gear ledger shouldn't take the roster
//     down with it.
//   · page    — for when nothing can be trusted, e.g. the session itself failed,
//     so we don't even know whether roll call is open.

import { useEffect, useState } from 'react';
import Button from './Button';
import warningIcon from '../assets/icons/warning.svg';

// Tracks the browser's own idea of connectivity. It can be wrong in one
// direction — online-but-unreachable — which is exactly why the copy still
// offers a reload rather than insisting the connection is the problem.
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

export default function CouldNotLoad({
  what = 'this',        // "the roster", "gear" — named so a partial failure is legible
  variant = 'section',  // 'section' | 'page'
  offline: offlineProp, // preview override; otherwise the browser decides
  onReload = () => window.location.reload(),
}) {
  const detected = useOnline();
  const offline = offlineProp ?? !detected;
  const isPage = variant === 'page';

  const headline = offline ? 'You’re offline' : `Couldn’t load ${what}`;
  const body = offline
    ? 'Check your connection, then reload the page.'
    : 'Reload the page to try again.';

  return (
    <div
      role="alert"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: 12, width: '100%',
        padding: isPage ? '64px 24px' : '32px 16px',
        color: 'var(--color-dark-gray)',
      }}
    >
      <img src={warningIcon} alt="" style={{ width: isPage ? 48 : 32, height: isPage ? 48 : 32, display: 'block' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <span className={isPage ? 'type-heading-h2' : 'type-body-bold'}>{headline}</span>
        <span className="type-body-regular" style={{ color: 'var(--color-dark-gray-90)' }}>{body}</span>
      </div>
      {/* Sized to its label rather than the full width — this is a way out of a
          dead end, not the screen's main action. */}
      <Button label="Reload" variant="secondary" onClick={onReload} hug />
    </div>
  );
}
