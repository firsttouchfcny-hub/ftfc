// Remove orphaned gear roster rows: a roster entry carrying a gearBringer/gearTaker
// marker that has NO matching LIVE gear commitment for that date+role+person.
// These are left behind when a commitment is cancelled/rescheduled/returned.
// Only touches sessions dated >= TODAY. Pass --apply to actually delete (default
// is a dry run). Run: node scripts/sweep-orphan-gear-rows.mjs [--apply]
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');
const TODAY = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || '2026-08-02';

const env = {};
for (const l of fs.readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const db = getFirestore(initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID }));

const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, '-');
const live = (((await getDoc(doc(db, 'gear', 'ledger'))).data() || {}).commitments || []).filter((c) => c.status === 'committed');
const same = (c, row) => (c.takerUid && row.uid && c.takerUid === row.uid) || norm(c.takerName) === norm(row.name);
const hasBringer = (row, date) => live.some((c) => c.type === row.gearBringer && c.returnDate === date && same(c, row));
const hasTaker  = (row, date) => live.some((c) => c.type === row.gearTaker && !c.held && c.takeDate === date && same(c, row));

console.log(`Mode: ${APPLY ? 'APPLY (deleting)' : 'DRY RUN'} · sessions >= ${TODAY}\n`);
let count = 0;
for (const s of (await getDocs(collection(db, 'sessions'))).docs) {
  if (s.id < TODAY) continue;
  for (const p of (await getDocs(collection(db, 'sessions', s.id, 'players'))).docs) {
    const row = { id: p.id, ...p.data() };
    if (!row.gearBringer && !row.gearTaker) continue;
    const bO = row.gearBringer && !hasBringer(row, s.id);
    const tO = row.gearTaker && !hasTaker(row, s.id);
    const allOrphaned = (!row.gearBringer || bO) && (!row.gearTaker || tO);
    if (!allOrphaned) continue;
    count++;
    console.log(`  ${s.id}: "${row.name}" bringer=${row.gearBringer || '-'} taker=${row.gearTaker || '-'} uid=${row.uid || '-'} plusOnes=${row.plusOnes || 0} signedUpAt=${row.signedUpAt}`);
    if (APPLY) await deleteDoc(p.ref);
  }
}
console.log(`\n${APPLY ? 'Removed' : 'Would remove'} ${count} orphaned gear row(s).`);
process.exit(0);
