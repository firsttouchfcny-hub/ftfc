// Step 4 — profile photo, empty and filled (Figma 2670:12560 / 2699:12884).
//
// One screen, two states: an empty 248px Tan circle with Selfie / Upload / Skip,
// and the same circle carrying the chosen photo with a single Continue.
//
// Selfie and Upload are the same file input; the difference is `capture`, which
// asks a phone for the front camera and is simply ignored on a desktop browser.
// Skipping is a real choice, not a lesser one — the roster's initials fallback
// is already built, so a photo-less player looks deliberate rather than broken.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import OnboardingLayout from '../../components/OnboardingLayout';
import { updateJoinFlow, useJoinFlow } from '../../state/joinFlow';

const AVATAR = 248;

export default function PhotoScreen() {
  const navigate = useNavigate();
  const flow = useJoinFlow();
  const [photoURL, setPhotoURL] = useState(flow.photoURL);
  const fileRef = useRef(null);
  const captureRef = useRef(false);

  // An object URL is a live handle to the file; revoke it when this screen goes
  // away so the blob isn't held for the rest of the session.
  useEffect(() => () => { if (photoURL?.startsWith('blob:')) URL.revokeObjectURL(photoURL); }, [photoURL]);

  const pick = (selfie) => {
    captureRef.current = selfie;
    if (fileRef.current) {
      // `capture` has to be set before the dialog opens, not at render — the
      // same input serves both buttons.
      if (selfie) fileRef.current.setAttribute('capture', 'user');
      else fileRef.current.removeAttribute('capture');
      fileRef.current.click();
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoURL(URL.createObjectURL(file));
    // Let the same file be chosen twice in a row.
    e.target.value = '';
  };

  const finish = (url) => {
    updateJoinFlow({ photoURL: url });
    navigate('/create-account/welcome');
  };

  return (
    <OnboardingLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
        <h1 className="type-heading-h1" style={{ margin: 0, textAlign: 'center', width: '100%' }}>
          Add a profile pic
        </h1>

        <div
          style={{
            width: AVATAR, height: AVATAR, borderRadius: '50%', flexShrink: 0,
            background: 'var(--color-tan)', overflow: 'hidden',
          }}
        >
          {photoURL && (
            <img
              src={photoURL}
              alt="Your profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          style={{ display: 'none' }}
          aria-hidden="true"
          tabIndex={-1}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
          {photoURL ? (
            <>
              <Button label="Continue" variant="primary" onClick={() => finish(photoURL)} hug />
              <Button label="Choose a different photo" variant="tertiary" onClick={() => pick(false)} hug />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', width: '100%' }}>
                <Button label="Selfie" variant="secondary" onClick={() => pick(true)} />
                <Button label="Upload" variant="primary" onClick={() => pick(false)} />
              </div>
              <Button label="Skip" variant="tertiary" onClick={() => finish(null)} hug />
            </>
          )}
        </div>
      </div>
    </OnboardingLayout>
  );
}
