// A bottom sheet (Figma 3647:22988).
//
// Distinct from Dialog: a dialog asks a question and is dismissed by answering
// it, so it sizes to its content. A sheet presents something to read, so it
// takes a fixed share of the screen and scrolls inside itself — and the way out
// is a close button rather than a choice.
//
// Shares Dialog's manners, because they're the same manners: Escape and a tap
// on the scrim both close it, and the page behind is frozen so it can't be
// scrolled while covered.

import { useEffect, useId } from 'react';
import closeIcon from '../assets/icons/close.svg';

export default function BottomSheet({ open, title, onClose, children }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0, 0, 0, 0.2)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {/* Keeps the sheet in the app's centred column at wide viewports */}
      <div style={{ width: '100%', maxWidth: 430, margin: '0 auto' }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
          className="rd-sheet-in"
          style={{
            background: 'var(--color-light-olive)',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: '24px 20px',
            display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center',
            // Leaves the top of the page visible, so it reads as a layer over
            // the screen rather than a new one.
            maxHeight: '85dvh',
            filter: 'drop-shadow(0px 2px 20px rgba(0, 0, 0, 0.1))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'var(--color-cream)', border: 'none', borderRadius: 9999,
                padding: 8, display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <img src={closeIcon} alt="" style={{ width: 24, height: 24, display: 'block' }} />
            </button>

            <h2 id={titleId} className="type-heading-h2" style={{ flex: '1 0 0', minWidth: 0, margin: 0, textAlign: 'center' }}>
              {title}
            </h2>

            {/* Mirrors the close button's width so the title stays optically
                centred, exactly as the frame does it. */}
            <span aria-hidden style={{ width: 40, flexShrink: 0 }} />
          </div>

          <div style={{ width: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
