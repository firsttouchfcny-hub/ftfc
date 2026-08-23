// Roster avatar (32px). Two types, per Figma 2744:9185 / 2744:9197:
//   · photo    → the user's image, desaturated to the brand tone (luminosity blend)
//   · initials → first+last initials on Tan (fallback when there's no photo)
// Optional admin crown badge in the bottom-right corner.

import adminIcon from '../assets/icons/admin.svg';

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// `size` defaults to the roster's 32px; the gear dialogs use 28px inline.
export default function PlayerAvatar({ name, photoURL, admin, size = 32 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {photoURL ? (
        <img
          src={photoURL}
          alt=""
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', mixBlendMode: 'luminosity', display: 'block' }}
        />
      ) : (
        <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-tan)', display: 'grid', placeItems: 'center' }}>
          <span
            className="type-small-semibold"
            style={{ color: 'var(--color-dark-gray)', lineHeight: 1, fontSize: Math.round(size * 0.44) }}
          >
            {initialsOf(name)}
          </span>
        </div>
      )}
      {admin && (
        <img src={adminIcon} alt="admin" style={{ position: 'absolute', left: 16, top: 16, width: 20, height: 20 }} />
      )}
    </div>
  );
}
