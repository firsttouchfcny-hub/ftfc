// Who's already in — the lineup facepile (Figma 3150:9375).
//
// Five overlapping avatars and a "+N" disc, under a small "Lineup" label. It
// exists to close a gap the redesign created: production shows the whole roster
// on the same screen as the sign-up buttons, so you can see how full the game is
// before you tap. Moving the roster behind sign-up took that away — this puts
// it back in a glance, and opens the full list on tap.
//
// The people shown are the first five in roster order, which is not arbitrary:
// production's tiering puts gear bringers, takers and admins at the top, so the
// faces you see are the ones holding the game together.
//
// The whole row is the tap target, not just the "+N" disc. The disc is the
// visible affordance the design specifies, but a 40px circle is a small thing to
// hit, and with five or fewer players there is no disc at all — leaving no way
// to open the list on exactly the quiet days this was built for.

import PlayerAvatar from './PlayerAvatar';

const SIZE = 40;
const OVERLAP = 8;

export default function Facepile({ players, total, max = 5, label = 'Lineup', onOpen }) {
  const shown = players.slice(0, max);
  // `total` counts everyone in, guests included; `players` is faces only. They
  // differ whenever somebody brought a +1, and the count is the honest number.
  const count = total ?? players.length;
  const extra = Math.max(0, count - shown.length);

  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See the lineup — ${count} ${count === 1 ? 'player' : 'players'} in`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: 'var(--color-dark-gray)',
      }}
    >
      <span className="type-small-regular">{label}</span>

      <span style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((p, i) => (
          <span
            key={p.id ?? i}
            style={{
              // Each disc carries a ring in the page colour so the overlap reads
              // as separate faces rather than one shape.
              display: 'block', borderRadius: '50%',
              border: '2px solid var(--color-light-olive)',
              marginRight: -OVERLAP,
              // Later avatars sit on top, so the row reads left to right.
              position: 'relative', zIndex: i,
            }}
          >
            <PlayerAvatar name={p.name} photoURL={p.photoURL} size={SIZE - 4} />
          </span>
        ))}

        {extra > 0 && (
          <span
            style={{
              width: SIZE, height: SIZE, borderRadius: '50%', boxSizing: 'border-box',
              background: 'var(--color-tan)', border: '2px solid var(--color-light-olive)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: shown.length, flexShrink: 0,
            }}
          >
            <span className="type-caption-bold">+{extra}</span>
          </span>
        )}
      </span>
    </button>
  );
}
