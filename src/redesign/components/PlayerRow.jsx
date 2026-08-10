// Player row (Figma 2730:10519): position number · avatar (+ admin crown) ·
// name (truncates) · optional "Bringing <gear>" badge. Each row has 8px padding;
// the `you` variant (2965:5199) adds a Tan/40% fill + 16px radius as a highlight.

import PlayerAvatar from './PlayerAvatar';

export default function PlayerRow({ position, name, photoURL, admin, bringing, plusOne, gearPriority, you }) {
  // Friday gear-priority badge — mirrors production (PlayerList.jsx): only shown
  // when the player isn't already distinguished as a bringer or an admin. Real
  // eligibility (took a set home Mon–Thu; Fridays only) comes from the gear ledger
  // via fridayGearPriorityNames when data is wired.
  //
  // NOTE: `gearPriority` is the Friday gear reward — deliberately NOT production's
  // `player.priority`, which is a separate admin-set per-day pin that ranks with
  // admins and carries no badge of its own.
  const showPriority = gearPriority && !bringing && !admin;
  return (
    <div
      style={{
        padding: 8, width: '100%',
        ...(you ? { background: 'var(--color-tan-40)', borderRadius: 16 } : {}),
      }}
    >
      <div style={{ display: 'flex', gap: 8, height: 32, alignItems: 'center', minWidth: 0 }}>
        {/* Position (omitted in listings without ranks, e.g. emergency contacts) */}
        {position != null && (
          <span
            className="type-caption-bold"
            style={{ color: 'var(--color-dark-gray)', width: 18, textAlign: 'center', flexShrink: 0 }}
          >
            {position}
          </span>
        )}

        {/* Avatar + name + badge */}
        <div style={{ display: 'flex', flex: '1 0 0', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <PlayerAvatar name={name} photoURL={photoURL} admin={admin} />

          <div style={{ display: 'flex', flex: '1 0 0', gap: 10, alignItems: 'center', minWidth: 0 }}>
            {/* Name + optional "+1" guest badge (hugs the name; name truncates first) */}
            <div style={{ display: 'flex', flex: '1 0 0', gap: 4, alignItems: 'center', minWidth: 0 }}>
              <span
                className="type-small-regular"
                style={{ color: 'var(--color-dark-gray)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {name}
              </span>

              {plusOne && (
                <div
                  style={{
                    background: 'var(--color-tan-60)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '4px 6px', borderRadius: 6, flexShrink: 0,
                  }}
                >
                  <span className="type-caption-bold" style={{ color: 'var(--color-dark-gray)', whiteSpace: 'nowrap' }}>+1</span>
                </div>
              )}
            </div>

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

            {showPriority && (
              <div
                style={{
                  background: 'var(--color-tan-20)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 6px', borderRadius: 4, flexShrink: 0,
                }}
              >
                <span className="type-caption-bold" style={{ color: 'var(--color-dark-gray)', whiteSpace: 'nowrap' }}>
                  Priority
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
