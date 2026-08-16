// Text input — the shared field component (Figma 2666:7754), built for reuse by
// the edit-profile and account-creation screens.
//
// Four states, driven by props rather than a `state` enum so callers can't get
// them out of sync with reality:
//   default   → Tan border
//   focused   → Dark Gray border + soft glow (tracked internally on focus)
//   error     → Red border + message (pass `error`); outranks focus
//   disabled  → grey fill, muted text
//
// Optional 24px left icon, and an optional up/down chevron on the right for the
// select-style fields (e.g. the "+1" country code).
//
// Three deviations from the Figma export, which carries UI-kit defaults rather
// than brand tokens — worth revisiting if the kit is the intended source:
//   · helper/error text specced in Inter → uses our Plus Jakarta Sans
//   · error text #E53333 → our Red token (#D80505), which the border already uses
//   · helper text #737373 → our Dark Gray 50%

import { useId, useState } from 'react';
import chevronIcon from '../assets/icons/chevron-updown.svg';

const labelStyle = {
  fontFamily: 'var(--font-family-base)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize: 14,
  lineHeight: 'normal',
  color: 'var(--color-dark-gray)',
  // Labels stay on one line and may overhang a narrow control — the "+1" field
  // is only 84px wide but still reads "Phone number" (Figma 3233:12569).
  whiteSpace: 'nowrap',
};

const noteStyle = {
  fontFamily: 'var(--font-family-base)',
  fontWeight: 'var(--font-weight-regular)',
  fontSize: 12,
  lineHeight: 'normal',
};

export default function InputField({
  label,
  value,
  onChange,
  placeholder,
  error,          // string → error state + message beneath
  helper,         // string → hint beneath (hidden while an error shows)
  disabled = false,
  leftIcon,
  chevron = false,
  readOnly = false,
  type = 'text',
  inputMode,
  autoComplete,
  name,
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  const borderColor =
    disabled ? 'var(--color-dark-gray-25)'
    : error ? 'var(--color-red)'
    : focused ? 'var(--color-dark-gray)'
    : 'var(--color-tan)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {label && <label htmlFor={id} style={labelStyle}>{label}</label>}

      <div
        style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: 16,
          borderRadius: 16, border: `2px solid ${borderColor}`,
          background: disabled ? '#F5F5F5' : 'var(--color-white)',
          // Focus glow from the design; suppressed once the field is in error.
          boxShadow: focused && !error && !disabled ? '0 0 4px rgba(79, 70, 229, 0.2)' : 'none',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flex: '1 0 0', gap: 12, alignItems: 'center', minWidth: 0 }}>
          {leftIcon && <img src={leftIcon} alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />}
          <input
            id={id}
            name={name}
            type={type}
            inputMode={inputMode}
            autoComplete={autoComplete}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            onChange={(e) => onChange?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-invalid={!!error}
            className="type-body-regular-tall"
            style={{
              flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none',
              background: 'transparent', padding: 0,
              color: disabled ? 'var(--color-dark-gray-50)' : 'var(--color-dark-gray)',
            }}
          />
        </div>

        {chevron && (
          // 24px box with the glyph at its true 9.6×15.2 — the export carries
          // preserveAspectRatio="none", so a square box would distort it.
          <span style={{ position: 'relative', display: 'block', width: 24, height: 24, flexShrink: 0 }}>
            <img
              src={chevronIcon}
              alt=""
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 9.645, height: 15.246, display: 'block', maxWidth: 'none',
              }}
            />
          </span>
        )}
      </div>

      {error
        ? <p style={{ ...noteStyle, color: 'var(--color-red)' }}>{error}</p>
        : helper ? <p style={{ ...noteStyle, color: 'var(--color-dark-gray-50)' }}>{helper}</p>
        : null}
    </div>
  );
}
