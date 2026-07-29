// One-off: sync the "William Escobar" gear commitment + Jul 31 roster row to the
// account's CURRENT canonical name (the account renamed but the snapshots didn't).
// Generic: re-points every commitment/row for that uid to accounts/<uid>.name.
// Run: node scripts/fix-escobar-name.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID });
const db = getFirestore(app);

const UID = 'u_1bb59a26-3c90-440f-8669-78a0363d37ba'; // verified "Escobar" account
const acct = (await getDoc(doc(db, 'accounts', UID))).data();
const NAME = acct?.name;
if (!NAME) { console.log('account has no name — abort'); process.exit(1); }
console.log(`canonical name for ${UID}: "${NAME}"`);

// 1. Gear ledger commitments for this uid.
const ledRef = doc(db, 'gear', 'ledger');
const led = (await getDoc(ledRef)).data() || {};
let gearChanged = 0;
const commitments = (led.commitments || []).map((c) => {
  if (c.takerUid === UID && c.takerName !== NAME) { gearChanged++; return { ...c, takerName: NAME }; }
  return c;
});
if (gearChanged) { await updateDoc(ledRef, { commitments }); console.log(`updated ${gearChanged} gear commitment(s) → "${NAME}"`); }
else console.log('no stale gear commitments');

// 2. Any roster row (any session) for this uid whose name is stale.
let rowChanged = 0;
for (const s of (await getDocs(collection(db, 'sessions'))).docs) {
  const rows = await getDocs(collection(db, 'sessions', s.id, 'players'));
  for (const r of rows.docs) {
    const p = r.data();
    if (p.uid === UID && p.name !== NAME) { await updateDoc(r.ref, { name: NAME }); rowChanged++; console.log(`  ${s.id}: "${p.name}" → "${NAME}"`); }
  }
}
console.log(`updated ${rowChanged} roster row(s)\nDone.`);
process.exit(0);
