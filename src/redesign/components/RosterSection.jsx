// A roster section: a header (section label, optionally an `icon` + subtitle for
// states like "Match 2 on hold" or "Match 2 — NO GAME") and the list of player
// rows. The list can be `dimmed` (50% opacity) as a second affordance for a match
// that isn't confirmed. From Figma "Table header" (2730:10554), "Match 2 on hold"
// (2800:2132), "Match 2 — NO GAME" (2965:3311).

import PlayerRow from './PlayerRow';

export default function RosterSection({ label, subtitle, icon, dimmed, players }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Header */}
      {subtitle ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', marginBottom: 20 }}>
          {icon && <img src={icon} alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--color-dark-gray)' }}>
            <span className="type-caption-semibold">{label}</span>
            <span className="type-caption-bold">{subtitle}</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span className="type-caption-semibold" style={{ color: 'rgba(31, 31, 31, 0.6)' }}>{label}</span>
        </div>
      )}

      {/* Rows (dimmed when the match isn't confirmed yet) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: dimmed ? 0.5 : 1 }}>
        {players.map((p) => (
          <PlayerRow key={p.id} {...p} />
        ))}
      </div>
    </div>
  );
}
