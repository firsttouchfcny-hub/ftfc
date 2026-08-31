// Loading placeholders.
//
// These exist because two parts of this app are actively misleading before
// their data arrives, rather than merely blank:
//
//   · Gear tiles — an unloaded tile looks exactly like an unclaimed one. Show
//     the real thing early and a player taps "+" to take goals somebody already
//     has, and the "nobody is bringing gear" warning fires on an empty ledger.
//   · The roster — an empty list and a list that hasn't landed are the same
//     picture, so "be the first to sign in" can appear to somebody who is
//     twentieth in line.
//
// Every placeholder matches the real element's box, so content arriving doesn't
// shift the page under a thumb that's already reaching for something.
//
// A note for whoever wires these to live data: don't show them for a load that
// finishes quickly. A placeholder that flashes for a tenth of a second reads as
// a glitch, not as progress — wait ~300ms before showing one, and once shown,
// leave it up long enough to not blink.

const NAME_WIDTHS = ['62%', '48%', '71%', '55%', '66%', '44%'];

export function Skeleton({ width, height, radius = 6, style }) {
  return (
    <div
      className="rd-skeleton"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

// Placeholder roster rows. Matches PlayerRow's box: 8px padding around 32px of
// content, 2px between rows.
export function RosterSkeleton({ rows = 6, label = 'Match 1' }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the roster"
      style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
    >
      {/* The section label is real — we know it before the names arrive, so
          there is no reason to grey it out. */}
      <div style={{ marginBottom: 12, paddingLeft: 8 }}>
        <span className="type-caption-semibold" style={{ color: 'rgba(31, 31, 31, 0.6)' }}>{label}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, width: '100%' }}>
            {/* position · avatar · name — the same three columns as a real row */}
            <Skeleton width={18} height={12} radius={4} />
            <Skeleton width={32} height={32} radius={1000} />
            {/* Widths vary so the block reads as names rather than as a chart. */}
            <Skeleton width={NAME_WIDTHS[i % NAME_WIDTHS.length]} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Placeholder gear tiles. Matches GearTile: a 48px circle with a 32px control
// tucked 8px underneath it.
export function GearSkeleton({ tiles = 4 }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading gear"
      // 24px gap and 48px tiles, the same as the real strip.
      style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}
    >
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} style={{ width: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Skeleton width={48} height={48} radius={1000} style={{ marginBottom: -8 }} />
          {/* Deliberately NOT a "+": until the ledger lands we don't know
              whether this set is free, and a plus invites taking one that isn't. */}
          {/* A ring in the page colour keeps this reading as a separate disc
              tucked under the tile, the way the real avatar and "+" do —
              without it the two greys merge into one blob. */}
          <Skeleton
            width={32}
            height={32}
            radius={1000}
            // border-box so the ring sits INSIDE the 32px — otherwise the tile
            // stands 4px taller than the real one and the strip shifts on load.
            style={{ position: 'relative', border: '2px solid var(--color-light-olive)', boxSizing: 'border-box' }}
          />
        </div>
      ))}
    </div>
  );
}
