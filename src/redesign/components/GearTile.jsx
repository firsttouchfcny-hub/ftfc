// Gear tile — a 48px Cream circle holding a gear icon, with a 32px control
// overlapping 8px below. From Figma "Gear Assignment" (2760:14167).
//
// Three states:
//   · free   → a "+" icon button that opens the take-home dialog
//   · locked → the same icon button, DISABLED (balls-gate: goals & bibs must be
//              taken before balls, so the balls tile locks until then — 2754:3164)
//   · taken  → the taker's avatar in place of the button (2756:2786), reusing the
//              roster avatar: their photo, or their initials
//
// "Fully covered" isn't a separate state: because each set is its own tile, it's
// just every tile in the taken state. The "yours" variant is still to come.

import IconButton from './IconButton';
import PlayerAvatar from './PlayerAvatar';
import plusIcon from '../assets/icons/plus.svg';

export default function GearTile({ icon, label, onAdd, onOpenTaken, takenBy, locked }) {
  return (
    <div style={{ width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* gear icon circle (48px), pulled -8px so the control overlaps it */}
      <div
        style={{
          width: 48, height: 48, borderRadius: 1000, background: 'var(--color-cream)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
          marginBottom: -8, position: 'relative',
        }}
      >
        <img src={icon} alt={label} style={{ width: 24, height: 24, objectFit: 'cover' }} />
      </div>

      {takenBy ? (
        // taken → the taker's avatar sits where the "+" would be.
        // No z-index: it would create a stacking context, isolating the avatar's
        // luminosity blend and leaving the photo in full colour while every other
        // avatar is desaturated. DOM order handles the overlap — this sits after
        // the gear circle and both are positioned.
        <button
          type="button"
          onClick={onOpenTaken}
          title={`${takenBy.name} is taking ${label} home`}
          aria-label={`${takenBy.name} is taking ${label} home`}
          style={{
            position: 'relative', padding: 0, border: 'none',
            background: 'transparent', cursor: 'pointer', display: 'block',
            borderRadius: 1000,
          }}
        >
          <PlayerAvatar name={takenBy.name} photoURL={takenBy.photoURL} />
        </button>
      ) : (
        // free / locked → the "+" icon button (disabled when locked).
        // Wrapped in a positioned box so it paints ON TOP of the gear circle:
        // the circle is position:relative, and a static button would otherwise
        // render behind it regardless of DOM order. (No z-index — same reason as
        // the avatar branch: it would create a stacking context.)
        <div style={{ position: 'relative' }}>
          <IconButton
            size="sm"
            onClick={onAdd}
            disabled={locked}
            label={locked ? `${label} locked — goals & bibs first` : `Take ${label}`}
            title={locked ? `${label} locked — goals & bibs first` : `Take ${label}`}
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
          </IconButton>
        </div>
      )}
    </div>
  );
}
