// Pill button matching the Figma sign-up buttons (dark = primary, light = secondary).

const VARIANTS = {
  primary:   { background: 'var(--color-dark-gray)', color: 'var(--color-cream)', border: '1px solid var(--color-dark-gray)' },
  secondary: { background: 'var(--color-cream)', color: 'var(--color-dark-gray)', border: '1px solid var(--color-tan)' },
};

export default function PillButton({ children, onClick, variant = 'primary', full = false }) {
  return (
    <button
      onClick={onClick}
      className="type-body-semibold"
      style={{
        padding: '14px 28px', borderRadius: 999, cursor: 'pointer',
        width: full ? '100%' : 'auto', ...VARIANTS[variant],
      }}
    >
      {children}
    </button>
  );
}
