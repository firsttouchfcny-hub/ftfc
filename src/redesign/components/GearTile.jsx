// Gear tile — a 48px Cream circle holding a gear icon, with a 32px Cream/Tan
// "+" button overlapping 8px below. From Figma "Gear Assignment" (2760:14167).
// Later states: the "+" becomes the taker's avatar (taken) or a lock (balls-gate).

import plusIcon from '../assets/icons/plus.svg';

export default function GearTile({ icon, label, onAdd }) {
  return (
    <div style={{ width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* gear icon circle (48px), pulled -8px so the button overlaps it */}
      <div
        style={{
          width: 48, height: 48, borderRadius: 1000, background: 'var(--color-cream)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
          marginBottom: -8, position: 'relative', zIndex: 1,
        }}
      >
        <img src={icon} alt={label} style={{ width: 24, height: 24, objectFit: 'cover' }} />
      </div>

      {/* add button (32px), overlaps the circle above */}
      <button
        onClick={onAdd}
        aria-label={`Take ${label}`}
        title={`Take ${label}`}
        style={{
          width: 32, height: 32, borderRadius: 1000, background: 'var(--color-cream)',
          border: '1px solid var(--color-tan)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', position: 'relative', zIndex: 2,
        }}
      >
        <span style={{ position: 'relative', display: 'block', width: 20, height: 20, overflow: 'hidden' }}>
          <img
            src={plusIcon}
            alt=""
            style={{
              position: 'absolute', left: '50%', top: '50%', width: 12.1, height: 12.1,
              transform: 'translate(-50%, -50%)', display: 'block', maxWidth: 'none',
            }}
          />
        </span>
      </button>
    </div>
  );
}
