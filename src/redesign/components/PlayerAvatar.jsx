// Roster avatar (32px). Two types, per Figma 2744:9185 / 2744:9197:
//   · photo    → the user's image, desaturated to the brand tone (luminosity blend)
//   · initials → first+last initials on Tan (fallback when there's no photo)
// Optional admin crown badge in the bottom-right corner.

import adminIcon from '../assets/icons/admin.svg';

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export default function PlayerAvatar({ name, photoURL, admin }) {
  return (
    <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
      {photoURL ? (
        <img
          src={photoURL}
          alt=""
          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', mixBlendMode: 'luminosity' }}
        />
      ) : (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-tan)', display: 'grid', placeItems: 'center' }}>
          <span className="type-small-semibold" style={{ color: 'var(--color-dark-gray)', lineHeight: '16px' }}>
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
