// Modal dialog — the app's one confirmation pattern (Figma 3155:9399).
//
// A black 20% scrim covers the app and blocks interaction until the dialog is
// actioned. The card sits 20px from each side and 40px from the bottom of the
// viewport, inside the same 430px column as the rest of the app.
//
// Content: an optional 48px icon and an optional headline sit above the body
// copy — at least one of the two is required, so a dialog is never just loose
// text.
//
// Buttons take three shapes, chosen by what you pass rather than a layout flag:
//   · confirm only                → a single primary (an acknowledgement)
//   · confirm + cancel            → a side-by-side pair
//   · confirm + secondary + cancel → stacked full-width, cancel as tertiary
// Stacking is not a style choice: two real options plus a way out don't fit
// across one row, and their labels are sentences rather than words.
//
// Dismissing (Escape, or tapping the scrim) runs the cancel action, falling back
// to the confirm action for single-button dialogs — so the dialog can always be
// closed without a trap.

import { useEffect, useId, useRef } from 'react';
import Button from './Button';

export default function Dialog({
  open,
  icon,
  headline,
  body,
  content,          // raw node in place of headline/body, for laid-out content
                    // (the gear dialogs read as one sentence with inline chips,
                    // which can't live inside a <p>)
  confirmLabel,
  onConfirm,
  confirmVariant = 'primary',
  secondaryLabel,   // a second real choice → switches the buttons to stacked
  onSecondary,
  cancelLabel,
  onCancel,
}) {
  const headlineId = useId();
  const cardRef = useRef(null);

  // Single-button dialogs have nothing to decline; dismissing them is the same
  // as acknowledging.
  const hasCancel = !!(cancelLabel && onCancel);
  const hasSecondary = !!(secondaryLabel && onSecondary);
  const dismiss = hasCancel ? onCancel : onConfirm;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') dismiss?.(); };
    document.addEventListener('keydown', onKeyDown);
    // Freeze the page behind the dialog so it can't be scrolled while blocked.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismiss]);

  if (!open) return null;

  if (import.meta.env.DEV && !icon && !headline && !content) {
    console.warn('[Dialog] needs an icon, a headline, or content — see Figma 3155:9399.');
  }

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0, 0, 0, 0.2)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {/* Keeps the card in the app's centered column at wide viewports */}
      <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', padding: '0 20px 40px' }}>
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headline ? headlineId : undefined}
          // Clicks inside the card must not reach the scrim's dismiss handler.
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-cream)', borderRadius: 24, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%',
            filter: 'drop-shadow(0px 2px 20px rgba(0, 0, 0, 0.1))',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', width: '100%', color: 'var(--color-dark-gray)' }}>
            {icon && <img src={icon} alt="" style={{ width: 48, height: 48, display: 'block', flexShrink: 0 }} />}
            {headline && (
              <h2 id={headlineId} style={{ fontFamily: 'var(--font-family-base)', fontWeight: 'var(--font-weight-bold)', fontSize: 24, lineHeight: 'normal', margin: 0 }}>
                {headline}
              </h2>
            )}
            {body && <p className="type-body-regular-tall" style={{ margin: 0 }}>{body}</p>}
            {content}
          </div>

          {hasSecondary ? (
            // Stacked: primary first, then the alternative, then the way out.
            // Cancel is tertiary because it is only the dismissal made visible —
            // the same action as tapping the scrim or pressing Escape.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              <Button label={confirmLabel} variant="primary" onClick={onConfirm} autoFocus hug />
              <Button label={secondaryLabel} variant="secondary" onClick={onSecondary} hug />
              {hasCancel && <Button label={cancelLabel} variant="tertiary" onClick={onCancel} hug />}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', width: '100%' }}>
              {hasCancel && <Button label={cancelLabel} onClick={onCancel} />}
              <Button label={confirmLabel} variant={confirmVariant} onClick={onConfirm} autoFocus />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
