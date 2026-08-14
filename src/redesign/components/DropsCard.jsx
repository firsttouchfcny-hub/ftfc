// "Drops today" — everyone who signed up and then pulled out, newest first.
// From Figma 3055:9097 (section) + 3055:9199 (the "Drops" row variant).
//
// Sits below the roster: after the Bench card when there is one, otherwise after
// the Match 1/2 card. Rows are the shared PlayerRow with no position number and
// a trailing time — so avatars, admin crowns and "+1" badges all come for free.
//
// Drops are split the way production splits them, because the two mean very
// different things: a drop FROM THE GAME frees a playing spot, a drop from the
// bench doesn't affect anyone. The split reuses the roster card's grouping
// pattern (muted group label + Light Olive divider) — the Figma frame shows a
// single flat list, so this grouping treatment is still awaiting its own design.
//
// Production clears this list at the 10 AM rollover, so it is always "today".

import TableCard from './TableCard';
import PlayerRow from './PlayerRow';
import { formatTimeET } from '../../utils/helpers';

function DropGroup({ label, drops }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* 8px inset aligns the label with the padded rows below it */}
      <div style={{ marginBottom: 12, paddingLeft: 8 }}>
        <span className="type-caption-semibold" style={{ color: 'rgba(31, 31, 31, 0.6)' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {drops.map((d) => (
          <PlayerRow
            key={d.id}
            name={d.name}
            photoURL={d.photoURL}
            admin={d.admin}
            plusOne={d.plusOne}
            time={formatTimeET(d.at)}
          />
        ))}
      </div>
    </div>
  );
}

export default function DropsCard({ drops }) {
  if (!drops?.length) return null;

  // Newest first, same as production.
  const sorted = [...drops].sort((a, b) => b.at - a.at);
  const fromGame = sorted.filter((d) => !d.fromBench);
  const fromBench = sorted.filter((d) => d.fromBench);

  return (
    <TableCard>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 24 }}>
        <div style={{ paddingLeft: 8 }}>
          <span className="type-caption-semibold" style={{ color: 'var(--color-dark-gray)' }}>
            Drops today
          </span>
        </div>

        {fromGame.length > 0 && (
          <DropGroup label={`From the game (${fromGame.length}) — opened a spot`} drops={fromGame} />
        )}

        {fromGame.length > 0 && fromBench.length > 0 && (
          <div style={{ height: 1, background: 'var(--color-light-olive)', margin: '0 9px' }} />
        )}

        {fromBench.length > 0 && (
          <DropGroup label={`From the bench (${fromBench.length}) — no game impact`} drops={fromBench} />
        )}
      </div>
    </TableCard>
  );
}
