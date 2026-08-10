// READ-ONLY diagnostic: dump a session's roster (every field) + the gear ledger,
// so we can explain exactly why each person is on the list.
// Run: node scripts/diagnose-phantom-adds.mjs 2026-07-30
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID });
const db = getFirestore(app);

const date = process.argv[2] || '2026-07-30';
console.log(`\n===== sessions/${date}/players =====`);
const snap = await getDocs(collection(db, 'sessions', date, 'players'));
const rows = snap.docs.map((d) => ({ docId: d.id, ...d.data() }))
  .sort((a, b) => (a.signedUpAt || 0) - (b.signedUpAt || 0));
for (const r of rows) {
  const role = r.gearBringer ? `BRINGER:${r.gearBringer}` : r.gearTaker ? `TAKER:${r.gearTaker}` : 'NONE';
  console.log(`- ${(r.name || '?').padEnd(20)} role=${role.padEnd(14)} uid=${r.uid || 'null'} deviceId=${r.docId} signedUpAt=${r.signedUpAt || '-'} plusOnes=${r.plusOnes ?? '-'} priority=${r.priority ?? '-'}`);
}
console.log(`  (${rows.length} rows)`);

console.log(`\n===== gear/ledger commitments touching ${date} =====`);
const led = (await getDoc(doc(db, 'gear', 'ledger'))).data() || {};
for (const c of (led.commitments || [])) {
  if (c.takeDate === date || c.returnDate === date) {
    console.log(`- ${(c.takerName || '?').padEnd(18)} ${c.type.padEnd(6)} take=${c.takeDate} back=${c.returnDate} status=${c.status} takerUid=${c.takerUid || 'null'} held=${c.held || false} source=${c.source || '-'}`);
  }
}
process.exit(0);
