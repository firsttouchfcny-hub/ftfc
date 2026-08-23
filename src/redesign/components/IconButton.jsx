// Circular icon button (Figma 2754:3164): two sizes (sm 32px / md 40px), five
// states. The glyph is passed as children so each caller keeps its own icon
// geometry — the button only owns the circle and its states.
//
// The disabled state doubles as the gear tile's balls-gate "locked" look, so a
// locked tile is literally this button, disabled.

export default function IconButton({
  size = 'sm', onClick, disabled, label, title, children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className={`rd-icon-btn rd-icon-btn--${size}`}
    >
      {children}
    </button>
  );
}
