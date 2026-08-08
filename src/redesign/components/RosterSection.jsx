// A roster section: a muted section label ("Match 1" / "Match 2" / "Bench") and
// the list of player rows. From Figma "Table header" (2730:10554) + list.

import PlayerRow from './PlayerRow';

export default function RosterSection({ label, players }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span className="type-caption-semibold" style={{ color: 'rgba(31, 31, 31, 0.6)' }}>{label}</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {players.map((p) => (
          <PlayerRow key={p.id} {...p} />
        ))}
      </div>
    </div>
  );
}
