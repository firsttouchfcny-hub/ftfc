// Nav Bar — built to match Figma node 2708:8602 exactly.
// Row, space-between, 12/16 padding. Left: Rules + Gear as 44px Cream pill
// buttons (8px pad around a 28px icon box). Right: 44px avatar.
// Icons are the exact exported SVGs; the 28px box + inner insets reproduce the
// designed icon geometry. Tokens: Cream button, Tan avatar ring, Dark Gray icon.

import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../identity/useCurrentUser';
import Avatar from './Avatar';
import rulesIcon from '../assets/icons/rules.svg';
import gearIcon from '../assets/icons/gear.svg';

const ICONS = {
  rules: { src: rulesIcon, inset: { top: '8.33%', right: '10.33%', bottom: '8.51%', left: '8.33%' } },
  gear:  { src: gearIcon,  inset: { top: '12.5%', right: '8.33%', bottom: '11.24%', left: '8.33%' } },
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

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 20,          // stays visible on scroll
        background: 'var(--color-light-olive)',           // content scrolls under it
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px', width: '100%',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <NavIconButton icon="rules" label="Rules" onClick={() => navigate('/rules')} />
        <NavIconButton icon="gear" label="Gear" onClick={() => navigate('/gear')} />
      </div>
      <Avatar user={user} size={44} title="Profile" onClick={() => navigate('/profile')} />
    </header>
  );
}
