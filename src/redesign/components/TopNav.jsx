// Nav Bar — built to match Figma node 2708:8602 (default) and 2965:5518 (back).
// Row, space-between, 24/16 padding, on a frosted sticky header.
//   · default  → Left: Rules + Gear as 44px Cream pill buttons. Right: 44px avatar.
//   · back     → a single 44px Cream pill with a back arrow (detail surfaces like
//                Rules), so users can return to where they came from.
// Icons are the exact exported SVGs; the 28px box + inner insets reproduce the
// designed icon geometry. Tokens: Cream button, Tan avatar ring, Dark Gray icon.

import { useNavigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../identity/useCurrentUser';
import Avatar from './Avatar';
import ProgressiveBlur from './ProgressiveBlur';
import rulesIcon from '../assets/icons/rules.svg';
import gearIcon from '../assets/icons/gear.svg';
import backIcon from '../assets/icons/back.svg';

// Detail surfaces that show the back variant instead of the default nav.
const BACK_ROUTES = ['/rules', '/profile'];

const ICONS = {
  rules: { src: rulesIcon, inset: { top: '8.33%', right: '10.33%', bottom: '8.51%', left: '8.33%' } },
  gear:  { src: gearIcon,  inset: { top: '12.5%', right: '8.33%', bottom: '11.24%', left: '8.33%' } },
  back:  { src: backIcon,  inset: { top: 0, right: 0, bottom: 0, left: 0 } }, // 28px arrow fills the box
};

function NavIconButton({ icon, label, onClick }) {
  const { src, inset } = ICONS[icon];
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: 'flex', alignItems: 'center', padding: 8, flexShrink: 0,
        background: 'var(--color-cream)', borderRadius: 9999, border: 'none', cursor: 'pointer',
      }}
    >
      {/* 28px icon box (preserves outer geometry) */}
      <span style={{ position: 'relative', display: 'block', width: 28, height: 28, overflow: 'hidden', flexShrink: 0 }}>
        {/* inner leaf, positioned by the exact Figma insets */}
        <span style={{ position: 'absolute', ...inset }}>
          <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', maxWidth: 'none' }} />
        </span>
      </span>
    </button>
  );
}

export default function TopNav() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const showBack = BACK_ROUTES.includes(pathname);

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20 }}>
      {/* Frosted backdrop (color-agnostic) — blurs content scrolling under the nav */}
      <ProgressiveBlur height={112} maxBlur={8} />
      {/* Olive scrim tint, over the frost (extends slightly below for a soft tail) */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 112,
          background: 'var(--gradient-nav-scrim)', pointerEvents: 'none', zIndex: 0,
        }}
      />
      {/* Nav content, above the frost + tint */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 16px', width: '100%',
        }}
      >
        {showBack ? (
          <NavIconButton icon="back" label="Back" onClick={() => navigate(-1)} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <NavIconButton icon="rules" label="Rules" onClick={() => navigate('/rules')} />
              <NavIconButton icon="gear" label="Gear" onClick={() => navigate('/gear')} />
            </div>
            <Avatar user={user} size={44} title="Profile" onClick={() => navigate('/profile')} />
          </>
        )}
      </div>
    </header>
  );
}
