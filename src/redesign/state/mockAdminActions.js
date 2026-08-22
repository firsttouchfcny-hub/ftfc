// Mock implementation of the admin actions seam (see utils/adminActions.js).
//
// Same operations as the Firestore version, backed by in-memory state instead —
// so the real AdminPanel component renders and responds exactly as it does in
// production, without touching a single real player. This is what lets the
// admin tools be reviewed on the public preview deploy, which has no Firebase.
//
// When the redesign merges, this is the one thing that swaps: the route passes
// createFirestoreAdminActions() instead, and the panel is live.

import { calculateSuspensionEnd, getCurrentYear, normalizeName } from '../../utils/helpers';

export function createMockAdminActions({ getPlayers, setPlayers, setSession, adminName }) {
  let strikes = [];
  let accounts = new Map(); // name → { uid, name, isAdmin, phoneVerified }

  const acctFor = (name) => {
    const key = normalizeName(name);
    if (!accounts.has(key)) {
      accounts.set(key, { uid: `mock-${key}`, id: `mock-${key}`, name, isAdmin: false });
    }
    return accounts.get(key);
  };

  // Seed accounts from whoever is already flagged admin on the roster.
  const seed = () => {
    for (const p of getPlayers()) {
      if (p.isAdmin) acctFor(p.name).isAdmin = true;
    }
  };
  seed();

  const patch = (playerId, fields) =>
    setPlayers((ps) => ps.map((p) => (p.id === playerId ? { ...p, ...fields } : p)));

  return {
    async loadAdmins() {
      return [...accounts.values()]
        .filter((a) => a.isAdmin)
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    },

    async loadStrikeLog() {
      return [...strikes].sort((a, b) => b.issuedAt - a.issuedAt);
    },

    async setRollOverride(value) {
      setSession((s) => ({ ...s, override: value }));
    },

    async resetList() {
      setPlayers([]);
      setSession((s) => ({ ...s, isOpen: false, drops: [] }));
    },

    async bulkAdd(names, players) {
      const existing = new Set((players || []).map((p) => p.name.toLowerCase()));
      const fresh = names.filter((n) => !existing.has(n.toLowerCase()));
      setPlayers((ps) => [
        ...ps,
        ...fresh.map((name, i) => ({
          id: `mock-add-${Date.now()}-${i}`,
          uid: acctFor(name).uid,
          name,
          deviceId: `admin-${normalizeName(name)}`,
          isAdmin: false,
          plusOnes: 0,
          priority: false,
          signedUp: true,
          signedUpAt: Date.now() + i,
        })),
      ]);
      return fresh.length;
    },

    async updatePlusOnes(playerId, value, player) {
      const val = Math.max(0, parseInt(value, 10) || 0);
      const cur = player?.plusOnes || 0;
      const hts = player?.signedUpAt || 0;
      const times = Array.isArray(player?.plusOnesAt) ? player.plusOnesAt.slice(0, cur) : [];
      while (times.length < cur) times.push(hts);
      if (val > times.length) { const now = Date.now(); while (times.length < val) times.push(now); }
      else times.length = val;
      patch(playerId, { plusOnes: val, plusOnesAt: times });
    },

    async togglePriority(playerId, current) {
      patch(playerId, { priority: !current });
    },

    async toggleAdmin(playerId, uid, name, current) {
      patch(playerId, { isAdmin: !current });
      acctFor(name).isAdmin = !current;
    },

    async grantAdminByName(name) { acctFor(name).isAdmin = true; },
    async revokeAdmin(uid) {
      for (const a of accounts.values()) if (a.uid === uid) a.isAdmin = false;
    },
    async markVerifiedByName(name) { acctFor(name).phoneVerified = true; },

    async removePlayer(playerId) {
      setPlayers((ps) => ps.filter((p) => p.id !== playerId));
    },

    async issueStrikes(entries) {
      const year = getCurrentYear();
      for (const entry of entries) {
        const acct = acctFor(entry);
        const count = strikes.filter((s) => s.playerUid === acct.uid && !s.undone && s.year === year).length + 1;
        strikes.push({
          id: `mock-strike-${Date.now()}-${count}`,
          playerName: acct.name, playerId: acct.uid, playerUid: acct.uid,
          issuedAt: Date.now(), year, strikeNumber: count, undone: false,
          issuedBy: adminName || 'admin', suspendedUntil: calculateSuspensionEnd(count),
        });
      }
      return entries.length;
    },

    async undoStrike(strike) {
      strikes = strikes.map((s) => (s.id === strike.id ? { ...s, undone: true } : s));
    },
  };
}
