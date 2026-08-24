// Six-box verification code entry (Figma 2670:11973).
//
// Six copies of the shared field's box — white, 2px Tan, radius 16, 16px padding
// — which lands each box at the same 56px height as the button below it. They
// share the row with `flex: 1` and a 4px gap, so the group fits any width.
//
// Kept as its own component rather than six InputFields because the behaviour is
// the point: typing advances, backspace retreats, and a pasted code fills the
// whole row. A code you have to tab through by hand is the classic way this
// pattern gets built badly.

import { useId, useRef } from 'react';

const LENGTH = 6;

export default function CodeInput({ value, onChange, error, disabled = false, autoFocus = false }) {
  const groupId = useId();
  const refs = useRef([]);

  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');
  const focus = (i) => refs.current[i]?.focus();

  // Write one box and hand focus on. Everything is derived from `value`, so the
  // boxes can never disagree with the code that gets submitted.
  const setDigit = (i, digit) => {
    const next = digits.map((d, n) => (n === i ? (digit || ' ') : d)).join('').trimEnd();
    onChange(next);
    if (digit && i < LENGTH - 1) focus(i + 1);
  };

  const handleChange = (i) => (e) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (!typed) return setDigit(i, '');
    // A whole code landing in one box means it was pasted or auto-filled.
    if (typed.length > 1) {
      onChange(typed.slice(0, LENGTH));
      focus(Math.min(typed.length, LENGTH - 1));
      return;
    }
    setDigit(i, typed);
  };

  const handleKeyDown = (i) => (e) => {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      // Nothing here to delete, so step back and clear that one instead —
      // otherwise backspace strands you on an empty box.
      e.preventDefault();
      setDigit(i - 1, '');
      focus(i - 1);
    }
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); focus(i - 1); }
    if (e.key === 'ArrowRight' && i < LENGTH - 1) { e.preventDefault(); focus(i + 1); }
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        role="group"
        aria-labelledby={groupId}
        aria-invalid={!!error}
        style={{ display: 'flex', gap: 4, alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d.trim()}
            onChange={handleChange(i)}
            onKeyDown={handleKeyDown(i)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            inputMode="numeric"
            // Lets iOS and Android offer the SMS code straight from the keyboard.
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoFocus={autoFocus && i === 0}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            className="type-body-regular-tall"
            style={{
              flex: '1 0 0', minWidth: 0, textAlign: 'center',
              padding: 16, borderRadius: 16,
              border: `2px solid ${error ? 'var(--color-red)' : 'var(--color-tan)'}`,
              background: disabled ? '#F5F5F5' : 'var(--color-white)',
              color: 'var(--color-dark-gray)', outline: 'none',
              // Caret hidden: the box IS the cursor here, and a blinking bar
              // next to a centred digit reads as a second character.
              caretColor: 'transparent',
            }}
          />
        ))}
      </div>
      {error && (
        <p style={{
          fontFamily: 'var(--font-family-base)', fontWeight: 'var(--font-weight-regular)',
          fontSize: 12, lineHeight: 'normal', color: 'var(--color-red)', margin: '6px 0 0',
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
