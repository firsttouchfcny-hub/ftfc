// The primary/secondary pill button from Figma (2673:7954 / 2673:7964): 56px
// tall, 24px radius, bold 16px label. Shared by the floating action bar and the
// dialog, which use the identical component in the design.
//
// Buttons default to filling their row (flex: 1 0 0) because the action bar and
// the dialog both lay them out in an equal-width set. Pass `hug` for a standalone
// button that should size to its label instead (e.g. "Edit profile").

export default function Button({
  label, variant = 'secondary', onClick, disabled, title, autoFocus, hug = false,
}) {
  const primary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      autoFocus={autoFocus}
      style={{
        flex: hug ? '0 0 auto' : '1 0 0', minWidth: 0, height: 56, padding: 16, borderRadius: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: primary ? 'var(--color-dark-gray)' : 'var(--color-cream)',
        // The primary carries a TRANSPARENT border so both buttons stay exactly
        // equal: with flex-basis 0 a border is added on top of the basis, so a
        // bordered secondary would otherwise end up 2px wider.
        border: primary ? '1px solid transparent' : '1px solid var(--color-tan)',
        color: primary ? 'var(--color-cream)' : 'var(--color-dark-gray)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      <span className="type-body-bold" style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}
