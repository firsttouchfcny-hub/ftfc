// One-off cleanup for Thu 2026-07-30, per user review:
//  1. Remove FDC's stray sign-in row and Aidan's admin-bulk-add row.
//  2. Unify the "Miguel C" bibs commitment + its roster row onto the REAL
//     (phone-verified) Miguel Cevallos account, so his bibs BRINGING badge shows.
// Read-then-write, prints before/after. Run: node scripts/fix-jul30.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID });
const db = getFirestore(app);

const DATE = '2026-07-30';
const MIGUEL_UID = 'u_f6038b4f-2d92-4c7a-8bd4-dd378d1674c1'; // verified Miguel Cevallos
const MIGUEL_NAME = 'Miguel Cevallos';
const FDC_ROW = '06ee39dd-0267-4677-97aa-eb4234191c1c';
const AIDAN_ROW = 'admin-aidan';
const MIGUEL_ROW = 'admin-gear-d6e169c9-42f3-4aee-b290-865b25b2b95e';

// 1. Remove the two stray rows.
for (const [id, who] of [[FDC_ROW, 'FDC'], [AIDAN_ROW, 'Aidan']]) {
  const ref = doc(db, 'sessions', DATE, 'players', id);
  const snap = await getDoc(ref);
  if (snap.exists()) { await deleteDoc(ref); console.log(`removed roster row: ${who} (${id})`); }
  else console.log(`already gone: ${who} (${id})`);
}

// 2a. Point Miguel's roster row at his verified account.
const mRef = doc(db, 'sessions', DATE, 'players', MIGUEL_ROW);
const mSnap = await getDoc(mRef);
if (mSnap.exists()) {
  await updateDoc(mRef, { uid: MIGUEL_UID, name: MIGUEL_NAME });
  console.log(`re-pointed Miguel roster row → uid=${MIGUEL_UID}, name="${MIGUEL_NAME}"`);
} else {
  console.log('Miguel roster row not found — skipping');
}

// 2b. Point the bibs commitment at the same account + canonical name.
const ledRef = doc(db, 'gear', 'ledger');
const led = (await getDoc(ledRef)).data() || {};
let changed = 0;
const commitments = (led.commitments || []).map((c) => {
  if (c.type === 'bibs' && c.returnDate === DATE &&
      (c.takerName === 'Miguel C' || c.takerName === MIGUEL_NAME) && !c.takerUid) {
    changed++;
    return { ...c, takerName: MIGUEL_NAME, takerUid: MIGUEL_UID };
  }
  return c;
});
if (changed) { await updateDoc(ledRef, { commitments }); console.log(`re-pointed ${changed} bibs commitment(s) → "${MIGUEL_NAME}" / ${MIGUEL_UID}`); }
else console.log('no matching bibs commitment to re-point');

console.log('\nDone.');
process.exit(0);
