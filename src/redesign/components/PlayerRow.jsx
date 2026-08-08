// Player row (Figma 2730:10519): position number · avatar (+ admin crown) ·
// name (truncates) · optional "Bringing <gear>" badge. Height 32.

import PlayerAvatar from './PlayerAvatar';

export default function PlayerRow({ position, name, photoURL, admin, bringing }) {
  return (
    <div style={{ display: 'flex', gap: 8, height: 32, alignItems: 'center', width: '100%' }}>
      {/* Position */}
      <span
        className="type-caption-bold"
        style={{ color: 'var(--color-dark-gray)', width: 18, textAlign: 'center', flexShrink: 0 }}
      >
        {position}
      </span>

      {/* Avatar + name + badge */}
      <div style={{ display: 'flex', flex: '1 0 0', gap: 12, alignItems: 'center', minWidth: 0 }}>
        <PlayerAvatar name={name} photoURL={photoURL} admin={admin} />

        <div style={{ display: 'flex', flex: '1 0 0', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span
            className="type-small-regular"
            style={{ color: 'var(--color-dark-gray)', flex: '1 0 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {name}
          </span>

          {bringing && (
            <div
              style={{
                background: 'var(--color-tan-20)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '4px 6px', borderRadius: 4, flexShrink: 0,
              }}
            >
              <span className="type-caption-semibold" style={{ color: 'var(--color-dark-gray)', whiteSpace: 'nowrap' }}>
                Bringing {bringing}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
