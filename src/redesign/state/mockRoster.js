// Demo roster for the "You're in" screen — exercises every row variant: photo vs
// initials avatars, admins (crown), and the four gear bringers (badge). Real
// session data replaces this once the backend is wired.

import sampleAvatar from '../assets/sample-avatar.png';

let n = 0;
const P = (name, opts = {}) => {
  n += 1;
  return {
    id: `p-${n}`,
    position: String(n).padStart(2, '0'),
    name,
    photoURL: opts.photo ? sampleAvatar : null,
    admin: !!opts.admin,
    bringing: opts.bringing || null,
  };
};

// Match 1 (top 18). Gear bringers cap at 2 goals + 1 balls + 1 bibs.
const match1 = [
  P('Cristian Lugo', { photo: true, admin: true, bringing: '🥅' }),
  P('Dave Rappaport', { photo: true, admin: true, bringing: '🥅' }),
  P('This is a really long name', { admin: true, bringing: '⚽' }),
  P('Marco Silva', { photo: true, bringing: '🧺' }),
  P('Jordan Chen', {}),
  P('Luis Gómez', { photo: true }),
  P('Theo Walsh', {}),
  P('Sam Okafor', { photo: true }),
  P('Nico Bruno', {}),
  P('Andre Costa', { photo: true }),
  P('Kofi Mensah', {}),
  P('Omar Haddad', { photo: true }),
  P('Rafa Núñez', {}),
  P('Ben Whitfield', { photo: true }),
  P('Gabe Ellison', {}),
  P('Hugo Park', { photo: true }),
  P('Iker Ruiz', {}),
  P('Max Fischer', { photo: true }),
];

// Match 2 (next batch).
const match2 = [
  P('Leo Duarte', { photo: true }),
  P('Pablo Vega', {}),
  P('Dario Fuentes', { photo: true }),
  P('Zane Carter', {}),
  P('Emre Yılmaz', { photo: true }),
  P('Cruz Medina', {}),
  P('Joel Baptiste', { photo: true }),
  P('Kai Andersen', {}),
  P('Silva Rocha', { photo: true }),
  P('Uri Katz', {}),
  P('Vin Alvarez', { photo: true }),
  P('Wes Turner', {}),
];

// Bench (waiting for a spot).
const bench = [
  P('Noah Bright', {}),
  P('Otis Grant', { photo: true }),
  P('Pip Hollis', {}),
  P('Quinn Ryder', { photo: true }),
];

export const mockRoster = { match1, match2, bench };
