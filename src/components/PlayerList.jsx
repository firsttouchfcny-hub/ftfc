import {
  buildFlatList, gearIcon, getMatch2State,
  MATCH1_MAX, MATCH2_MAX, MATCH2_MIN_CONFIRM,
} from '../utils/helpers';

export default function PlayerList({ session, deviceId, playerName, isOpen }) {
  const players = session?.players || [];
  const flat = buildFlatList(players);
  const total = flat.length;

  const match1 = flat.slice(0, MATCH1_MAX);
  const match2 = flat.slice(MATCH1_MAX, MATCH2_MAX);
  const bench  = flat.slice(MATCH2_MAX);

  const match2State = getMatch2State(total);   // 'confirmed' | 'on-hold' | 'off'
  const spotsNeeded = MATCH2_MIN_CONFIRM - total;

  if (total === 0) {
    return (
      <div className="list-empty">
        {isOpen
          ? 'No players yet — be the first to sign in!'
          : 'Roll call is not open yet.'}
      </div>
    );
  }

  const renderRow = (player, position) => {
    const isOwn =
      player.deviceId === deviceId ||
      (player.isMainEntry && player.name.toLowerCase() === playerName?.toLowerCase());

    return (
      <div key={player.id} className={`player-row${isOwn ? ' own' : ''}${player.isAdmin ? ' is-admin' : ''}`}>
        <span className="player-pos">{position}</span>
        <span className="player-name-cell">
          {isOwn && <span className="green-dot" title="You" />}
          {player.gear && <span className="gear-name-icon" title={player.gear}>{gearIcon(player.gear)}</span>}
          <span className="player-name-text">{player.name}</span>
          {player.isAdmin && <span className="badge badge-admin">admin</span>}
          {player.priority && !player.isAdmin && <span className="badge badge-priority">priority</span>}
          {!player.isMainEntry && <span className="badge badge-plus">+1</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="player-list">
      {/* Match 1 */}
      <div className="match-block">
        <div className="match-label match1">
          ⚽ Match 1
          <span className="match-count">{Math.min(total, MATCH1_MAX)} / 18</span>
        </div>
        {match1.map((p, i) => renderRow(p, i + 1))}
      </div>

      {/* Match 2 */}
      {(match2.length > 0 || total >= MATCH1_MAX) && (
        <div className="match-block">
          <div className={`match-label match2${match2State === 'off' ? ' cancelled' : match2State !== 'confirmed' ? ' unconfirmed' : ''}`}>
            {match2State === 'off' ? '🚫 Match 2 — NO GAME' : '⚽ Match 2'}
            {match2State === 'confirmed'
              ? <span className="match-count">{match2.length} / 18</span>
              : match2State === 'off'
                ? <span className="match-note">canceled — not enough players</span>
                : match2.length > 0
                  ? <span className="match-note">on hold · need {spotsNeeded} more · decides 9 PM</span>
                  : <span className="match-note">need {MATCH2_MIN_CONFIRM - MATCH1_MAX} players to unlock</span>}
          </div>
          {match2.map((p, i) => renderRow(p, MATCH1_MAX + i + 1))}
          {match2.length === 0 && (
            <div className="player-row empty-row">Waiting for more signups…</div>
          )}
        </div>
      )}

      {/* Bench */}
      {bench.length > 0 && (
        <div className="match-block">
          <div className="match-label bench">
            🪑 Bench
            <span className="match-count">{bench.length}</span>
          </div>
          {bench.map((p, i) => renderRow(p, MATCH2_MAX + i + 1))}
        </div>
      )}
    </div>
  );
}
