// "You're in" confirmation header — headline + single-line date + time/location.
// From Figma nodes 2730:10643 / 2965:3866. Distinct from GameHeader: no ball,
// one-line date, location not underlined. The headline varies by outcome
// (You're in / In match 2 waitlist / Bench / …); an optional expressive-orange
// `badge` pill shows the waitlist count.

export default function Confirmation({
  headline = 'You’re in',
  badge,
  date = 'Thursday, Oct 11th, 2026',
  time = '07:00 AM',
  location = 'McCarren Park',
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
        textAlign: 'center', color: 'var(--color-dark-gray)', padding: '0 16px',
      }}
    >
      <div className="type-heading-h2">{headline}</div>

      {badge && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--color-expressive-orange) 24%, transparent)',
            border: '1px solid var(--color-expressive-orange)',
            borderRadius: 8, padding: '8px 11px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span className="type-caption-semibold" style={{ color: 'var(--color-dark-gray)', whiteSpace: 'nowrap' }}>
            {badge}
          </span>
        </div>
      )}

      <div className="type-body-regular">{date}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'center' }}>
        <span className="type-body-regular">{time}</span>
        <span className="type-body-light">•</span>
        <span className="type-body-regular">{location}</span>
      </div>
    </div>
  );
}
