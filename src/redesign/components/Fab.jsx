// Fab — the large rounded sign-up action button. From Figma component 2705:8216.
//   primary   → Dark Gray fill, Cream text
//   secondary → Cream fill, 2px Tan border, Dark Gray text
// (Distinct from PillButton, which is the smaller scaffold pill.)

const VARIANTS = {
  primary:   { background: 'var(--color-dark-gray)', color: 'var(--color-cream)', border: 'none' },
  secondary: { background: 'var(--color-cream)', color: 'var(--color-dark-gray)', border: '2px solid var(--color-tan)' },
};

export default function Fab({ label, onClick, variant = 'primary' }) {
  return (
    <button
      onClick={onClick}
      className="type-body-bold"
      style={{
        width: 132, minHeight: 90, padding: 16, borderRadius: 100, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...VARIANTS[variant],
      }}
    >
      {label}
    </button>
  );
}
