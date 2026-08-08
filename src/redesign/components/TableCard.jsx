// TableCard — the Cream card that wraps a roster table. From Figma "Table"
// (2730:10544): Cream bg, 1px Tan border, 20px radius, 16px/20px padding.
// The Match table (Match 1 + Match 2) and the Bench each get their own card.

export default function TableCard({ children }) {
  return (
    <div
      style={{
        width: '100%',
        background: 'var(--color-cream)',
        border: '1px solid var(--color-tan)',
        borderRadius: 20,
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {children}
    </div>
  );
}
