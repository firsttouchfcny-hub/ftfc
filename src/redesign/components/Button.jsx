// The pill button from Figma (2673:7973): three types × five states.
//
//   primary   — Dark Gray fill, Cream label
//   secondary — Cream fill, Tan border
//   tertiary  — no fill or border until hovered/pressed
//
// Classes are namespaced `rd-` because index.css already owns .btn globally.
// Hover, pressed, focus and disabled live in redesign/styles.css, because
// pseudo-classes can't be expressed inline — and doing hover in JS would miss
// keyboard focus, which is the state that matters most for accessibility.
//
// Buttons fill their row by default (flex: 1 0 0), since the action bar and the
// side-by-side dialog both lay them out as an equal-width set. Pass `hug` for a
// standalone button that should size to its label instead.

export default function Button({
  label, variant = 'secondary', onClick, disabled, title, autoFocus, hug = false,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      autoFocus={autoFocus}
      className={`rd-btn rd-btn-${variant} type-body-bold`}
      style={{ flex: hug ? '0 0 auto' : '1 0 0', minWidth: 0 }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}
