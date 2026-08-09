// TableCard — the Cream card that wraps a roster table. From Figma "Table"
// (2730:10544): Cream bg, 1px Tan border, 20px radius, 20px/8px padding. The
// horizontal padding is 8px (not 16) — the other 8px lives in each padded row,
// so the "You" highlight can sit inset from the card edge. The Match table
// (Match 1 + Match 2) and the Bench each get their own card.

export default function TableCard({ children }) {
  return (
    <div
      style={{
        width: '100%',
        background: 'var(--color-cream)',
        border: '1px solid var(--color-tan)',
        borderRadius: 20,
        padding: '20px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {children}
    </div>
  );
}
