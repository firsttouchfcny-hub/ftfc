// Round avatar: shows the user's photo, or their initials on Tan when there's
// no photo (matches the "JC" fallback in the Figma roster mockup).

export default function Avatar({ user, size = 40, onClick, title }) {
  const initials = (
    (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')
  ).toUpperCase() || '?';

  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: '1px solid var(--color-tan)',
    boxShadow: 'inset 0 0 0 1px rgba(210, 207, 189, 0.6)', // Figma inset ring
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default', padding: 0, background: 'var(--color-tan)',
  };

  if (user?.photoURL) {
    return (
      <button style={base} onClick={onClick} title={title} aria-label={title}>
        <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </button>
    );
  }
  return (
    <button
      style={{ ...base, display: 'grid', placeItems: 'center', color: 'var(--color-dark-gray)' }}
      onClick={onClick} title={title} aria-label={title}
    >
      <span style={{ fontFamily: 'var(--font-family-base)', fontWeight: 600, fontSize: size * 0.36 }}>
        {initials}
      </span>
    </button>
  );
}
