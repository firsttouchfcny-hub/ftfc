// Fab — the large rounded sign-up action button. From Figma component 2705:8216.
//   primary   → Dark Gray fill, Cream text
//   secondary → Cream fill, 2px Tan border, Dark Gray text
// (Distinct from PillButton, which is the smaller scaffold pill.)

const VARIANTS = {
  primary:   { background: 'var(--color-dark-gray)', color: 'var(--color-cream)', border: 'none' },
  secondary: { background: 'var(--color-cream)', color: 'var(--color-dark-gray)', border: '2px solid var(--color-tan)' },
};

export default function Fab({ label, onClick, variant = 'primary', disabled, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Tells a screen reader the press was received and is in flight, which is
      // the whole point of the state.
      aria-busy={busy || undefined}
      className="type-body-bold"
      style={{
        width: 132, minHeight: 90, padding: 16, borderRadius: 100,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 150ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...VARIANTS[variant],
      }}
    >
      {label}
    </button>
  );
}
