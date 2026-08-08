// StatusBadge — the #DAD8CA rounded badge with centered bold text (Figma's
// "Timer badge"). Reused for the roll-call countdown (hug width, single line)
// and the suspension message (fixed `width`, text wraps).

export default function StatusBadge({ children, width }) {
  return (
    <div
      style={{
        minHeight: 90, width, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 32px', borderRadius: 24, background: '#DAD8CA', overflow: 'hidden',
      }}
    >
      <span
        className="type-body-bold"
        style={{ color: 'var(--color-dark-gray)', textAlign: 'center', whiteSpace: width ? 'normal' : 'nowrap' }}
      >
        {children}
      </span>
    </div>
  );
}
