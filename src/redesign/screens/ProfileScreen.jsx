// Profile — reached from the nav avatar, which switches to the back variant
// here (see TopNav). Built from Figma 3159:9458.
//
// The header is vertically centred in the viewport: a 200px avatar with a camera
// button overlapping its lower-right, then name + phone, then "Edit profile".
// With no photo uploaded it falls back to the initials avatar.
//
// Carried over from production: you can change your phone number (which
// re-triggers verification) and your name. New here: the profile photo.
// Deliberately NOT on this screen — gear commitments live on the Gear surface,
// and the suspension banner lives on the roll-call screen, matching production.

import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import { useCurrentUser, updateCurrentUser } from '../identity/useCurrentUser';
import cameraIcon from '../assets/icons/camera.svg';

const AVATAR = 200;

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// "+15555550100" → "(555) 555-0100" for display.
function formatPhone(e164) {
  const d = (e164 || '').replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length !== 10) return e164 || '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export default function ProfileScreen() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fileRef = useRef(null);

  // `?photo=none` forces the initials fallback so that state stays reviewable.
  const photoURL = params.get('photo') === 'none' ? null : user.photoURL;

  // Object URLs we minted, so the previous one can be released on replace. Not
  // revoked on unmount — the photo lives on in the shared user, and revoking
  // would blank the nav avatar and the roster row.
  const objectUrl = useRef(null);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      // Write through the identity seam so the nav avatar and the roster's
      // "you" row pick it up too, not just this screen.
      updateCurrentUser({ photoURL: url });
    }
    e.target.value = ''; // let the same file be picked again
  };

  return (
    // Fills the space under the sticky nav so the header can centre in the page.
    <div style={{ minHeight: 'calc(100dvh - 92px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%', maxWidth: 358, padding: '0 24px', boxSizing: 'border-box' }}>
        {/* Avatar + camera button */}
        <div style={{ position: 'relative', width: AVATAR, height: AVATAR, flexShrink: 0 }}>
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', objectFit: 'cover', mixBlendMode: 'luminosity', display: 'block' }}
            />
          ) : (
            <div style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', background: 'var(--color-tan)', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-family-base)', fontWeight: 'var(--font-weight-semibold)', fontSize: 72, lineHeight: 1, color: 'var(--color-dark-gray)' }}>
                {initialsOf(user.displayName)}
              </span>
            </div>
          )}

          {/* Sits on the circle's lower-right diagonal, 8px inside its box */}
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile photo"
            style={{
              position: 'absolute', left: 152, top: 152, width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-cream)', border: '1px solid var(--color-tan)',
              borderRadius: 1000, cursor: 'pointer',
              filter: 'drop-shadow(0px 2px 3.5px rgba(0, 0, 0, 0.08))',
            }}
          >
            {/* 24px icon box with the leaf inset by Figma's 12.5%/8.33% — which
                lands it at the asset's true 20×18. The export carries
                preserveAspectRatio="none", so forcing it to 24×24 would stretch
                it 1.2× wide and 1.33× tall. */}
            <span style={{ position: 'relative', display: 'block', width: 24, height: 24, flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '12.5%', right: '8.33%', bottom: '12.5%', left: '8.33%' }}>
                <img
                  src={cameraIcon}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', maxWidth: 'none' }}
                />
              </span>
            </span>
          </button>

          {/* No `capture` attribute on purpose: that would force the camera.
              Plain accept="image/*" lets the OS offer Take Photo / Photo Library. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            style={{ display: 'none' }}
          />
        </div>

        {/* Name + phone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center', width: '100%' }}>
          <h1 className="type-heading-h2" style={{ color: 'var(--color-dark-gray)' }}>{user.displayName}</h1>
          <p className="type-body-regular" style={{ color: 'var(--color-dark-gray-90)' }}>{formatPhone(user.phone)}</p>
        </div>

        <Button label="Edit profile" hug onClick={() => navigate('/profile/edit')} />
      </div>
    </div>
  );
}
