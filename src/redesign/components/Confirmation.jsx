// "You're in" confirmation header — headline + single-line date + time/location.
// From Figma node 2730:10643. Distinct from GameHeader: no ball, one-line date,
// location not underlined. The headline varies by outcome (You're in / Bench / …).

export default function Confirmation({
  headline = 'You’re in',
  date = 'Thursday, Oct 11th, 2026',
  time = '07:00 AM',
  location = 'McCarren Park',
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
        textAlign: 'center', color: 'var(--color-dark-gray)', padding: '0 32px',
      }}
    >
      <div className="type-heading-h2">{headline}</div>
      <div className="type-body-regular">{date}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'center' }}>
        <span className="type-body-regular">{time}</span>
        <span className="type-body-light">•</span>
        <span className="type-body-regular">{location}</span>
      </div>
    </div>
  );
}
