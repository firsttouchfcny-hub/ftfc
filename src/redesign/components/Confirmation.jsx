// "You're in" confirmation header — headline + single-line date + time/location.
// From Figma nodes 2730:10643 / 2965:3866. Distinct from GameHeader: no ball,
// one-line date, location not underlined. The headline varies by outcome
// (You're in / In match 2 waitlist / Bench / …); an optional expressive-orange
// `badge` pill shows the waitlist count.
//
// `loading` hides the headline behind a placeholder. The headline is a CLAIM —
// "You're in", "You are 2nd in bench", "No game" — and which one is true depends
// on the roster we're still waiting for, so stating one early risks telling
// somebody they're playing when they aren't. The date, time and place come from
// the clock and fixed copy, so those never wait.

import { Skeleton } from './Skeleton';

export default function Confirmation({
  headline = 'You’re in',
  badge,
  loading = false,
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
      {loading ? (
        // The box is the headline's full 36px line so nothing moves when the
        // real words land; the bar inside is shorter, as text is.
        <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <Skeleton width={180} height={24} radius={8} />
        </div>
      ) : (
        <div className="type-heading-h2">{headline}</div>
      )}

      {/* No placeholder for the badge: it is absent in the common case, so
          drawing one would promise a waitlist that usually isn't there. */}
      {!loading && badge && (
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
