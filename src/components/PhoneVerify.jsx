import { useState, useRef, useEffect } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { normalizeName } from '../utils/helpers';

const RECAPTCHA_ID = 'ftfc-recaptcha-container';

// Accepts 10-digit US or 11-digit with leading 1. Returns E.164 or null.
function toE164US(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export default function PhoneVerify({ playerName, onClose, onVerified }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef(null);
  const recaptchaRef = useRef(null);

  useEffect(() => () => {
    if (recaptchaRef.current) {
      try { recaptchaRef.current.clear(); } catch { /* noop */ }
      recaptchaRef.current = null;
    }
  }, []);

  const resetRecaptcha = () => {
    if (recaptchaRef.current) {
      try { recaptchaRef.current.clear(); } catch { /* noop */ }
      recaptchaRef.current = null;
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    const e164 = toE164US(phone);
    if (!e164) {
      setError('Enter a 10-digit US phone number.');
      return;
    }

    setBusy(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, RECAPTCHA_ID, {
          size: 'invisible',
        });
      }
      confirmRef.current = await signInWithPhoneNumber(auth, e164, recaptchaRef.current);
      setStep('code');
    } catch (err) {
      console.error('[FTFC] signInWithPhoneNumber failed:', err);
      const msg = err.code === 'auth/invalid-phone-number'
        ? 'That phone number is invalid.'
        : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : err.code === 'auth/operation-not-allowed'
            ? 'Phone sign-in is not enabled in Firebase. Enable it in the console.'
            : 'Could not send the code. Try again.';
      setError(`${msg}  [${err.code || 'unknown'}]`);
      resetRecaptcha();
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Code is 6 digits.');
      return;
    }
    if (!confirmRef.current) {
      setError('Verification expired. Start over.');
      setStep('phone');
      return;
    }

    setBusy(true);
    try {
      await confirmRef.current.confirm(code);
      const e164 = toE164US(phone);
      // merge so it works whether or not a profile doc already exists
      await setDoc(doc(db, 'players', normalizeName(playerName)), {
        name: playerName,
        phoneVerified: true,
        phone: e164,
        phoneVerifiedAt: Date.now(),
      }, { merge: true });
      // We only used Firebase Auth to verify ownership of the number — no need to keep the session.
      try { await signOut(auth); } catch { /* noop */ }
      onVerified?.();
      onClose?.();
    } catch (err) {
      console.error('[FTFC] confirm failed:', err);
      const msg = err.code === 'auth/invalid-verification-code'
        ? 'Wrong code. Try again.'
        : err.code === 'auth/code-expired'
          ? 'Code expired. Send a new one.'
          : 'Could not verify the code.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-icon-wrap">📱</div>
        <h2 className="modal-title">
          {step === 'phone' ? 'Verify your phone' : 'Enter the code'}
        </h2>
        <p className="modal-subtitle">
          {step === 'phone'
            ? "We'll text a 6-digit code to confirm it's you."
            : `Code sent to ${phone}.`}
        </p>

        {step === 'phone' ? (
          <form onSubmit={handleSendCode}>
            <input
              className="form-input"
              type="tel"
              inputMode="numeric"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              autoFocus
              disabled={busy}
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmCode}>
            <input
              className="form-input"
              type="tel"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              autoFocus
              disabled={busy}
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={() => { setStep('phone'); setCode(''); setError(''); resetRecaptcha(); }}
              style={{ marginTop: 8 }}
              disabled={busy}
            >
              Change number
            </button>
          </form>
        )}

        <button
          type="button"
          className="btn btn-ghost btn-full"
          onClick={onClose}
          style={{ marginTop: 8 }}
          disabled={busy}
        >
          Cancel
        </button>

        <div id={RECAPTCHA_ID}></div>

        <p className="modal-note">
          We use your number only to confirm you're a real human. Standard SMS rates may apply.
        </p>
      </div>
    </div>
  );
}
