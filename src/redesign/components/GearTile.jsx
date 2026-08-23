// Gear tile — a 48px Cream circle holding a gear icon, with a 32px control
// overlapping 8px below. From Figma "Gear Assignment" (2760:14167).
//
// Two states so far:
//   · free  → a "+" button that opens the take-home dialog
//   · taken → the taker's avatar in its place (2756:2786), reusing the same
//             avatar as the roster rows: their photo, or their initials
//
// A taken set isn't offered again, so that state is not a button — but it names
// who has it, so the row still answers "who's covering this?" at a glance.
// Still to come: the balls-gate lock, none-left, and the "yours" variant.

import PlayerAvatar from './PlayerAvatar';
import plusIcon from '../assets/icons/plus.svg';

export default function GearTile({ icon, label, onAdd, takenBy }) {
  return (
    <div style={{ width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* gear icon circle (48px), pulled -8px so the button overlaps it */}
      <div
        style={{
          width: 48, height: 48, borderRadius: 1000, background: 'var(--color-cream)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
          marginBottom: -8, position: 'relative',
        }}
      >
        <img src={icon} alt={label} style={{ width: 24, height: 24, objectFit: 'cover' }} />
      </div>

      {/* taken → the taker's avatar sits where the "+" would be */}
      {takenBy ? (
        <div
          title={`${takenBy.name} is taking ${label} home`}
          aria-label={`${takenBy.name} is taking ${label} home`}
          // No z-index: it would create a stacking context, which isolates the
          // avatar's luminosity blend and leaves the photo in full colour while
          // every other avatar in the app is desaturated. DOM order is enough —
          // this sits after the gear circle and both are positioned.
          style={{ position: 'relative' }}
        >
          <PlayerAvatar name={takenBy.name} photoURL={takenBy.photoURL} />
        </div>
      ) : (
      /* free → add button (32px), overlaps the circle above */
      <button
        onClick={onAdd}
        aria-label={`Take ${label}`}
        title={`Take ${label}`}
        style={{
          width: 32, height: 32, borderRadius: 1000, background: 'var(--color-cream)',
          border: '1px solid var(--color-tan)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', position: 'relative',
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
      )}
    </div>
  );
}
