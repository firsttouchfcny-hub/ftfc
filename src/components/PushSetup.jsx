import { useState } from 'react';
import {
  enableNotifications, isIOS, isStandalone, pushSupported,
} from '../utils/push';

// Small "turn on notifications" control shown to signed-in players.
// Handles the iOS "add to home screen first" case with clear guidance.
export default function PushSetup() {
  const [msg, setMsg]   = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const iosNeedsInstall = isIOS() && !isStandalone();

  // Hide entirely on browsers that can't do web push AND aren't an iPhone we
  // could guide toward installing (e.g. old desktop browsers).
  if (!pushSupported() && !iosNeedsInstall) return null;
  if (done) return null;

  const onClick = async () => {
    setBusy(true);
    const res = await enableNotifications();
    setBusy(false);
    if (res.ok) {
      setMsg('✅ Notifications on! You should see a test banner.');
      setTimeout(() => setDone(true), 4000);
    } else if (res.reason === 'ios-not-installed') {
      setMsg('📲 On iPhone: tap the Share button, choose “Add to Home Screen,” then open FTFC from that icon and tap this again.');
    } else if (res.reason === 'denied') {
      setMsg('Notifications are blocked. Turn them on for this site in your browser settings, then try again.');
    } else {
      setMsg('This browser can’t do notifications.');
    }
  };

  return (
    <div className="push-setup">
      <button className="btn btn-ghost btn-sm" onClick={onClick} disabled={busy}>
        🔔 {busy ? 'Enabling…' : 'Turn on notifications'}
      </button>
      {msg && <p className="push-note">{msg}</p>}
    </div>
  );
}
