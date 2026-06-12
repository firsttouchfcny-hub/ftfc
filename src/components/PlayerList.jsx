import { buildFlatList } from '../utils/helpers';

const MATCH1_MAX = 18;
const MATCH2_MAX = 36;
const MATCH2_MIN_CONFIRM = 30;

export default function PlayerList({ session, deviceId, playerName }) {
  const players = session?.players || [];
  const flat = buildFlatList(players);
  const total = flat.length;

  const match1 = flat.slice(0, MATCH1_MAX);
  const match2 = flat.slice(MATCH1_MAX, MATCH2_MAX);
  const bench  = flat.slice(MATCH2_MAX);

  const match2Confirmed = total >= MATCH2_MIN_CONFIRM;
  const spotsNeeded = MATCH2_MIN_CONFIRM - total;

  if (total === 0) {
    return (
      <div className="list-empty">
        {session?.isOpen
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
          <span className="player-name-text">{player.name}</span>
          {player.isAdmin && <span className="badge badge-admin">admin</span>}
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
          <div className={`match-label match2${!match2Confirmed ? ' unconfirmed' : ''}`}>
            ⚽ Match 2
            {match2Confirmed
              ? <span className="match-count">{match2.length} / 18</span>
              : match2.length > 0
                ? <span className="match-note">need {spotsNeeded} more to confirm</span>
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
