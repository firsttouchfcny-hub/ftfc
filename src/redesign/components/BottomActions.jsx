// Floating action bar for the "You're in" screen (Figma 3024:5347).
// Two equal 56px pills — secondary "Add a +1" (Cream + Tan border) and primary
// "Out" (Dark Gray) — pinned 32px above the bottom of the viewport.
//
// Scroll behavior: the bar slides down out of view while scrolling down and
// slides back up on scroll up, so it never covers the roster you're reading.
// It always shows near the top of the page.

import { useEffect, useRef, useState } from 'react';
import Button from './Button';

// Don't start hiding until the user is meaningfully down the page, and ignore
// jitter smaller than this (rubber-banding, trackpad noise).
const REVEAL_ABOVE = 80;
const JITTER = 6;

export default function BottomActions({
  onAddPlusOne, onOut, addDisabled, outDisabled, outDisabledReason,
}) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < JITTER) return;   // ignore jitter, keep lastY steady
      if (y < REVEAL_ABOVE) setHidden(false);
      else setHidden(dy > 0);              // down → hide, up → show
      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 32, zIndex: 30,
        maxWidth: 430, margin: '0 auto', padding: '0 32px',
        pointerEvents: 'none', // only the buttons themselves take clicks
        // Slide fully clear of the viewport (own height + the 32px offset).
        transform: hidden ? 'translateY(calc(100% + 32px))' : 'translateY(0)',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div
        style={{
          display: 'flex', gap: 12, alignItems: 'stretch', pointerEvents: 'auto',
          // Shadow follows the pill silhouettes rather than boxing the row.
          filter: 'drop-shadow(0px 2px 20px rgba(0, 0, 0, 0.1))',
        }}
      >
        <Button label="Add a +1" onClick={onAddPlusOne} disabled={addDisabled} />
        <Button
          label="Out"
          variant="primary"
          onClick={onOut}
          disabled={outDisabled}
          title={outDisabledReason}
        />
      </div>
    </div>
  );
}
