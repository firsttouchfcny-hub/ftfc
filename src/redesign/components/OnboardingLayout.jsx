// The frame every account-creation screen sits in (Figma 2670:11785 and its
// siblings — all five steps share one page layout).
//
// Light Olive full-bleed, the 64px club badge at the top, then the step's own
// content. No top nav: this flow runs before there is an account to navigate
// with, which is why it lives outside the app's layout route.
//
// `badge={false}` is for the welcome screen, which drops the badge and centres
// its content instead (Figma 2699:12983).

import badge from '../assets/ftfc-badge.svg';

export default function OnboardingLayout({ badge: showBadge = true, children }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-light-olive)',
        fontFamily: 'var(--font-family-base)',
        color: 'var(--color-dark-gray)',
      }}
    >
      <div
        style={{
          maxWidth: 430, margin: '0 auto', minHeight: '100dvh', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          // 72px between the badge and the content is the designed rhythm; the
          // welcome screen has no badge, so the gap collapses on its own.
          gap: 72, padding: '16px 24px 32px',
          justifyContent: showBadge ? 'flex-start' : 'center',
        }}
      >
        {showBadge && (
          // Vector, so it stays sharp at any size and on any screen density.
          <img
            src={badge}
            alt="First Touch Futebol Club"
            style={{ width: 64, height: 64, flexShrink: 0, display: 'block' }}
          />
        )}
        <div style={{ flex: '1 0 0', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
